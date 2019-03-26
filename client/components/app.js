/* eslint-disable no-return-assign */
/* eslint-disable complexity */
import React, { Component } from 'react';
//import brace from 'brace';
//import AceEditor from 'react-ace';
import axios from 'axios';
import sqlFormatter from 'sql-formatter';
import { js as beautify } from 'js-beautify';
import MonacoEditor from 'react-monaco-editor';
import { CSVLink } from 'react-csv';

//import 'brace/mode/javascript';
//import 'brace/mode/pgsql';
//import 'brace/theme/monokai';

function hasSomeParentTheClass(element, classname) {
  if (!element || (element && !element.className)) return false;
  if (element && element.className.split(' ').indexOf(classname) >= 0)
    return true;
  return (
    element.parentNode && hasSomeParentTheClass(element.parentNode, classname)
  );
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      jsEditorText: '',
      sqlEditorText: '',
      error: '',
      metadataTables: [],
      queryResults: [],
      currentTab: 'results',
      dialect: '',
      username: '',
      password: '',
      host: '',
      port: '',
      database: '',
      connectVisible: false,
      initial: true,
    };

    document.addEventListener('keypress', e => {
      if (e.which === 13) {
        if (!hasSomeParentTheClass(e.target, 'react-monaco-editor-container')) {
          this.handleSubmit();
        }
      }
    });
  }

  toggleConnectView = () => {
    this.setState(prevState => ({
      connectVisible: !prevState.connectVisible,
    }));
  };

  toggleMetadataView = index => {
    const newMetadataTables = this.state.metadataTables.map(
      (metadataTable, i) =>
        i === index
          ? { ...metadataTable, details: !metadataTable.details }
          : { ...metadataTable }
    );

    this.setState({ metadataTables: newMetadataTables });
  };

  toggleQueryResultsView = index => {
    const newQueryResults = this.state.queryResults.map((queryResult, i) =>
      i === index
        ? { ...queryResult, details: !queryResult.details }
        : { ...queryResult }
    );

    this.setState({ queryResults: newQueryResults });
  };

  handleClickTab = tabName => {
    this.setState({ currentTab: tabName });
  };

  handleSubmit = async () => {
    const res = await axios.post('/getSql', {
      code: this.state.jsEditorText,
      connection: {
        dialect: this.state.dialect,
        host: this.state.host,
        port: this.state.port,
        database: this.state.database,
        username: this.state.username,
        password: this.state.password,
      },
    });

    let queryResults = res.data.sqlAndResults;

    let currentIndex = 0;
    let displayIndex;
    queryResults = queryResults.map(({ sql, fields, rows, rowCount }) => {
      displayIndex = null;
      if ((rowCount >= 0 && rowCount !== null) || (rows && rows.length)) {
        currentIndex++;
        displayIndex = currentIndex;
      }

      const csvOutput = [
        fields.map(field =>
          typeof field === 'string' &&
          (field.split('').includes(' ') || field.split('').includes(','))
            ? `"${field}"`
            : field
        ),
        ...rows.map(row =>
          row.map(field => {
            return typeof field === 'string' &&
              (field.split('').includes(' ') || field.split('').includes(','))
              ? `"${field}"`
              : field;
          })
        ),
        ['Rows', rowCount],
      ];
      const sqlFull = `${
        displayIndex ? `/* Result ${displayIndex} */\n\n` : ''
      }${sql}`.trim();

      return {
        displayIndex,
        sql,
        sqlFull,
        fields,
        csvOutput,
        rows,
        rowCount,
      };
    });

    const sql = queryResults.map(({ sqlFull }) => sqlFull);

    let metadataTables = res.data.metadataTablesOutput;
    const error = res.data.error;

    metadataTables = metadataTables.map(metadataTable => ({
      ...metadataTable,
      details:
        (this.state.metadataTables.length &&
          this.state.metadataTables.find(
            mt => mt.table === metadataTable.table
          ) &&
          this.state.metadataTables.find(mt => mt.table === metadataTable.table)
            .details) ||
        false,
    }));

    queryResults = queryResults.map(queryResult => ({
      ...queryResult,
      details:
        (this.state.queryResults.length &&
          this.state.queryResults.find(qr => qr.sql === queryResult.sql) &&
          this.state.queryResults.find(qr => qr.sql === queryResult.sql)
            .details) ||
        false,
    }));

    const formattedSqlLines = sql.map(line => {
      let formattedLine = sqlFormatter.format(line.trim());
      if (formattedLine[formattedLine.length - 1] !== ';') formattedLine += ';';
      return formattedLine.trim();
    });

    this.setState(prevState => {
      return {
        jsEditorText: beautify(prevState.jsEditorText, { indent_size: 2 }),
        sqlEditorText: sqlFormatter
          .format(formattedSqlLines.join(''))
          .replace(/;/g, ';\n\n')
          .replace(/( {2}\/\*)/g, '/*'),
        error: error ? error : '',
        metadataTables,
        queryResults,
        currentTab: error
          ? 'errors'
          : prevState.currentTab === 'errors'
          ? 'results'
          : prevState.currentTab,
        initial: false,
      };
    });
  };

  handleClear = () => {
    this.setState({
      jsEditorText: '',
      sqlEditorText: '',
      error: '',
      metadataTables: [],
      queryResults: [],
      currentTab: 'results',
      initial: true,
    });
  };

  handleBeautify = () => {
    this.setState(prevState => {
      return {
        jsEditorText: beautify(prevState.jsEditorText, { indent_size: 2 }),
        sqlEditorText: sqlFormatter
          .format(prevState.sqlEditorText)
          .replace(/;/g, ';\n\n')
          .replace(/( {2}\/\*)/g, '/*'),
      };
    });
  };

  handleChange = (type, value) => {
    this.setState({ [type]: value });
  };

  render() {
    const options = {
      selectOnLineNumbers: true,
      tabSize: 2,
      automaticLayout: true,
    };
    return (
      <div style={{ height: '100vh', display: 'flex', flexFlow: 'column' }}>
        <nav style={{ backgroundColor: 'black' }}>
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
            }}
          >
            <h1 style={{ marginLeft: '20px' }}>
              <i className="fas fa-database" /> SQLize
            </h1>
          </div>
        </nav>
        <div
          style={{
            display: 'flex',
            flexFlow: 'column',
            flex: 2,
            marginLeft: '50px',
            marginRight: '50px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
            <div style={{ width: '50%' }}>
              <h3
                onClick={this.toggleConnectView}
                style={{
                  marginTop: '10px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-handshake" /> Connect{' '}
                <i
                  className={`fas ${
                    this.state.connectVisible ? 'fa-caret-up' : 'fa-caret-down'
                  }`}
                />
              </h3>
            </div>
            <div style={{ width: '50%' }}>
              <div style={{ width: '100%' }} className="topnav">
                <span
                  style={{
                    border: '0.5px solid rgb(30,30,30)',
                    borderTopWidth: '0',
                  }}
                  onClick={this.handleSubmit}
                >
                  Run{' '}
                  <i
                    style={{ color: 'rgb(70,199,173)' }}
                    className="fas fa-caret-square-right"
                  />
                </span>
                <span
                  style={{
                    border: '0.5px solid rgb(30,30,30)',
                    borderTopWidth: '0',
                  }}
                  onClick={this.handleBeautify}
                >
                  Beautify
                </span>
                <span
                  style={{
                    border: '0.5px solid rgb(30,30,30)',
                    borderTopWidth: '0',
                  }}
                  onClick={this.handleClear}
                >
                  Clear
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginLeft: '15px',
              display: this.state.connectVisible ? 'block' : 'none',
            }}
          >
            <div>
              <select
                onChange={e => this.handleChange(e.target.name, e.target.value)}
                name="dialect"
                className="login-input"
                value={this.state.dialect}
              >
                <option value="dialect">dialect</option>
                <option value="postgres">postgres</option>
                <option value="mysql">mysql</option>
                <option value="mssql">mssql</option>
                <option value="sqlite">sqlite</option>
              </select>

              <input
                onChange={e => this.handleChange(e.target.name, e.target.value)}
                style={{ marginLeft: '7px' }}
                name="host"
                type="text"
                className="login-input"
                placeholder="host"
                value={this.state.host}
              />
              <input
                onChange={e => this.handleChange(e.target.name, e.target.value)}
                style={{ marginLeft: '7px', width: '52px' }}
                name="port"
                type="text"
                className="login-input"
                placeholder="port"
                value={this.state.port}
              />

              <input
                onChange={e => this.handleChange(e.target.name, e.target.value)}
                style={{ marginLeft: '7px', width: '100px' }}
                name="database"
                type="text"
                className="login-input"
                placeholder="database"
                value={this.state.database}
              />

              <input
                onChange={e => this.handleChange(e.target.name, e.target.value)}
                style={{ marginLeft: '7px', width: '100px' }}
                name="username"
                type="text"
                className="login-input"
                placeholder="username"
                value={this.state.username}
              />
              <input
                onChange={e => this.handleChange(e.target.name, e.target.value)}
                style={{ marginLeft: '7px', width: '100px' }}
                name="password"
                type="password"
                className="login-input"
                placeholder="password"
                value={this.state.password}
              />
            </div>

            <div
              style={{
                fontFamily:
                  'Menlo,Monaco,Consolas,"Droid Sans Mono","Inconsolata","Courier New"',
                fontSize: '12px',
                marginTop: '7px',
              }}
            >
              <span style={{ color: '#569cd6' }}>const</span>{' '}
              <span style={{ color: '#3dc9b0' }}>Sequelize</span> = require(
              <span style={{ color: '#ce9178' }}>'sequelize'</span>);
            </div>
            <div
              style={{
                paddingBottom: '10px',
                fontFamily:
                  'Menlo,Monaco,Consolas,"Droid Sans Mono","Inconsolata","Courier New"',
                fontSize: '12px',
              }}
            >
              <span style={{ color: '#569cd6' }}>const</span> db ={' '}
              <span style={{ color: '#569cd6' }}>new</span>{' '}
              <span style={{ color: '#3dc9b0' }}>Sequelize</span>(
              {'{...[options]}'});
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-evenly',
            }}
          >
            <div style={{ width: '50%' }}>
              <h3
                style={{
                  display: 'inline-block',
                  padding: '10px 14px',
                  margin: 0,
                  backgroundColor: 'rgb(30,30,30)',
                }}
              >
                JS (Sequelize)
              </h3>
            </div>
            <div style={{ width: '50%' }}>
              <h3
                style={{
                  display: 'inline-block',
                  padding: '10px 14px',
                  margin: 0,
                  backgroundColor: 'rgb(30,30,30)',
                }}
              >
                {!this.state.error && !this.state.initial ? (
                  <i
                    style={{ color: 'rgb(70,199,173)' }}
                    className="fas fa-check-circle"
                  />
                ) : (
                  ''
                )}{' '}
                SQL
              </h3>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-evenly',
            }}
          >
            <div style={{ width: '50%' }}>
              <MonacoEditor
                height="420"
                language="javascript"
                theme="vs-dark"
                value={this.state.jsEditorText}
                options={options}
                onChange={val => this.handleChange('jsEditorText', val)}
                editorWillMount={monaco => {
                  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
                    {
                      noSemanticValidation: false,
                      noSyntaxValidation: false,
                    }
                  );
                }}
              />
            </div>
            <div style={{ width: '50%' }}>
              <MonacoEditor
                height="420"
                language="sql"
                theme="vs-dark"
                value={this.state.sqlEditorText}
                options={options}
                onChange={val => this.handleChange('sqlEditorText', val)}
              />
            </div>
          </div>

          <div>
            <div className="bottomnav">
              <span
                style={{ borderLeft: '1px solid rgb(20, 20, 26)' }}
                className={
                  this.state.currentTab === 'results' ? 'active' : 'inactive'
                }
                onClick={() => this.handleClickTab('results')}
              >
                {!this.state.error && !this.state.initial ? (
                  <i
                    style={{ color: 'rgb(70,199,173)' }}
                    className="fas fa-check-circle"
                  />
                ) : (
                  ''
                )}{' '}
                Results
              </span>
              <span
                className={
                  this.state.currentTab === 'metadata' ? 'active' : 'inactive'
                }
                onClick={() => this.handleClickTab('metadata')}
              >
                Metadata
              </span>
              <span
                className={
                  this.state.currentTab === 'errors' ? 'active' : 'inactive'
                }
                onClick={() => this.handleClickTab('errors')}
                style={{ borderRight: '1px solid rgb(20, 20, 26)' }}
              >
                {this.state.error ? (
                  <i
                    style={{ color: 'rgb(231,60,71)' }}
                    className="fas fa-exclamation-circle"
                  />
                ) : (
                  ''
                )}{' '}
                Errors
              </span>
            </div>
          </div>
          <div
            style={{
              flex: '2',
              display: 'flex',
              justifyContent: 'space-evenly',
              paddingBottom: '5px',
            }}
          >
            <div
              style={{
                whiteSpace: 'pre-wrap',
                overflow: 'auto',
                color: 'rgb(231,60,71)',
                width: '100%',
                backgroundColor: '#14141a',
                padding: '10px',
                display: this.state.currentTab === 'errors' ? 'block' : 'none',
              }}
            >
              {this.state.error}
            </div>
            <div
              style={{
                width: '100%',
                overflow: 'auto',
                backgroundColor: '#14141a',
                padding: '5px',
                display:
                  this.state.currentTab === 'metadata' ? 'block' : 'none',
              }}
            >
              {this.state.metadataTables.map((metadataTable, i) => {
                return (
                  <div key={metadataTable.table}>
                    <h3
                      className="table-title"
                      style={{ marginLeft: '7px' }}
                      onClick={() => this.toggleMetadataView(i)}
                    >
                      {' '}
                      <i
                        className={`fas ${
                          metadataTable.details
                            ? 'fa-caret-up'
                            : 'fa-caret-down'
                        }`}
                      />{' '}
                      {metadataTable.table}
                    </h3>
                    <div
                      style={{
                        display: metadataTable.details ? 'block' : 'none',
                      }}
                    >
                      <table
                        className="table-fill"
                        style={{ marginLeft: '7px' }}
                      >
                        <thead>
                          <tr>
                            {metadataTable.fields.map(field => {
                              return (
                                <th className="text-left" key={field}>
                                  {field}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="table-hover">
                          {metadataTable.records.map((record, j) => {
                            return (
                              <tr key={j}>
                                {record.map((column, k) => (
                                  <td className="text-left" key={k}>
                                    {column}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {metadataTable.foreignKeys.length ? (
                        <div>
                          <h4
                            style={{
                              marginLeft: '7px',
                              marginTop: '10px',
                              marginBottom: '10px',
                            }}
                          >
                            Foreign Keys
                          </h4>
                          {metadataTable.foreignKeys.map((foreignKey, l) => (
                            <div key={l} style={{ marginLeft: '14px' }}>
                              {foreignKey}
                            </div>
                          ))}
                        </div>
                      ) : (
                        ''
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                width: '100%',
                overflow: 'auto',
                backgroundColor: '#14141a',
                padding: '5px',
                display: this.state.currentTab === 'results' ? 'block' : 'none',
              }}
            >
              {this.state.queryResults.map((queryResult, i) => {
                return queryResult.displayIndex ? (
                  <div key={queryResult.sql}>
                    <h3
                      onClick={() => this.toggleQueryResultsView(i)}
                      className="table-title"
                      style={{ marginLeft: '7px' }}
                    >
                      <i
                        className={`fas ${
                          queryResult.details ? 'fa-caret-up' : 'fa-caret-down'
                        }`}
                      />{' '}
                      {`${queryResult.displayIndex}. ${queryResult.sql
                        .slice(0, 100)
                        .trim()}${queryResult.sql.length > 101 ? '...' : ''}`}
                    </h3>
                    <div
                      style={{
                        display: queryResult.details ? 'block' : 'none',
                      }}
                    >
                      <table
                        className="table-fill"
                        style={{ marginLeft: '7px' }}
                      >
                        <thead>
                          <tr>
                            {queryResult.fields &&
                              queryResult.fields.map(field => {
                                return (
                                  <th className="text-left" key={field}>
                                    {field}
                                  </th>
                                );
                              })}
                          </tr>
                        </thead>
                        <tbody className="table-hover">
                          {queryResult.rows &&
                            queryResult.rows.slice(0, 50).map((row, j) => {
                              return (
                                <tr key={j}>
                                  {row.map((column, k) => (
                                    <td className="text-left" key={k}>
                                      {typeof column === 'string'
                                        ? `${column.slice(0, 75).trim()}${
                                            column.length > 76 ? '...' : ''
                                          }`
                                        : column}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                      <h4
                        style={{
                          marginBottom: '15px',
                          marginLeft: '15px',
                          fontSize: '12px',
                          marginTop:
                            (queryResult.rowCount === null &&
                              !queryResult.rows) ||
                            (queryResult.rows && !queryResult.rows.length)
                              ? 0
                              : 'default',
                        }}
                      >
                        <span>Rows:</span> {queryResult.rowCount}
                      </h4>
                      {queryResult.csvOutput[0] && (
                        <CSVLink
                          className="export"
                          filename="output.csv"
                          data={queryResult.csvOutput}
                          enclosingCharacter=""
                          style={{ marginLeft: '15px' }}
                        >
                          Export to CSV
                        </CSVLink>
                      )}
                    </div>
                  </div>
                ) : (
                  ''
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
