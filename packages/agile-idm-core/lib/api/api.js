var Storage = require('agile-idm-entity-storage').Storage;
var Pdp = require('agile-policies').pdp;
var Pap = require('agile-policies').pap;
var Pep = require('agile-policies').pep;
var createError = require('http-errors');
var Validator = require('../validation/validator');
var console = require('../log.js');
var lo = require('lodash');

function serializeGroupId(group_name, owner) {
  return group_name + "###" + owner;
}
var Api = function (conf) {

  this.validator = new Validator(conf);
  this.storage = new Storage(conf);
  this.pdp = new Pdp(conf);
  this.pap = new Pap(conf);
  this.pep = new Pep(conf);
  this.forbiddenNames = conf['forbidden-attribute-names'] || [];
  console.log('initializing api');
};

Api.prototype.createEntity = function (auth_result, entity_id, entity_type, entity) {
  console.log('api: creating promise for creation of entity and setting owner to user executing the request');
  var that = this;
  var owner = auth_result.owner;
  return that.createEntityAndSetOwner(auth_result, entity_id, entity_type, entity, owner);
};

Api.prototype.createEntityAndSetOwner = function (auth_result, entity_id, entity_type, entity, owner) {
  console.log('api: creating promise for creation of entity with owner ' + owner);
  var that = this;
  var p = new Promise(function (resolve, reject) {
    that.readEntity(auth_result, entity_id, entity_type)
      .then(function (entity) {
        console.log('rejecting entity creation because entity was there already!');
        //oops... the entity is there! don't do anything else. Specially. Don't override default policies
        return Promise.reject(createError(409, ' creating entity with id ' + entity_id + ' and type ' + entity_type + ' already exists'));
      }).catch(function (err) {
        if (err.statusCode === 409) {
          console.log('rejecting with ' + err);
          return Promise.reject(err);
        } else {
          //we get rid of the parts that every entity must have
          var id = entity.id
          var type = entity.type
          var owner = entity.owner
          delete entity.id;
          delete entity.type;
          delete entity.owner;
          //it's OK it shoudl not have been there...
          that.forbiddenNames.forEach(function (v) {
            if (lo.get(entity, v)) {
              reject(createError(409, 'use of a forbidden attribute name ' + v))
            }
          });
          //put the parts back
          entity.id = id
          entity.type = type
          entity.owner = owner
          return that.validator.validatePromise(entity_type, entity);
        }
      }).then(function () {

        console.log("api:  validation passed");
        return that.pap.setDefaultEntityPolicies(entity_id, entity_type);
      }).then(function () {
        console.log("api: checking whether usre can write to all attributes of entity with id " + entity_id + " and with type " + entity_type + " and with owner " + owner + "and with attributes " + JSON.stringify(entity));
        return that.pdp.canWriteToAllAttributes(auth_result, entity, entity_id, entity_type, owner);
      }).then(function () {
        console.log("api: creating entity with id " + entity_id + " and with type " + entity_type + " and with owner " + owner + "and with attributes " + JSON.stringify(entity));
        return that.storage.createEntity(entity_id, entity_type, owner, entity);
      }).then(function handleResolve(storageresult) {
        console.log("api:  entity created");
        console.log("api: declassification of the entity ");
        return that.pep.declassify(auth_result, storageresult);
      }).then(function (declassified) {
        console.log("api: resolving with declassified " + JSON.stringify(declassified));
        resolve(declassified);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
  return p;
};

Api.prototype.readEntity = function (auth_result, entity_id, entity_type) {
  console.log('api: creating promise for reading entity');
  var that = this;
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readEntity(entity_id, entity_type)
      .then(function handleResolve(storresult) {
        console.log("api:  entity found ");
        console.log("api:  checking whether user can read it ");
        storageresult = storresult;
        return that.pdp.canRead(auth_result, storageresult);
      }).then(function () {
        console.log("api: declassification of the entity ");
        return that.pep.declassify(auth_result, storageresult);
      }).then(function (declassified) {
        console.log("api: resolving with declassified " + JSON.stringify(declassified));
        resolve(declassified);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.listEntitiesByEntityType = function (auth_result, entity_type) {
  console.log('api: creating promise for searching entities based on  type');
  var that = this;
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.listEntitiesByEntityType(entity_type)
      .then(function handleResolve(storresult) {
        console.log("api:  entiies found ");
        storageresult = storresult;
        //filter the ones the user cannot read
        return that.pdp.canReadArray(auth_result, storageresult);
      }).then(function (subset) {
        console.log("api:  filtered entities  by policy compliance");
        return that.pep.declassifyArray(auth_result, subset);
      }).then(function (declassifiedArray) {
        console.log("api:  array declasiffied ");
        resolve(declassifiedArray);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.listEntitiesByAttributeValueAndType = function (auth_result, attribute_constraints, entity_type) {
  console.log('api: creating promise for searching entities based on attribute and type');
  var that = this;
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.listEntitiesByAttributeValueAndType(attribute_constraints, entity_type)
      .then(function handleResolve(storresult) {
        console.log("api:  entiies found ");
        storageresult = storresult;
        //filter the ones the user cannot read
        return that.pdp.canReadArray(auth_result, storageresult);
      }).then(function (subset) {
        console.log("api:  filtered entities  by policy compliance");
        return that.pep.declassifyArray(auth_result, subset);
      }).then(function (declassifiedArray) {
        console.log("api:  array declasiffied ");
        var reutrnValue = declassifiedArray.filter(function (entity) {
          var total = 0;
          attribute_constraints.forEach(function (constraint) {
            if (entity.hasOwnProperty(constraint.attribute_type))
              total = total + 1;
          });
          //only if the user is allowed to read every attribute used as a constraint. Otherwise... indirect flows happen :(
          return total === attribute_constraints.length;
        });
        resolve(reutrnValue);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};
//equivalent of update
Api.prototype.setEntityAttribute = function (auth_result, entity_id, entity_type, attribute_name, attribute_value) {
  var that = this;
  console.log('api: creating promise for for setting attribute for entity ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readEntity(entity_id, entity_type)
      .then(function (storresult) {
        console.log('api: entity found for update');
        console.log('api: checking whether user can update attribute');
        storageresult = storresult;
        return that.pdp.canWriteToAttribute(auth_result, storageresult, attribute_name, attribute_value);
      }).then(function () {
        var obj = {}
        lo.set(obj, attribute_name, attribute_value)
        that.forbiddenNames.forEach(function (v) {
          if (lo.get(obj, v)) {
            reject(createError(409, 'use of a forbidden attribute name ' + v));
          }
        });
      }).then(function () {
        console.log('api: pdp for attribute setting was ok');
        lo.set(storageresult, attribute_name, attribute_value);
        return that.validator.validatePromise(entity_type, storageresult);
      }).then(function () {
        console.log('api:validation for attribute update was ok');
        return that.storage.updateEntity(entity_id, entity_type, storageresult);
      }).then(function handleResolve(data) {
        console.log("api: declassification of the entity ");
        return that.pep.declassify(auth_result, data);
      }).then(function (declassified) {
        console.log("api: resolving with declassified " + JSON.stringify(declassified));
        resolve(declassified);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });

};

Api.prototype.deleteEntityAttribute = function (auth_result, entity_id, entity_type, attribute_name) {
  var that = this;
  console.log('api: creating promise for for deletion of attribute for entity ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readEntity(entity_id, entity_type)
      .then(function (storresult) {
        console.log('api: entity found for update');
        console.log('api: checking whether user can delete attribute');
        storageresult = storresult;
        return that.pdp.canDeleteAttribute(auth_result, storageresult, attribute_name);
      }).then(function () {
        var obj = {}
        lo.set(obj, attribute_name, '')
        that.forbiddenNames.forEach(function (v) {
          if (lo.get(obj, v)) {
            reject(createError(409, 'use of a forbidden attribute name ' + v));
          }
        });
      }).then(function () {
        console.log('api: pdp for attribute deletion was ok');
        lo.unset(storageresult, attribute_name);
        return that.validator.validatePromise(entity_type, storageresult);
      }).then(function () {
        console.log('api:validation for attribute deletion was ok');
        return that.storage.updateEntity(entity_id, entity_type, storageresult);
      }).then(function handleResolve(data) {
        console.log("api: declassification of the entity ");
        return that.pep.declassify(auth_result, data);
      }).then(function (declassified) {
        console.log("api: resolving with declassified " + JSON.stringify(declassified));
        resolve(declassified);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });

};

Api.prototype.deleteEntity = function (auth_result, entity_id, entity_type, entity) {
  var that = this;
  console.log('api: creating promise for for entity deletion ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readEntity(entity_id, entity_type)
      .then(function (storresult) {
        console.log('api: entity found for update');
        storageresult = storresult;
        return that.pdp.canDelete(auth_result, storageresult);
      }).then(function () {
        console.log('api: pdp for update ok');
        return that.storage.deleteEntity(entity_id, entity_type);
      }).then(function handleResolve() {
        resolve();
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.readGroup = function (auth_result, group_name, owner) {
  console.log('api: creating promise for reading entity');
  var that = this;
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readGroup(group_name, owner)
      .then(function handleResolve(storresult) {
        console.log("api:  group found ");
        storageresult = storresult;
        //  return that.pdp.canRead(auth_result, storageresult);
        //}).then(function () {
        resolve(storageresult);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.readGroups = function (auth_result) {
  console.log('api: creating promise for searching entities based on attribute and type');
  var that = this;
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.listGroups()
      .then(function handleResolve(storresult) {
        console.log("api:  groups found ");
        storageresult = storresult;
        //filter the ones the user cannot read
        //return that.pdp.canReadArray(auth_result, storageresult);
        //}).then(function (subset) {
        resolve(storageresult);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.createGroup = function (auth_result, group_name) {
  console.log('api: creating promise for creation of group' + JSON.stringify(arguments));
  var that = this;
  var p = new Promise(function (resolve, reject) {
    var owner;
    var storageresult;
    owner = auth_result.owner;
    console.log("api: creating group with name " + group_name + " and owner " + owner);

    that.pap.setDefaultEntityPolicies(serializeGroupId(group_name, owner), "/group")
      .then(function handleResolve(policyCreateResult) {
        console.log("api: result of creation of policies for group " + JSON.stringify(policyCreateResult));
        return that.storage.createGroup(group_name, owner);
      }).then(function handleResolve(storageresult) {
        console.log("api:  group created");
        resolve(storageresult);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
  return p;
};

Api.prototype.deleteGroup = function (auth_result, group_name, owner, entity) {
  var that = this;
  console.log('api: creating promise for for group deletion ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readGroup(group_name, owner)
      .then(function (storresult) {
        console.log('api: group found for delete');
        storageresult = storresult;
        storresult.id = serializeGroupId(group_name, owner);
        storresult.type = "/group";
        return that.pdp.canDelete(auth_result, storageresult);
      }).then(function () {
        console.log('api: pdp for delete ok');
        return that.storage.deleteGroup(group_name, owner);
      }).then(function handleResolve() {
        console.log('api: pdp for delete ok');
        resolve();
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.addEntityToGroup = function (auth_result, group_name, owner, entity_id, entity_type) {
  var that = this;
  console.log('api: creating promise for adding entity to group ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readGroup(group_name, owner)
      .then(function (storresult) {
        console.log('api: group found for adding an entity to it');
        storageresult = storresult;
        storresult.id = serializeGroupId(group_name, owner);
        storresult.type = "/group";
        return that.pdp.canUpdate(auth_result, storageresult);
      }).then(function () {
        console.log('api: pdp for updating group   ok');
        return that.storage.addEntityToGroup(group_name, owner, entity_id, entity_type);
      }).then(function handleResolve(entity) {
        console.log('api: pdp add entity to group ok');
        console.log("api: declassification of the entity ");
        return that.pep.declassify(auth_result, entity);
      }).then(function (declassified) {
        console.log("api: resolving with declassified " + JSON.stringify(declassified));
        resolve(declassified);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.removeEntityFromGroup = function (auth_result, group_name, owner, entity_id, entity_type) {
  var that = this;
  console.log('api: creating promise for removing entity from group ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readGroup(group_name, owner)
      .then(function (storresult) {
        console.log('api: group found for removing an entity from it');
        storageresult = storresult;
        storresult.id = serializeGroupId(group_name, owner);
        storresult.type = "/group";
        return that.pdp.canUpdate(auth_result, storageresult);
      }).then(function () {
        console.log('api: pdp for updating group   ok');
        return that.storage.removeEntityFromGroup(group_name, owner, entity_id, entity_type);
      }).then(function handleResolve(entity) {
        console.log('api: pdp remove entity from group ok');
        console.log("api: declassification of the entity ");
        return that.pep.declassify(auth_result, entity);
      }).then(function (declassified) {
        console.log("api: resolving with declassified " + JSON.stringify(declassified));
        resolve(declassified);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.setStorage = function (storage) {
  this.storage = storage;
};
//NOTE this functiones are just used for testing
Api.prototype.setMocks = function (val, store, pdp, storeconn, pep) {

  if (val)
    this.validator = val;
  if (store)
    this.storage = store;
  if (storeconn)
    this.storage.setConnectionMockup(storeconn);
  if (pdp)
    this.pdp = pdp;
  if (pep)
    this.pep = pep;
};

Api.prototype.getEntityPolicies = function (auth_result, entity_id, entity_type) {
  var that = this;
  console.log('api: creating promise for reading policies of entity ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {

    that.readEntity(auth_result, entity_id, entity_type).then(function (entity) {
      return that.pdp.canReadEntityPolicies(auth_result, entity);

    }).then(function () {
      return that.pap.getEntityPolicies(entity_id, entity_type);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    }).then(function handleResolve(policies) {
      console.log('api: pdp reading policies of entity ok');
      resolve(policies);
    });
  });
};

Api.prototype.getFieldPoliciy = function (auth_result, entity_id, entity_type, field) {
  var that = this;
  console.log('api: creating promise for reading policies of entity ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {

    that.readEntity(auth_result, entity_id, entity_type).then(function (entity) {
      return that.pdp.canReadEntityPolicies(auth_result, entity);
    }).then(function () {
      return that.pap.getAttributePolicy(entity_id, entity_type, field);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    }).then(function handleResolve(policies) {
      console.log('api: pdp reading policies of entity ok');
      resolve(policies);
    });
  });
};

Api.prototype.setEntityPolicy = function (auth_result, entity_id, entity_type, property, policy) {
  var that = this;
  console.log('api: creating promise for setting policies of entity ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readEntity(entity_id, entity_type)
      .then(function (storresult) {
        console.log('api: entity found for setting policy');
        storageresult = storresult;
        return that.pdp.canSetEntityPolicy(auth_result, storageresult);
      }).then(function () {
        console.log('api: pdp for setting policy ok');
        return that.pap.setEntityPolicy(entity_id, entity_type, property, policy);
      }).then(function handleResolve(entity) {
        resolve(entity);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

Api.prototype.deleteEntityPolicy = function (auth_result, entity_id, entity_type, policy_name) {
  var that = this;
  console.log('api: creating promise for for deletion of attribute for entity ' + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readEntity(entity_id, entity_type)
      .then(function (storresult) {
        console.log('api: entity found for update');
        console.log('api: checking whether user can delete attribute');
        storageresult = storresult;
        return that.pdp.canDeletePolicy(auth_result, storageresult);
      }).then(function () {
        console.log('api: pdp for policy deletion was ok');
        return that.pap.deleteEntityPolicy(entity_id, entity_type, policy_name);
      }).then(function handleResolve(data) {
        console.log("api: declassification of the entity ");
        return resolve(data);
      }, function handleReject(error) { //catch all rejections here we can't recover from any of them
        console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
        reject(error);
      });
  });
};

module.exports = Api;
