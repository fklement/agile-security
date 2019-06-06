var IdmCore = require('../index');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var rmdir = require('rmdir');
var fs = require('fs');
var clone = require('clone');
var conf = require('./entity-policies-conf');
var Pdp = require('agile-policies').pdp;
var Pap = require('agile-policies').pap;
var dbName = conf.storage.dbName;
//override this object to get the pap for creating the fist user.
IdmCore.prototype.getPap = function () {
  return this.pap;
};

IdmCore.prototype.getStorage = function () {
  return this.storage;
}
var idmcore = new IdmCore(conf);
var pdp = new Pdp(conf);
var pap = new Pap(conf);

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
      return Promise.all([
        idmcore.createEntityAndSetOwner(admin_auth, alice_info_auth.id, alice_info_auth.type, alice_info, alice_info_auth.id),
      ])
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

function resolvePdpAlways(p) {
  return new Promise(function (resolve, reject) {
    p.then(function (r) {
      resolve(true);
    }).catch(function (e) {
      resolve(false);
    })
  });
}

var admin_auth = clone(admin);
admin_auth.id = "bob!@!agile-local";
admin_auth.type = "/user";

function matchExpected(exp, is) {
  if (exp.length !== is.length) {
    return false;
  } else {
    for (var i = 0; i < exp.length; i++) {
      if (exp[i] !== is[i]) {
        return false;
      }
    }
    return true;
  }
}

describe('Api (set Policies in PAP)', function () {
  //needed for the execLesThan loc
  describe('#CreateEntity()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should enable any non-set subfield of actions field in the policy structure to be read and written according to the default policy in actions', function (done) {

      idmcore.setMocks(null, null, null, dbconnection);
      Promise.all([
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, alice_info_auth, "actions")),
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, alice_info_auth, "actions.something")),

        resolvePdpAlways(pdp.canReadPolicyField(admin_auth, alice_info_auth, "actions")),
        resolvePdpAlways(pdp.canReadPolicyField(admin_auth, alice_info_auth, "actions.something")),

        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, admin_auth, "actions")),
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, admin_auth, "actions.something")),

        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, alice_info_auth, "actions")),
        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, alice_info_auth, "actions.something")),

        resolvePdpAlways(pdp.canWriteToPolicyField(admin_auth, alice_info_auth, "actions")),
        resolvePdpAlways(pdp.canWriteToPolicyField(admin_auth, alice_info_auth, "actions.something")),

        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, admin_auth, "actions")),
        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, admin_auth, "actions.something"))

      ]).then(function (res) {
        var array = [true, true, true, true, false, false, true, true, true, true, false, false];
        if (!matchExpected(array, res)) {
          console.log('expected: ' + JSON.stringify(array));
          console.log('got:      ' + JSON.stringify(res));
        } else {
          done();
        }

      }, function handlereject(error) {
        throw error;
      });
    });

    it('should set the highest level for the policy hierarchy to read only (not admin and not owner check)', function (done) {

      idmcore.setMocks(null, null, null, dbconnection);
      Promise.all([
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, alice_info_auth, "policies.policies")),
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, alice_info_auth, "policies.policies.policies")),

        resolvePdpAlways(pdp.canReadPolicyField(admin_auth, alice_info_auth, "policies.policies")),
        resolvePdpAlways(pdp.canReadPolicyField(admin_auth, alice_info_auth, "policies.policies.policies")),

        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, admin_auth, "policies.policies")),
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, admin_auth, "policies.policies.policies")),

        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, alice_info_auth, "policies.policies")),
        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, alice_info_auth, "policies.policies.policies")),

        resolvePdpAlways(pdp.canWriteToPolicyField(admin_auth, alice_info_auth, "policies.policies")),
        resolvePdpAlways(pdp.canWriteToPolicyField(admin_auth, alice_info_auth, "policies.policies.policies")),

        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, admin_auth, "policies.policies")),
        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, admin_auth, "policies.policies.policies"))

      ]).then(function (res) {
        var read = [true, true, true, true, true, true];
        var write = [true, false, true, false, false, false];
        var array = read.concat(write);
        if (!matchExpected(array, res)) {
          console.log('policies do not match!');
          console.log('expected: ' + JSON.stringify(array));
          console.log('got:      ' + JSON.stringify(res));
        } else {

          done();
        }

      }, function handlereject(error) {
        throw error;
      });
    });

    it('should enforce meta policies in the configuration of attributes (policies.role) as meta policies', function (done) {

      idmcore.setMocks(null, null, null, dbconnection);
      Promise.all([
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, alice_info_auth, "role")),
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, alice_info_auth, "policies.role")),

        resolvePdpAlways(pdp.canReadPolicyField(admin_auth, alice_info_auth, "role")),
        resolvePdpAlways(pdp.canReadPolicyField(admin_auth, alice_info_auth, "policies.role")),

        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, admin_auth, "role")),
        resolvePdpAlways(pdp.canReadPolicyField(alice_info_auth, admin_auth, "policies.role")),

        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, alice_info_auth, "role")),
        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, alice_info_auth, "policies.role")),

        resolvePdpAlways(pdp.canWriteToPolicyField(admin_auth, alice_info_auth, "role")),
        resolvePdpAlways(pdp.canWriteToPolicyField(admin_auth, alice_info_auth, "policies.role")),

        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, admin_auth, "role")),
        resolvePdpAlways(pdp.canWriteToPolicyField(alice_info_auth, admin_auth, "policies.role"))

      ]).then(function (res) {
        var read = [true, true, true, true, true, true];
        var write = [false, false, true, true, false, false];
        var array = read.concat(write);
        if (!matchExpected(array, res)) {
          console.log('policies do not match!');
          console.log('expected: ' + JSON.stringify(array));
          console.log('got:      ' + JSON.stringify(res));
        } else {

          done();
        }

      }, function handlereject(error) {
        throw error;
      });
    });

  });
});
