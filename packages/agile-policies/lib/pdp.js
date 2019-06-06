var Pap = require('./pap');
var createError = require('http-errors');
var console = require('./log');
var upfront = require('UPFROnt');
var pdp = upfront.pdp;
var clone = require('clone');
var util = require('./util');
var Audit = require('agile-audit');

var Pdp = function (conf) {
  console.log("intializing pdp");
  var that = this;
  this.pap = new Pap(conf);
  //if env not there  also do audit. Only avoid audit if explicitly forced
  if (!process.env.NO_AUDIT || process.env.NO_AUDIT !== "1") {
    //If we configure audit. There may be a lock somwhere that needs this...
    process.env['AUDIT_CONF'] = JSON.stringify(conf.audit);
    console.log('PDP setting env variable for audit: '+JSON.stringify(conf.audit))
    this.audit = new Audit(conf.audit);
  }
  that.conf = util.buildConfig(conf);
};

/*

canReadPolicyField and canWriteToPolicyField
Are the two building blocks for policy evaluation.....

These are the onlyones that need to do the logging!

*/
// This function checks whether a user can read a particular entity attribute (or action if it is pointing to the action-policy-root.someaction)
Pdp.prototype.canReadPolicyField = function (userInfo, entityInfo, attributeName) {
  var that = this;
  console.log("arguments for canRead " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      console.log("checking whether user with id " + userInfo.id + " can read attribute " + attributeName + " from entity " + JSON.stringify(entityInfo));
      var ps = [that.pap.getAttributePolicy(userInfo.id, userInfo.type),
        that.pap.getAttributePolicy(entityInfo.id, entityInfo.type, attributeName)
      ];
      return Promise.all(ps);
    }).then(function (policies) {
      var userInfoPolicy = policies[0];
      console.log("calling pdp to check wether " + userInfo.id + " can read attribute " + attributeName + " from " + entityInfo.id);
      console.log("arguments: ");
      console.log("             " + JSON.stringify(userInfo));
      console.log("             " + JSON.stringify(policies[0]));
      console.log("             " + JSON.stringify(entityInfo));
      console.log("             " + JSON.stringify(policies[1]));
      return pdp.checkRead(
        userInfo, policies[0],
        entityInfo,
        policies[1]);
    }).then(function (decision) {
      console.log("pdp decision " + JSON.stringify(decision));
      if (decision.result === true) {
        if (!process.env.NO_AUDIT || process.env.NO_AUDIT !== "1") {
          that.audit.log(1, userInfo, entityInfo, attributeName).then(function () {
            resolve();
          }).catch(reject)
        } else {
          resolve();
        }

      } else {
        var err = createError(403, "policy does not allow  the user (or entity authenticated) to perform the read action");
        err.conflicts = decision.conflicts;
        reject(err);
      }
    }, reject);

  });
};

Pdp.prototype.canWriteToPolicyField = function (userInfo, entityInfo, attributeName, attributeValue) {
  var that = this;
  console.log("arguments for canWriteToPolicyField " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      var ps = [that.pap.getAttributePolicy(userInfo.id, userInfo.type),
        that.pap.getAttributePolicy(entityInfo.id, entityInfo.type, attributeName)
      ];
      return Promise.all(ps);
    }).then(function (policies) {

      var userInfoPolicy = policies[0];
      console.log("calling pdp to check wether " + userInfo.id + " can write to " + entityInfo.id + " in attribute " + attributeName);
      console.log("arguments: ");
      console.log("             " + JSON.stringify(userInfo));
      console.log("             " + JSON.stringify(policies[0]));
      console.log("             " + JSON.stringify(entityInfo));
      console.log("             " + JSON.stringify(policies[1]));
      return pdp.checkWrite(
        userInfo,
        policies[0],
        entityInfo,
        policies[1]);
    }).then(function (decision) {
      console.log("pdp decision " + JSON.stringify(decision));
      if (decision.result === true) {
        if (!process.env.NO_AUDIT || process.env.NO_AUDIT !== "1") {
          that.audit.log(1, userInfo, entityInfo, attributeName).then(function () {
            resolve();
          }).catch(reject)
        } else {
          resolve();
        }

      } else {
        var err = createError(403, "policy does not allow  the user (or entity authenticated) to set attribute");
        err.conflicts = decision.conflicts;
        reject(err);
      }
    }, reject);

  });
};

//The rest of the calls do not need to do logging.

/*
  Other calls to check when processing several attributes or entities in IDM

*/

Pdp.prototype.canWriteToAllAttributes = function (userInfo, entityInfo, entity_id, entity_type, entity_owner) {
  var that = this;
  console.log("arguments for canWriteToAllAttributes " + JSON.stringify(arguments));
  //promise that always resolves to collect all errors.
  function buildPromise(userInfo, entityInfo, entity_type,
    entity_id, attributeName, attributeValue, entity_owner) {

    return new Promise(function (resolve, reject) {
      entityInfo = clone(entityInfo);
      entityInfo.id = entity_id;
      entityInfo.type = entity_type;
      entityInfo.owner = entity_owner;
      userInfo = clone(userInfo);
      userInfo.type = userInfo.type;
      console.log("building single promise for canWriteToPolicyField  user" + JSON.stringify(userInfo));
      console.log("building single promise for canWriteToPolicyField  entity" + JSON.stringify(entityInfo));
      that.canWriteToPolicyField(userInfo, entityInfo,
        attributeName,
        attributeValue
      ).then(function (result) {
        resolve({
          result: true
        });
      }, function (er) {
        resolve({
          result: false,
          conflicts: er.conflicts
        });
      });
    });
  }
  //now we start with the code
  return new Promise(function (resolve, reject) {
    var promises = [];
    var keys = Object.keys(entityInfo);
    upfront.init(that.conf.upfront).then(function () {

      for (var i in keys) {
        promises.push(buildPromise(userInfo,
          entityInfo,
          entity_type,
          entity_id,
          keys[i],
          entityInfo[keys[i]],
          entity_owner));
      }
      return Promise.all(promises);
    }).then(function (pdpResult) {
      var errors = "policy does not allow the user (or entity authenticated) with id " + userInfo.id + " to set the entity with id " + entity_id + " and type " + entity_type + ". Spefifically the following attributes are not allowed: ";
      var count = 0;
      var conflicts = [];
      for (var i in pdpResult) {
        if (pdpResult[i].result !== true) {
          count = count + 1;
          errors = errors + " " + keys[i];
          conflicts.push({
            "attribute": keys[i],
            "conf": pdpResult[i].conflicts
          });
        }
      }
      if (count > 0) {
        console.log("policy does not allow the user (or entity authenticated) with id " + userInfo.id + " to set the entity with id " + entity_id + " and type " + entity_type);
        console.log("Conflicts for policy " + JSON.stringify(conflicts));
        var err = createError(403, errors);
        err.conflicts = conflicts;
        return reject(err);
      } else
        return resolve();
    }, function (cause) {
      reject(cause);
    });
  });
};

//resolves with an array of entities that can be read (each entry in the array is an entity)
Pdp.prototype.canReadArray = function (userInfo, entitiesArray) {

  //wrapper so that pdp doesn't reject, gut just continues and returns an empty response
  function buildPromiseReadAcc(that, userInfo, entity) {
    return new Promise(function (res, rej) {
      that.canRead(userInfo, entity).then(function () {
        console.log('user can read entity ' + JSON.stringify(entity));
        res(entity);
      }, res); //NOTE if not possible to read we still resolve but don't add it to the resultset
    });
  }

  var promises = [];
  var that = this;
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      for (var i in entitiesArray)
        promises.push(buildPromiseReadAcc(that, userInfo, entitiesArray[i]));
      return Promise.all(promises);
    }).then(function (entitiesResult) {
      resolve(entitiesResult);
    }, function (cause) {
      reject(cause);
    });
  });
};

/*
  Policies at the entity level. //TODO check whether we should keep this one like this or use actions.self
*/
//this function resolves regardless of whether the call is performed with an entity or a group as the second argment.
Pdp.prototype.canRead = function (userInfo, entityInfo) {
  var that = this;
  console.log("arguments for canRead " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      console.log("checking whether user with id " + userInfo.id + " can read entity " + JSON.stringify(entityInfo));
      var ps = [that.pap.getAttributePolicy(userInfo.id, userInfo.type),
        that.pap.getAttributePolicy(entityInfo.id, entityInfo.type)
      ];
      return Promise.all(ps);
    }).then(function (policies) {
      var userInfoPolicy = policies[0];
      console.log("calling pdp to check wether " + userInfo.id + " can read to " + entityInfo.id);
      console.log("arguments: ");
      console.log("             " + JSON.stringify(userInfo));
      console.log("             " + JSON.stringify(policies[0]));
      console.log("             " + JSON.stringify(entityInfo));
      console.log("             " + JSON.stringify(policies[1]));
      return pdp.checkRead(
        userInfo, policies[0],
        entityInfo,
        policies[1]);
    }).then(function (decision) {
      console.log("pdp decision " + JSON.stringify(decision));
      if (decision.result === true)
        resolve();
      else {
        var err = createError(403, "policy does not allow  the user (or entity authenticated) to read the entity ");
        err.conflicts = decision.conflicts;
        reject(err);
      }
    }, reject);

  });
};

Pdp.prototype.canDelete = function (userInfo, entityInfo) {
  return this.canUpdate(userInfo, entityInfo);

};

//for now this is required to check when a user can put an entity in a group. In this case we check whether the user can change the group
Pdp.prototype.canUpdate = function (userInfo, entityInfo) {
  var that = this;
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      return that.canWriteToPolicyField(userInfo, entityInfo, that.conf.policies['action-policy-root'].attribute + ".self");
    }).then(function (res) {
      resolve(res);
    }).catch(reject);
  });
};

/*
Check if users can update policies
*/

Pdp.prototype.canReadEntityPolicies = function (userInfo, entityInfo) {
  var that = this;
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      return that.canReadPolicyField(userInfo, entityInfo, that.conf.policies['policy-policy-root'].attribute);
    }).then(function (res) {
      resolve(res);
    }).catch(reject);
  });
};

//for now this is required to check when a user can put an entity in a group. In this case we check whether the user can change the group
Pdp.prototype.canSetEntityPolicy = function (userInfo, entityInfo) {
  var that = this;
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      return that.canWriteToPolicyField(userInfo, entityInfo, that.conf.policies['policy-policy-root'].attribute);
    }).then(function (res) {
      resolve(res);
    }).catch(reject);
  });
};

Pdp.prototype.canWriteToPolicy = function (userInfo, entityInfo, policyName, policy) {
  var that = this;
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      return that.canWriteToPolicyField(userInfo, entityInfo, that.conf.policies['policy-policy-root'].attribute + policyName);
    }).then(function (res) {
      resolve(res);
    }).catch(reject);
  });
};

//for now we treat update as delete...
Pdp.prototype.canDeletePolicy = Pdp.prototype.canSetEntityPolicy;

//These are functions called from IDM, for attributes. They map internally to policy fields
Pdp.prototype.canReadEntityAttribute = Pdp.prototype.canReadToPolicyField;

Pdp.prototype.canWriteToAttribute = Pdp.prototype.canWriteToPolicyField;
//for now we treat update as delete...
Pdp.prototype.canDeleteAttribute = Pdp.prototype.canWriteToPolicyField;

module.exports = Pdp;
