var IdmCore = require('../index');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var rmdir = require('rmdir');
var fs = require('fs');

var conf = require('./standard-conf')
var dbName = conf.storage.dbName;

var pepMockOk = {
  declassify: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      resolve(entityInfo);
    });
  },
  declassifyArray: function (userInfo, array) {
    return new Promise(function (resolve, reject) {
      resolve(array);
    });
  }
};

function cleanDb(c) {
  //disconnect in any case.
  function disconnect(done) {
    dbconnection("disconnect").then(function () {
      rmdir(dbName + "_entities", function (err, dirs, files) {
        rmdir(dbName + "_groups", function (err, dirs, files) {
          db = null;
          rmdir(conf.upfront.pap.storage.dbName + "_policies", function (err, dirs, files) {
            done();
          });
        });
      });
    }, function () {
      throw Error("not able to close database");
    });
  }
  disconnect(c);
}

var PdpMockOk = {
  canRead: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      resolve(entityInfo);
    });
  },
  canDelete: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      resolve(entityInfo);
    });
  },
  canReadArray: function (userInfo, entities) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve(entities);
    });
  },
  canWriteToAttribute: function (userInfo, entities, attributeName, attributeValue) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve();
    });
  },
  canUpdate: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve(entityInfo);
    });
  },
  canWriteToAllAttributes: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve();
    });
  }

};

//default data for the tests
var token = "6328602477442473";
var user_info = {
  id: "6328602477442473!@!auth_type",
  entity_type: "/User",
  user_name: "6328602477442473",
  auth_type: "auth_type",
  owner: "6328602477442473!@!auth_type"
};

describe('Api (Validation test)', function () {

  describe('#createEntity()', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 400 when an entity with a non-existing kind of entity is passed', function (done) {
      var idmcore = new IdmCore(conf);
      var entity_id = "1";
      var entity_type = "/non-existent";
      var entity = {};
      idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
      idmcore.createEntity(user_info, entity_id, entity_type, entity)
        .then(function (read) {
          throw new Error('unexpec')
        }, function handlereject(error) {
          if (error.statusCode == "400" && error.message.indexOf("SchemaError") > 0) {
            done();
          }
        });
    });

    it('should create an entity when an entity a proper type and schema are provided', function (done) {
      var idmcore = new IdmCore(conf);
      var entity_id = "1";
      var entity_type = "/user";
      var entity = {
        "user_name": "some-id",
        "auth_type": "some-type"

      }
      idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
      idmcore.createEntity(user_info, entity_id, entity_type, entity)
        .then(function (res) {
          done();
        }, function handlereject(error) {
          console.log(error);
          throw new Error("unexpected error " + error);
        });
    });

  });

  it('should reject with 400 an entity when with an existing type but with an attribute missing ', function (done) {
    var idmcore = new IdmCore(conf);
    var entity_id = "1";
    var entity_type = "/user";
    var entity = {
      "user_name1": "some-id",
      "auth_type": "some-type"

    }
    idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
    idmcore.createEntity(user_info, entity_id, entity_type, entity)
      .then(function (res) {
        throw new Error("unexpected " + res);
      }, function handlereject(error) {
        if (error.statusCode == 400) {
          done();
        }
      });

  });

  it('should reject with 409 when attempting to create an entity with a forbidden attribute name', function (done) {
    var idmcore = new IdmCore(conf);
    var entity_id = "1";
    var entity_type = "/user";
    var entity = {
      "user_name": "some-id",
      "auth_type": "some-type",
      "groups": "x"

    }
    idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
    idmcore.createEntity(user_info, entity_id, entity_type, entity)
      .then(function (res) {
        console.log("unexpected result " + res)
        throw new Error("unexpected " + res);
      }, function handlereject(error) {
        if (error.statusCode == 409) {
          done();
        }
      });

  });

});
