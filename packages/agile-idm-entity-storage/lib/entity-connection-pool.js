var db;
var LevelStorage = require('./level-storage');
var MongoStorage = require('./mongo-storage');
var console = require('./log');

function loadDb(conf) {
  return new Promise(function (resolve, reject) {
    console.log("conf: " + JSON.stringify(conf));
    if (conf === "disconnect") {
      console.log("closing database object");
      if (db)
        db.close().then(function () {
          db = null;
          console.log("database cleaned");
          return resolve();
        });
      else {
        return resolve();
      }
    } else if (db) {
      console.log("resolving with previous database instance");
      return resolve(db);
    } else if (!conf.hasOwnProperty('storage')) {
      console.log(" cannot find storage configuration in Entity Storage");
      reject(new Error("error: cannot find storage configuration in Entity Storage"));
    } else {
      console.log(conf.storage)
      if (conf.storage.type === 'mongodb') {
        db = new MongoStorage()
        console.log(`init new ${conf.storage.type} database instance`);
        db.init(conf.storage).then(() => {
          console.log(`resolving with new ${conf.storage.type} database instance`);
          resolve(db)
        })
      } else if (!conf.storage.type || conf.storage.type === 'leveldb') { // LevelDB will be the default db if no type is provided
        db = new LevelStorage();
        console.log(`init new ${conf.storage.type} database instance`);
        db.init(conf.storage, () => {
          console.log(`resolving with new ${conf.storage.type} database instance`);
          resolve(db)
        })
      }
    }
  });
}
module.exports = loadDb;