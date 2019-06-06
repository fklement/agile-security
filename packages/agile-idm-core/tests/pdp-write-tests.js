var IdmCore = require('../index');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var rmdir = require('rmdir');
var fs = require('fs');
var clone = require('clone');
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

describe('Api (PEP Write Test)', function () {

  describe('#createEntity()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 403 and conflicts array in the object when attempting to create an entity without the proper role', function (done) {

      var entity_id = "username!@!some-type";
      var entity_type = "/user";
      var owner = "username!@!some-type";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(user_info_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          throw new Error("unexpected. user not admin can create users!");
        }, function handlereject(error) {
          if (error.statusCode === 403 && error.conflicts.length > 0)
            done();
        });
    });

    it('should resolve with the entity when  attempting to create an entity with the proper role', function (done) {
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

  describe('#setAttribute()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 403 and conflicts array when attempting to update  an entity\'s attribute without the proper role and not owner', function (done) {
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
          return idmcore.setEntityAttribute(user_info_auth, entity_id, entity_type, "role", "admin");
        }).then(function () {
          throw new Error("unexpected... the user can set the role without being admin!");
        }, function handlereject(error) {
          if (error.statusCode == "403" && error.conflicts.length > 0)
            done();
        });
    });

    it('should reject with 403 and conflicts array when an owner (non-admin) attempts to update  his own role', function (done) {
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
          return idmcore.setEntityAttribute(res, entity_id, entity_type, "role", "admin");
        }).then(function () {
          throw new Error("unexpected... the user can set the role without being admin!");
        }, function handlereject(error) {
          if (error.statusCode == "403" && error.conflicts.length > 0)
            done();
        });
    });

    it('should resolve  when attempting to update  an entity attribute with the proper role', function (done) {
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
          return idmcore.setEntityAttribute(admin_auth, entity_id, entity_type, "role", "admin");
        }).then(function () {
          done();
        }, function handlereject(error) {
          throw error;
        });
    });

  });

  describe('#deleteEntityAttribute()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {

      cleanDb(done);
    });

    it('should resolve  when attempting to update  an entity attribute with the proper role', function (done) {
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
          return idmcore.deleteEntityAttribute(admin_auth, entity_id, entity_type, "password");
        }).then(function (res) {
          return idmcore.readEntity(admin_auth, res.id, res.type);
        }).then(function (res) {
          if (!res.hasOwnProperty("password"))
            done();
        }, function handlereject(error) {
          throw error;
        });
    });
  });

});
