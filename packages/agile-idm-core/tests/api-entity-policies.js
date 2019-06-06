var IdmCore = require('../index');
var clone = require('clone');
var assert = require('assert');
var deepdif = require('deep-diff');
var createError = require('http-errors');
var fs = require('fs');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var ulocks = require('ulocks');
var db;

/*

  This test file is very similar to the one without the -policies ending. It just enables the PDP and the PEP properly, while the other one mocks up the security part.

*/
//conf for the API (components such as storage and authentication for the API may be replaced during tests)

var rmdir = require('rmdir');
var conf = require('./entity-policies-conf');
var dbName = conf.storage.dbName;

var additionalPolicy = {
  "files": [
    // the property can only be read by the user itself
    {
      op: "read",
      locks: [{
        lock: "hasType",
        args: ["/user"]
      }, {
        lock: "isOwner"
      }]
    }
    // the property can be set by the user itself and
    , {
      op: "write",
      locks: [{
        lock: "hasType",
        args: ["/user"]
      }, {
        lock: "isOwner"
      }]
    },
    // by all users with role admin
    {
      op: "write",
      locks: [{
        lock: "hasType",
        args: ["/user"]
      }, {
        lock: "attrEq",
        args: ["role", "admin"]
      }]
    }
  ]
};

//override this object to get the pap for creating the fist user.
IdmCore.prototype.getPap = function () {
  return this.pap;
};

IdmCore.prototype.getStorage = function () {
  return this.storage;
}

var idmcore = new IdmCore(conf);

//default data for the tests
var token = "6328602477442473";
var user_info = {
  id: "6328602477442473!@!auth_type",
  entity_type: "/User",
  user_name: "6328602477442473",
  auth_type: "auth_type",
  owner: "6328602477442473!@!auth_type"
};

var action = "create";
var entity_type = "/sensor";
var entity_id = "323";
var entity_1 = {
  "name": "Barack Obam2a",
  "token": "DC 20500"
};

//default data for the tests
var token = "6328602477442473";
var user_info = {
  "user_name": "alice",
  "auth_type": "agile-local",
  "password": "secret",
  "role": "student",
  "owner": "alice!@!agile-local"
};

var user_info_auth = clone(user_info);
user_info_auth.id = "alice!@!agile-local";
user_info_auth.type = "/user";

var admin = {
  "user_name": "bob",
  "auth_type": "agile-local",
  "password": "secret",
  "role": "admin",
  "owner": "bob!@!agile-local"
};

var admin_auth = clone(admin);
admin_auth.id = "bob!@!agile-local";
admin_auth.type = "/user";

function cleanDb(done) {
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

function buildUsers(done) {
  var arr = [idmcore.getPap().setDefaultEntityPolicies(admin_auth.id, admin_auth.type),
    idmcore.getStorage().createEntity(admin_auth.id, admin_auth.type, admin_auth.id, admin_auth)
  ];
  Promise.all(arr)
    .then(function () {
      //  we need to set owner by hand, because admin needs to be able to write to role (i.e. he has role admin)
      //  this is required when admin tries to create new admin users *but still, they own themselves*
      return idmcore.createEntityAndSetOwner(admin_auth, user_info_auth.id, user_info_auth.type, user_info, user_info_auth.id);
    }).then(function () {
      done();
    }, function (err) {
      console.trace("Error " + err);
      console.log("something went wrong while attempting to create users!!!!" + err)
      throw err;
    });
}

//Tests!
describe('Entities Api (with policies)', function () {

  describe('#createEntity and readEntity()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when data is not there', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.readEntity(admin_auth, entity_id, entity_type)
        .then(function (read) {
          throw new Error('unexpec')
        }, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        }).catch(function (err) {
          throw err;
        });

    });

    it('should create an entity by id and return the same afterwards', function (done) {

      idmcore.setMocks(null, null, null, dbconnection, null);
      var entity = clone(entity_1);
      idmcore.createEntity(admin_auth, entity_id, entity_type, entity)
        .then(function (data) {
          if (entity_id == data.id && entity_type === data.type && data.owner === admin_auth.id) {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity) === undefined)
              return idmcore.readEntity(admin_auth, entity_id, entity_type);
          }
        }).then(function (read) {
          if (entity_id == read.id && entity_type === read.type && read.owner === admin_auth.id) {
            delete read.id;
            delete read.type;
            delete read.owner;
            if (deepdif.diff(read, entity) === undefined)
              done();
          }
        }, function handlereject(r) {
          throw r;
        }).catch(function (err) {
          throw err;
        });
    });
  });

  describe('#set attribute and read Entity()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when attempting to update data that is not there', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.setEntityAttribute(admin_auth, entity_id, entity_type, "attributename", "value")
        .then(function (read) {}, function handlereject(error) {
          if (error.statusCode === 404) {
            done();
          }
        });

    });

    it('should update an entity by id and return the proper values afterwards', function (done) {
      var data2;
      idmcore.setMocks(null, null, null, dbconnection, null);
      var entity = clone(entity_1);
      idmcore.createEntity(admin_auth, entity_id, entity_type, entity)
        .then(function (data) {
          if (entity_id === data.id && entity_type === data.type && data.owner === admin_auth.id) {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity) == undefined) {
              data2 = clone(data);
              data2.name = "somenewname";
              return idmcore.setEntityAttribute(admin_auth, entity_id, entity_type, "name", "somenewname");
            }
          }
        }).then(function (result) {
          if (entity_id === result.id && entity_type === result.type && result.owner === admin_auth.id) {
            delete result.id;
            delete result.type;
            delete result.owner;
            if (deepdif.diff(result, data2) == undefined)
              return idmcore.readEntity(admin_auth, entity_id, entity_type);
          }
        })
        .then(function (read) {
          if (entity_id === read.id && entity_type === read.type && read.owner === admin_auth.id) {
            delete read.id;
            delete read.type;
            delete read.owner;
            if (deepdif.diff(read, data2) === undefined)
              done()
          }
        }, function handlereject(r) {
          throw r;
        })
    });
  });

  describe('#delete and readEntity()', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    beforeEach(function (done) {
      buildUsers(done);
    });

    it('should reject with 404 error when attemtpting to delete data is not there', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.deleteEntity(admin_auth, entity_id, entity_type)
        .then(function (read) {}, function handlereject(error) {
          if (error.statusCode === 404) {
            done();
          }
        }).catch(function (err) {
          throw err;
        });
    });

    it('should delete an entity by id', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      var entity = clone(entity_1);
      idmcore.createEntity(admin_auth, entity_id, entity_type, entity)
        .then(function (data) {
          if (entity_id === data.id && entity_type === data.type && data.owner === admin_auth.id) {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity) === undefined)
              return idmcore.deleteEntity(admin_auth, entity_id, entity_type);
          }
        }).then(function () {
          return idmcore.readEntity(admin_auth, entity_id, entity_type);
        }).then(function (read) {

        }, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        }).catch(function (err) {
          throw err;
        });
    });
  });

  describe('#search entity by attribute value', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    beforeEach(function (done) {
      buildUsers(done);
    });

    it('should reject with 404 error when there is no entity with attribute value and type', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.listEntitiesByAttributeValueAndType(admin_auth, [{
          attribute_type: "ss",
          attribute_value: "unexistent-stuff"
        }])
        .then(function (read) {
          if (read instanceof Array && read.length === 0)
            done();
        }, function handlereject(error) {

        }).catch(function (err) {
          throw err;
        });

    });

    it('should get an entity based on attribute value and type', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      var entity = clone(entity_1);
      var entity2 = clone(entity_1);
      var lookedfor = "123123";
      entity2.token = lookedfor;
      idmcore.createEntity(admin_auth, entity_id, entity_type, entity2)
        .then(function (data) {
          if (entity_id === data.id && entity_type === data.type && data.owner === admin_auth.id) {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity2) === undefined)
              return idmcore.createEntity(admin_auth, "someotherid", entity_type, entity)
          }
        }).then(function (data) {
          if ("someotherid" === data.id && entity_type === data.type && data.owner === admin_auth.id) {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity) == undefined)
              return idmcore.listEntitiesByAttributeValueAndType(admin_auth, [{
                attribute_type: "token",
                attribute_value: lookedfor
              }]);
          }
        }).then(function (list) {
          if (list.length === 1) {
            var data = list[0];
            if (data.token === lookedfor && entity_id === data.id && entity_type === data.type && data.owner === admin_auth.id) //more detailed checks in cases when there is only one or more are executed in the sqlite3 tests
              done();
            else
              throw new Error("unexpected entity");

          }
          //return idmcore.readEntity(token, entity_id, entity_type);
        }, function handlereject(error) {
          throw error;
        }).catch(function (err) {
          throw err;
        });

    });

    it('should not resolve with an entity when  attribute values and type match but entity_type does not', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      var entity = clone(entity_1);
      var entity2 = clone(entity_1);
      var lookedfor = "123123";
      entity2.token = lookedfor;
      idmcore.createEntity(admin_auth, entity_id, entity_type, entity2)
        .then(function (data) {
          if (entity_id === data.id && entity_type === data.type && data.owner === admin_auth.id) {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity2) === undefined)
              return idmcore.createEntity(admin_auth, "someotherid", entity_type, entity)
          }
        }).then(function (data) {
          if ("someotherid" === data.id && entity_type === data.type && data.owner === admin_auth.id) {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity) == undefined)
              return idmcore.listEntitiesByAttributeValueAndType(admin_auth, [{
                attribute_type: "token",
                attribute_value: lookedfor
              }], "unexistent_entity_typoe");
          }
        }).then(function (list) {
          if (list.length === 0) {
            done();

          }
          //return idmcore.readEntity(token, entity_id, entity_type);
        }).then(function (read) {

        }, function handlereject(error) {
          throw error;
        }).catch(function (err) {
          throw err;
        });

    });
  });

  describe('#set and read Policies', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    /*it('should return the list of policies of the entity', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      var entity = clone(entity_1);

      idmcore.createEntity(user_info_auth, entity_id, entity_type, entity).then(function (data) {

        idmcore.getEntityPolicies(user_info_auth, entity_id, entity_type)
          .then(function (policies) { // policies: properties/entities/self = top_level_policies
            //
            entity_type = entity_type.replace("/", "");
            //Check deeper level of policies, check agile-idm-web-ui as example /rpi-conf
            var different = false;
            for (var attribute in policies) {

              if (conf.policies.attribute_level_policies[entity_type].hasOwnProperty(attribute)) {

                different = deepdif.diff(conf.policies.attribute_level_policies[entity_type][attribute],
                  policies[attribute].self) !== undefined;
                if (different) {
                  break;
                }
              }
            }
            if (!different) {
              different = deepdif.diff(conf.policies.top_level_policy, policies.self) !== undefined; //also check the top_level_policy
            }
            return different;

          }).then(function (different) {
            if (!different) {
              done();
            }
          }).catch(function (err){
            Error.stackTraceLimit = Infinity;
            console.log(err.trace);
          });
      });

    });*/

    it('set policy for entity', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      var entity = clone(entity_1);
      idmcore.createEntity(user_info_auth, entity_id, entity_type, entity).then(function (data) {
        return idmcore.setEntityPolicy(user_info_auth, entity_id, entity_type, "files", additionalPolicy["files"]);
      }).then(function (entity) {
        return idmcore.getPap().getAttributePolicy(entity_id, entity_type, "files");
      }).then(function (filesPolicy) {
        ulocks.init(conf.upfront.ulocks).then(function () {
          var Policy = ulocks.Policy;
          if (deepdif(filesPolicy, new Policy(additionalPolicy.files)) === undefined) {
            done();
          } else {
            console.log("policies don't match!!!!!")
          }
        })
      }).catch(function (err) {
        Error.stackTraceLimit = Infinity;
        console.log(err.trace);
      });
    });

    it('delete policy for entity', function (done) {
      var Policy = ulocks.Policy;
      idmcore.setMocks(null, null, null, dbconnection, null);
      var entity = clone(entity_1);
      idmcore.createEntity(user_info_auth, entity_id, entity_type, entity).then(function (data) {
        return idmcore.setEntityPolicy(user_info_auth, entity_id, entity_type, "files", additionalPolicy["files"]);
      }).then(function (policy) {
        if (!policy.hasOwnProperty("files")) {
          console.log("error... it seems the policy does not have files!");
        } else {
          return idmcore.deleteEntityPolicy(user_info_auth, entity_id, entity_type, "files");
        }

      }).then(function (policy) {
        if (policy.hasOwnProperty("files")) {
          console.log("error... it seems the policy does have files after deleting it!");
        } else {
          return idmcore.getEntityPolicies(user_info_auth, entity_id, entity_type);
        }

      }).then(function (policy) {
        if (policy.hasOwnProperty("files")) {
          console.log("error... it seems the policy does have files after deleting it!");
        } else {
          done();
        }

      }).catch(function (error) {
        throw error;
      });
    });
  });
});
