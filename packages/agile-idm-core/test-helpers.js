var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb').MongoClient);
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var rmdir = require('rmdir');
var conf = require('./tests/entity-policies-conf');
var storage, upfront;

/* 
The following config params are for either mongodb or leveldb.
Depending on the environment variable DB_TYPE the appropriate configuration gets selected.
*/
// exports.storage = function (dbtype) {
//   if (dbtype == "mongodb") {
//     return {
//       dbName: "admin",
//       type: "mongodb",
//       host: "localhost",
//       port: 27017,
//       password: "secret",
//       user: "agile",
//       entityCollection: "entities",
//       groupCollection: "groups",
//     };
//   } else {
//     return {
//       dbName: "./database"
//     };
//   }
// };
// exports.upfront = function (dbtype) {
//   if (dbtype == "mongodb") {
//     return {
//       type: "mongodb",
//       host: "localhost",
//       port: 27017,
//       password: "secret",
//       user: "agile",
//       dbName: "admin",
//       collection: "policies"
//     };
//   } else {
//     return {
//       module_name: "agile-upfront-leveldb",
//       type: "external",
//       dbName: "./pap-database",
//       collection: "policies"
//     };
//   }
// };

if (process.env.DB_TYPE == "mongodb") {
  storage = {
    dbName: "admin",
    type: "mongodb",
    host: "localhost",
    port: 27017,
    password: "secret",
    user: "agile",
    entityCollection: "entities",
    groupCollection: "groups",
  };
  upfront = {
    type: "mongodb",
    host: "localhost",
    port: 27017,
    password: "secret",
    user: "agile",
    dbName: "admin",
    collection: "policies"
  };
} else {
  storage = {
    dbName: "./database"
  };
  upfront = {
    module_name: "agile-upfront-leveldb",
    type: "external",
    dbName: "./pap-database",
    collection: "policies"
  };
}

exports.storage = storage;
exports.upfront = upfront;
exports.cleanDb = (done) => {
  initCleanUp().then(() => {
    done();
  }).catch(err => {
    throw err;
  })
}

/* 
The initCleanUp function decides which cleanups have to be performed.
This depends on the given environment variable DB_TYPE.
*/
function initCleanUp() {
  if (process.env.DB_TYPE == "mongodb") {
    return mongoCleanUp();
  } else {
    return levelCleanUp();
  }
}

/* 
This function connects to mongodb and tries to delete the following collections:
   - entities, policies, groups
*/
function mongoCleanUp() {
  return new Promise((resolve, reject) => {

    mongoClient.connect('mongodb://' + conf.storage.user + ':' + conf.storage.password + '@' + conf.storage.host + ':' + conf.storage.port + '/' + conf.storage.dbName).then(db => {
      this.mongoDB = db;

      var collectionDeletePromises = [
        deleteCollection("entities"),
        deleteCollection("policies"),
        deleteCollection("groups")
      ];

      return Promise.all(collectionDeletePromises);
    }).then(() => {
      this.mongoDB.close();
      resolve();
    }).catch(err => {
      reject('Could not connect to mongodb: ' + err);
    })
  });
}

/* 
This is a helper function of the mongoCleanUp().
It is just dropping the given collection. 
*/
function deleteCollection(collectionName) {
  return new Promise((resolve, _reject) => {
    this.mongoDB.collection(collectionName).drop().then(() => resolve()).catch(err => {
      resolve();
    });
  })
}

function levelCleanUp() {
  return new Promise((resolve, reject) => {
    dbconnection("disconnect").then(function () {
      rmdir(conf.storage.dbName + "_entities", function (err, dirs, files) {
        rmdir(conf.storage.dbName + "_groups", function (err, dirs, files) {
          db = null;
          rmdir(conf.upfront.pap.storage.dbName + "_policies", function (err, dirs, files) {
            resolve();
          });

        });
      });
    }, function () {
      reject("not able to close database");
    });
  })
}