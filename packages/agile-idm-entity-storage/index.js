module.exports = {
  Storage:require('./lib/storage'),
  //NOTE connectionPool should only be accessed for testing purposes. It allows to clean the database and disconnect
  connectionPool: require('./lib/entity-connection-pool')
};
