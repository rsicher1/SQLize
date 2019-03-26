const express = require('express');
const path = require('path');
const morgan = require('morgan');
const app = express();
const PORT = process.env.PORT || 8080;
const { NodeVM } = require('vm2');
const Sequelize = require('sequelize');

let metadataResults = {};

const vm = new NodeVM({
  sandbox: { metadataResults },
  console: 'inherit',
  require: {
    external: true,
    root: './',
  },
});

const createApp = () => {
  // Static files directory (css, js, etc)
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(morgan('dev'));

  // post submit
  // eslint-disable-next-line complexity
  app.post('/getSql', async (req, res, next) => {
    const sqlAndResults = require('sequelize/lib/dialects/abstract/query')
      .sqlAndResults;
    while (sqlAndResults.length) sqlAndResults.pop();
    let asyncFunc = null;
    try {
      const {
        connection: { username, password, dialect, database, port, host },
      } = req.body;

      const connectionString = `const Sequelize = require('sequelize');
      const db = new Sequelize({
        ${dialect.trim() ? `dialect: '${dialect}',` : ''}
        ${host.trim() ? `host: '${host}',` : ''}
        ${port.trim() ? `port: ${Number(port)},` : ''}
        ${database.trim() ? `database: '${database}',` : ''}
        ${username.trim() ? `username: '${username}',` : ''}
        ${password.trim() ? `password: '${password}',` : ''}
        logging: false,
        });`;
      asyncFunc = vm.run(
        `module.exports = async () => {
          ${connectionString}


          ${req.body.code}


      const metadataQueries = Object.keys(db.models).map(name => (
         { table: db.models[name].tableName, describeTableQuery: db.models[name].QueryGenerator.describeTableQuery(db.models[name].tableName),
        foreignKeysQuery: db.models[name].QueryGenerator.getForeignKeyReferencesQuery(db.models[name].tableName)}
    ));



      const executedMetadataQueries = metadataQueries.map(metadataTableQueries => (
        { table: metadataTableQueries.table, describeTableQuery: db.query(metadataTableQueries.describeTableQuery,{off: true}),
          foreignKeysQuery: db.query(metadataTableQueries.foreignKeysQuery,{off: true})}
      ));

      const executedMetadataQueriesPA = []
      executedMetadataQueries.forEach(metadataTableQueries =>{ Object.keys(metadataTableQueries).forEach(key => {executedMetadataQueriesPA.push(metadataTableQueries[key]) }  )  })

      await Promise.all(executedMetadataQueriesPA);

      metadataResults.exports = executedMetadataQueries

   }

   `,
        'vm.js'
      );

      await asyncFunc();

      const metadataTablesOutput = metadataResults.exports.map(
        metadataTable => {
          const table = metadataTable.table;
          const fields = metadataTable.describeTableQuery._rejectionHandler0[1].fields.map(
            field => field.name
          );
          const records = metadataTable.describeTableQuery._rejectionHandler0[0].map(
            row => [
              row.Constraint || '',
              row.Field || '',
              (row.Default &&
                row.Default.indexOf('::') &&
                row.Default.indexOf("'") > -1 &&
                row.Default.slice(
                  row.Default.indexOf("'"),
                  row.Default.lastIndexOf("'") + 1
                )) ||
                row.Default ||
                '',
              row.Null || '',
              row.Type || '',
              row.special || '',
            ]
          );

          const foreignKeys = metadataTable.foreignKeysQuery._rejectionHandler0[0].map(
            foreignKey => {
              return (
                foreignKey.constraint_name +
                ': ' +
                foreignKey.column_name +
                ' references ' +
                foreignKey.referenced_table_name +
                '(' +
                foreignKey.referenced_column_name +
                ')'
              );
            }
          );

          return { table, fields, records, foreignKeys };
        }
      );

      const formattedSqlAndResults = sqlAndResults.map(sqlAndResult => {
        const command = sqlAndResult.queryResult.command;
        const sql = sqlAndResult.sql;
        const fields =
          sqlAndResult.queryResult.fields &&
          sqlAndResult.queryResult.fields.map(field => field.name);
        const rows =
          sqlAndResult.queryResult.rows &&
          sqlAndResult.queryResult.rows.map(row => {
            return fields.map(field => {
              return row[field];
            });
          });
        const rowCount =
          sqlAndResult.queryResult.rowCount === 0
            ? 0
            : sqlAndResult.queryResult.rowCount || null;

        return { command, sql, fields, rows, rowCount };
      });

      res.send({ sqlAndResults: formattedSqlAndResults, metadataTablesOutput });
    } catch (err) {
      res.send({ sqlAndResults, metadataTablesOutput: [], error: err.stack });
    }
  });

  // Requests with an extension (.js, .css, etc.) send 404
  app.use((req, res, next) => {
    if (path.extname(req.path).length) {
      const err = new Error('Not found');
      err.status = 404;
      next(err);
    } else {
      next();
    }
  });

  // Serve index.html by default
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err);
    console.error(err.stack);

    err.message = err.message || 'Internal Server Error';
    res.status = err.status || 500;
    res.send(err);
  });
};

const startListening = () => {
  // start listening (and create a 'server' object representing our server)
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

async function bootApp() {
  await createApp();
  await startListening();
}

// This evaluates as true when this file is run directly from the command line,
// i.e. when we say 'node server/index.js' (or 'nodemon server/index.js', or 'nodemon server', etc)
// It will evaluate false when this module is required by another module - for example,
// if we wanted to require our app in a test spec
if (require.main === module) {
  bootApp();
} else {
  createApp();
}
