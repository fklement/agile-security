var Pap = require('./pap');
var createError = require('http-errors');
var console = require('./log');
var upfront = require('UPFROnt');
var pep = upfront.pep;
var clone = require('clone');
var util = require('./util');

var Pep = function (conf) {
  console.log("intializing Pep: ");
  this.pap = new Pap(conf);
  this.conf = util.buildConfig(conf);

};

/*function removeUndefinedRecursively(obj) {
  for (var prop in obj) {
    if (obj[prop] === undefined) {
      delete obj[prop];
    } else if (typeof obj[prop] === 'object')
      removeUndefinedRecursively(obj[prop]);
  }
}*/

//TODO this function needs to resolve regardless of whether the call is performed with an entity or a group as the second argment.
Pep.prototype.declassify = function (userInfo, entityInfo) {
  console.log("arguments for declassify " + JSON.stringify(arguments));
  var that = this;
  //entityInfo.type = entityInfo.type.substring(1);
  //userInfo.type = userInfo.type.substring(1);
  console.log("arguments for canRead " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    //TODO remove this once the proper policy declassification has been tested and integrated
    upfront.init(that.conf.upfront).then(function () {
      var groups = entityInfo.groups;
      console.log("checking whether user with id " + userInfo.id + " can read entity " + JSON.stringify(entityInfo));
      var ps = [that.pap.getEntityPolicyRecord(entityInfo.id, entityInfo.type),
        that.pap.getAttributePolicy(userInfo.id, userInfo.type)
      ];
      return Promise.all(ps);
    }).then(function (policies) {
      var userInfoPolicy = policies[0];
      console.log("calling Pep to declassify  entity with id " + entityInfo.id + " for user  " + userInfo.id);
      console.log("arguments: ");
      console.log("             " + JSON.stringify(entityInfo));
      console.log("             " + JSON.stringify(policies[0]));
      console.log("             " + JSON.stringify(userInfo));
      console.log("             " + JSON.stringify(policies[1]));
      var u = clone(userInfo);
      //u.id = that.pap.serializeId(userInfo.id, userInfo.type);
      return pep.declassify(clone(entityInfo), policies[0], u, policies[1]);
    }).then(function (filteredObject) {
      resolve(filteredObject);
    }, reject);

  });
};

Pep.prototype.declassifyArray = function (userInfo, entitiesArray) {
  var promises = [];
  var that = this;
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      for (var i in entitiesArray)
        promises.push(that.declassify(userInfo, entitiesArray[i]));
      return Promise.all(promises);
    }).then(function (entitiesResult) {
      resolve(entitiesResult);
    }, function (cause) {
      reject(cause);
    });
  });
};

module.exports = Pep;
