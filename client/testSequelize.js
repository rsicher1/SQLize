const Order = db.define('order', {
  itemQuantity: {
    type: Sequelize.INTEGER,
    validate: {
      min: 1,
    },
  },
  orderPrice: {
    type: Sequelize.DECIMAL(18, 2),
  },
  orderStatus: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  orderTS: {
    type: Sequelize.DATE,
  },
});

const Product = db.define('product', {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  description: {
    type: Sequelize.STRING,
  },
  imageUrl: {
    type: Sequelize.STRING,
    defaultValue: '/images/productDefault.png',
  },
  price: {
    type: Sequelize.DECIMAL(18, 2),
    allowNull: false,
    validate: {
      min: 2,
    },
  },
});

const User = db.define('user', {
  email: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true,
      notEmpty: true,
    },
  },
  password: {
    type: Sequelize.STRING,
    get() {
      return () => this.getDataValue('password');
    },
    // Making `.password` act like a func hides it when serializing to JSON.
    // This is a hack to get around Sequelize's lack of a "private" option.
  },
  salt: {
    type: Sequelize.STRING,
    get() {
      return () => this.getDataValue('salt');
    },
  },
  firstName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  lastName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  phone: {
    type: Sequelize.STRING,
  },
  googleId: {
    type: Sequelize.STRING,
  },
  isAdmin: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
});

User.hasMany(Order);
Order.belongsTo(User);

Product.hasMany(Order);
Order.belongsTo(Product);

const products = await Product.findAll({
  include: [
    {
      model: Order,
    },
  ],
});

await products[0].orders[0].getUser();

const product = await Product.create({
  name: 'Pets.com',
  description: 'Amazon for pets. Look at this sock puppet',
  imageUrl:
    'https://www.sullivanperkins.com/wp-content/uploads/2016/03/client-experience-pets-1-860x1024.jpg',
  price: '17.18',
});



const newProduct = await Product.findOrCreate({
  where: {
    name: 'Pets.com',
  },
  defaults: {
    description: 'Amazon for pets. Look at this sock puppet',
    imageUrl:
      'https://www.sullivanperkins.com/wp-content/uploads/2016/03/client-experience-pets-1-860x1024.jpg',
    price: '17.18',
  },
});

await newProduct[0].destroy();

const reallyNewProduct = await Product.findOrCreate({
  where: {
    name: 'AIM',
  },
  defaults: {
    description:
      'Where true friendships are forged and maintained, away from the pressures of talking IRL.',
    imageUrl:
      'https://crackberry.com/sites/crackberry.com/files/u7860/aim_logo.jpg',
    price: '35.00',
  },
});

await reallyNewProduct[0].destroy();
