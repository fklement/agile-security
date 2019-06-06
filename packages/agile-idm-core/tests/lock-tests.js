var IdmCore = require('../index');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var rmdir = require('rmdir');
var fs = require('fs');
var clone = require('clone');
var conf = require('./lock-test-entity-policies-conf');
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
        rmdir(dbName + "_audit", function (err, dirs, files) {
          rmdir(dbName + "_groups", function (err, dirs, files) {
            db = null;
            rmdir(conf.upfront.pap.storage.dbName + "_policies", function (err, dirs, files) {
              done();
            });
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
      return idmcore.createEntityAndSetOwner(admin_auth, alice_info_auth.id, alice_info_auth.type, alice_info, alice_info_auth.id);
    }).then(function () {
      done();
    }, function (err) {
      throw err;
    });
}

//default data for the tests
var token = "6328602477442473";
var alice_info = {
  "user_name": "alice",
  "auth_type": "agile-local",
  "password": "secret",
  "role": "student",
  "owner": "alice!@!agile-local"
};

var alice_info_auth = clone(alice_info);
alice_info_auth.id = "alice!@!agile-local";
alice_info_auth.type = "/user";

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

describe('UsedLessThan lock', function () {
  //needed for the execLesThan loc
  process.env['AUDIT_CONF'] = JSON.stringify(conf.audit);

  describe('#readEntity()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should stop resolving with the password, after five actions on the password field', function (done) {
      done();
      /*
      idmcore.setMocks(null, null, null, dbconnection);
      var pass;
      idmcore.setEntityAttribute(admin_auth, alice_info_auth.id, alice_info_auth.type, "password", "2")
        .then(function (res) {
          return idmcore.readEntity(admin_auth, alice_info_auth.id, alice_info_auth.type);
        }).then(function (res) {
          if (!res.password) {
            return Promise.reject(new Error("cannot see password from the beginning"))
          }
          return idmcore.setEntityAttribute(admin_auth, alice_info_auth.id, alice_info_auth.type, "password", "2")
        }).then(function (res) {
          return idmcore.setEntityAttribute(admin_auth, alice_info_auth.id, alice_info_auth.type, "password", "2")
        }).then(function (res) {
          return idmcore.setEntityAttribute(admin_auth, alice_info_auth.id, alice_info_auth.type, "password", "2")
        }).then(function (res) {
          return idmcore.readEntity(admin_auth, alice_info_auth.id, alice_info_auth.type);
        }).then(function (read) {
          /*if(read.password){
            console.log('still can see the password after more than 5 actions with it!')
          }
          else {

          }
        }, function handlereject(error) {
          throw error;
        });*/
    });

  });

});
