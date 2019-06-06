var IdmCore = require('../index');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var rmdir = require('rmdir');
var fs = require('fs');
var clone = require('clone');
//{"target":{"type":"user"},"locks":[{"path":"hasId","args":["$owner"]}]
var conf = require('./entity-policies-conf');
var dbName = conf.storage.dbName;
//override this object to get the pap for creating the fist user.
IdmCore.prototype.getPap = function () {
  return this.pap;
};

IdmCore.prototype.getStorage = function () {
  return this.storage;
}

var idmcore = new IdmCore(conf);

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
      throw err;
    });
}

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

describe('Api (PEP Read test)', function () {

  describe('#readEntity()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should resolve with a declassified entity for different users (password not there)', function (done) {

      var entity_id = "username!@!some-type";
      var entity_type = "/user";
      var owner = "username!@!some-type";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          return idmcore.readEntity(user_info_auth, res.id, res.type);
        }).then(function (read) {
          if (read.hasOwnProperty("password")) {
            throw new Error("entity not properly declassified!");
          } else
            done();
        }, function handlereject(error) {
          throw error;
        });
    });

    it('should resolve with a declassified entity for different users for nested properties (credentials.dropbox not there)', function (done) {

      var entity_id = "username!@!some-type";
      var entity_type = "/user";
      var owner = "username!@!some-type";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value",
        "credentials": {
          "dropbox": "value",
          "drive": "something"
        }
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          return idmcore.readEntity(user_info_auth, res.id, res.type);
        }).then(function (read) {
          if (read.hasOwnProperty("credentials")) {
            if (read.credentials.hasOwnProperty("dropbox")) {
              console.log("oops dropbox is still there..." + JSON.stringify(read))
              throw new Error("entity not properly declassified!");
            } else {
              done();
            }
          } else {
            throw new Error("removed something that wasn't supposed to be removed! credentials.drive");
          }

        }, function handlereject(error) {
          throw error;
        });
    });

    it('should resolve with the complete entity when the owner reads it including inner properties (credentials.dropbox)', function (done) {
      var entity_id = "username!@!some-type";
      var owner = "username!@!some-type";
      var entity_type = "/user";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value",
        "credentials": {
          "dropbox": "value",
          "drive": "something"
        }
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          return idmcore.readEntity(res, res.id, res.type);
        }).then(function (data) {
          if (!data.hasOwnProperty("password") || !data.hasOwnProperty("credentials") || data.credentials.dropbox !== entity.credentials.dropbox || data.credentials.drive !== entity.credentials.drive) {
            throw new Error("entity wrongly declassified, an entity was removed when it should not have been removed!");
          } else {
            done();
          }
        }, function handlereject(error) {
          throw error;
        });

    });

    it('should resolve with the complete entity when the owner reads it', function (done) {
      var entity_id = "username!@!some-type";
      var owner = "username!@!some-type";
      var entity_type = "/user";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          return idmcore.readEntity(res, res.id, res.type);
        }).then(function (data) {
          if (!data.hasOwnProperty("password")) {
            console.log("NO PASSWORD! " + JSON.stringify(data));
            throw new Error("entity wrongly declassified, an entity was removed when it should not have been removed!");
          } else {
            done();
          }
        }, function handlereject(error) {
          throw error;
        });

    });

    it('should resolve with the entity when attempting to create an entity with the proper role', function (done) {
      var entity_id = "username!@!some-type";
      var owner = "username!@!some-type";
      var entity_type = "/user";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          done();
        }, function handlereject(error) {
          throw error;
        });

    });
  });

  describe('#findEntitiesByAttribute()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {

      cleanDb(done);
    });

    it('should resolve with an array without entities for which the attributes used in the query are not allowed to be read by the policy', function (done) {
      var entity_id = "username!@!some-type";
      var owner = "username!@!some-type";
      var entity_type = "/user";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      var new_user_auth;
      idmcore.setMocks(null, null, null, dbconnection);

      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (user) {
          new_user_auth = user;
          var criteria = [{
            attribute_type: "password",
            attribute_value: "secret"
          }];
          var queries = [idmcore.listEntitiesByAttributeValueAndType(admin_auth, criteria),
            idmcore.listEntitiesByAttributeValueAndType(user_info_auth, criteria),
            idmcore.listEntitiesByAttributeValueAndType(new_user_auth, criteria)
          ];
          return Promise.all(queries);
        })
        .then(function (results) {

          if (results[0].length === 1 && admin_auth.id == results[0][0].id && //admin can only see his password
            results[1].length === 1 && user_info_auth.id == results[1][0].id && //oehter user can only see his password
            results[2].length === 0 //this user cannot see anything because eventhough he asked for the right password for other users, he doesn;t have access, and his password doesn't match
          )
            done();
          else
            throw new Error("unexpected result, should only see its own passowrd");
        }, function handlereject(error) {
          throw error;
        });
    });
  });

});
