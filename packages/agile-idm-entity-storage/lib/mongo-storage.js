var clone = require('clone');
var createError = require('http-errors');
var console = require('./log');
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb').MongoClient);
var lo = require('lodash');
const entityIndex = {
  id: 1,
  type: 1
}
const groupIndex = {
  group_name: 1,
  owner: 1
}

var MongoStorage = function () {

};

//create tables and prepared statements
MongoStorage.prototype.init = function (storageConf) {
  var that = this;
  if (that.entities || that.groups)
    throw createError(500, "already initialized");

  return mongoClient.connect('mongodb://' + storageConf.user + ':' + storageConf.password + '@' + storageConf.host + '/' + storageConf.dbName).then(db => {
    that.db = db
    return db
  }).then(db => {
    return that.db.collection(storageConf.entityCollection)
  }).then(eColl => {
    that.entities = eColl
    return new Promise((resolve, reject) => {
      that.entities.createIndex({
        id: 1,
        type: 1
      }, {
        unique: true
      }, (err, res) => {
        resolve()
      })
    })
  }).then(() => {
    return that.db.collection(storageConf.groupCollection)
  }).then(gColl => {
    that.groups = gColl
    return new Promise((resolve, reject) => {
      return that.groups.createIndex({
        group_name: 1,
        owner: 1
      }, {
        unique: true
      }, (err, res) => {
        resolve()
      })
    })
  }).then(() => {
    return that
  }).catch(err => {
    throw createError(500, 'Could not connect to mongodb: ' + err)
  })
};

//helpers to build and print pks...
function buildEntityPk(entity_id, entity_type) {
  return {
    id: entity_id,
    type: entity_type
  };
}

function buildGroupPk(group_name, owner) {
  return {
    group_name: group_name,
    owner: owner
  };
}

function getPk(action_type, data) {
  if (action_type === "entities")
    return {
      id: data.id,
      type: data.type
    };
  else if (action_type === "groups")
    return {
      group_name: data.group_name,
      owner: data.owner
    };
  else throw createError(500, "programmer mistake... attempting to get pk for unkown entity " + action_type);
}

function pkToString(pk) {
  return JSON.stringify(pk);
}

//helpers to resolve return object with pk+entity data
//this function contemplates that owner can be null, e.g. when called for a group; however the owner is already part of entity.
//Therefore so the result always contains an owner.
function buildReturnObject(pk, data, owner) {
  var entity = clone(data);
  Object.keys(pk).forEach(function (key) {
    entity[key] = pk[key];
  });
  if (owner)
    entity.owner = owner;
  return entity;
}

//creates an object in a given level db connection (action_type)
function createSomething(action_type, pk, owner, data, transaction) {
  if (!transaction)
    throw new createError(500, "call without a transaction to createSomething");
  return new Promise((resolve, reject) => {
    transaction.findOne(pk).then(res => {
      if (!res) {
        var entity = buildReturnObject(pk, data, owner);
        return transaction.insertOne(entity)
      } else {
        reject(createError(409, action_type + ' with pk ' + pkToString(pk) + ' already exists'))
      }
    }).then(() => {
      if (action_type === 'entities' || action_type === 'groups') {
        return transaction.indexInformation((err, indexes) => {
          if (err && err.code === 26) {
            return {}
          } else if (err) {
            handleError(err, reject)
          } else if (indexes && Object.keys(indexes).length === 1) {
            delete indexes['_id_']
            console.log('creating indexes for', action_type)
            console.log('existing indexes:', indexes)
            return new Promise((resolve, reject) => {
              transaction.createIndex(action_type === 'entities' ? entityIndex : groupIndex, {
                unique: true
              }, (err, res) => {
                resolve()
              })
            })
          } else {
            return {}
          }
        })
      } else {
        return {}
      }
    }).then(() => {
      return transaction.findOne(pk)
    }).then(res => {
      if (!res)
        reject(createError(500, 'cannot read ' + action_type + ' with pk ' + pkToString(pk) + ' after creating it'));
      else {
        if (res && res._id)
          delete res._id
        resolve(res)
      }
    });
  })
}

//reads an object in a given level db connection (action_type)
function readSomething(action_type, pk, transaction) {
  if (!transaction)
    throw new createError(500, "call without a transaction to readSomething");
  return new Promise(function (resolve, reject) {
    transaction.findOne(pk).then((value, error) => {
      console.log('get for  ' + action_type + ' for pk ' + pkToString(pk) + ' error ' + error + ' data ' + JSON.stringify(value));
      if (!value)
        reject(createError(404, ' read ' + action_type + ' with pk ' + pkToString(pk) + '  not found'));
      else {
        console.log('found ' + action_type + ' for pk ' + pkToString(pk) + ' resolving with ' + JSON.stringify(value));
        if (value && value._id)
          delete value._id
        resolve(value);
      }
    });
  });
}

//updates an object in a given level db connection (action_type)
function updateSomething(action_type, pk, data, transaction) {
  if (!transaction)
    throw createError(500, "call without a transaction to updateSomething");
  return new Promise(function (resolve, reject) {
    transaction.findOne(pk).then((value, error) => {
      if (!value)
        reject(createError(404, ' cannot update ' + action_type + ' with pk ' + pkToString(pk) + ' it was  not found'))
      else if (error)
        handleError(error, reject);
      else {
        console.log('database object found with pk ' + pkToString(pk));
        var entity = buildReturnObject(pk, data, value.owner);
        console.log('updating', value, 'to', entity);
        if (value && value._id)
          delete value._id
        return transaction.findOneAndUpdate(pk, entity)
      }
    }).then((res, error) => {
      if (error)
        handleError(error, reject);

      return transaction.findOne(pk)
    }).then(value => {
      console.log(action_type + ' updated successfully. Value ' + JSON.stringify(value));
      if (value && value._id)
        delete value._id
      resolve(value)
    }).catch(err => {
      reject(createError(500, 'cannot read ' + action_type + ' with pk ' + pkToString(pk) + ' after creating it'));
    })
  });
}

//updates an object in a given level db connection (action_type)
function pushSomething(action_type, pk, field, data, transaction) {
  if (!transaction)
    throw createError(500, "call without a transaction to updateSomething");
  return new Promise(function (resolve, reject) {
    transaction.findOne(pk).then((value, error) => {
      if (!value)
        reject(createError(404, ' cannot update ' + action_type + ' with pk ' + pkToString(pk) + ' it was  not found'))
      else if (error)
        handleError(error, reject);
      else {
        console.log('database object found with pk ' + pkToString(pk));
        var entity = buildReturnObject(pk, data, value.owner);
        console.log('updating', value, 'to', entity);
        if (value && value._id)
          delete value._id
        var pushObject = {
          $push: {}
        }
        pushObject['$push'][field] = data
        return transaction.findOneAndUpdate(pk, pushObject)
      }
    }).then((res, error) => {
      if (error)
        handleError(error, reject);

      return transaction.findOne(pk)
    }).then(value => {
      console.log(action_type + ' updated successfully. Value ' + JSON.stringify(value));
      if (value && value._id)
        delete value._id
      resolve(value)
    }).catch(err => {
      reject(createError(500, 'cannot read ' + action_type + ' with pk ' + pkToString(pk) + ' after creating it'));
    })
  });
}

//deletes an object in a given level db connection (action_type)
function deleteSomething(action_type, pk, transaction) {
  if (!transaction)
    throw createError(500, "call without a transaction to deleteSomething");
  return new Promise(function (resolve, reject) {
    transaction.findOneAndDelete(pk).then(res => {
      resolve()
    }).catch(err => {
      handleError(err, reject)
    })
  });
}

//keyAction and dataAction are functions receive the data item as a parameter and return true or false, depending on whether this item should be added to the result list.
//results are only added if both functions return true;
function iterateDbAndSearch(action_type, keyAction, dataAction, transaction) {
  console.log('arguments to iterateDb and Search action type: ' + action_type + 'key action ' + keyAction + ' data action ' + dataAction);
  if (!transaction)
    throw createError(500, "call without a transaction to iterateDbAndSearch");
  return new Promise(function (resolve, reject) {
    transaction.find({}).toArray((err, list) => {
      if (err) {
        console.log('something went wrong while iterating entities in database ' + action_type);
        reject(err)
      } else {
        transaction.indexInformation((err, indexes) => {
          if (err && err.code === 26) {
            resolve([])
          } else if (err) {
            handleError(err, reject)
          } else {
            delete indexes['_id_']
            var results = list.filter(item => {
              var keys = indexes[Object.keys(indexes)[0]]
              var keyO = {}
              keys.forEach(obj => {
                var k = obj[0]
                keyO[k] = item[k]
              })
              return keyAction(keyO) && dataAction(item)
            }).map(item => {
              if (item._id) {
                delete item._id
              }
              var keys = indexes[Object.keys(indexes)[0]]
              var keyO = {}
              keys.forEach(obj => {
                var k = obj[0]
                keyO[k] = item[k]
              })
              return buildReturnObject(keyO, item, null);
            })
            // console.log(results)
            console.log('resolving array after query with ' + JSON.stringify(results));
            resolve(results)
          }
        })
      }
    })
  })
}

function acquireLock(db, action, name, promise) {
  var lock = mongoLocks(db, action, name)
  return new Promise((resolve, reject) => {
    lock.acquire((err, code) => {
      if (err) {
        return reject(err)
      }

      if (code) {
        Promise.resolve(promise).then(res => {
          return releaseLock(lock, code)
        }).then(res => {
          resolve()
        })
      } else {
        reject(err)
      }
    })
  })
}

function releaseLock(lock, code) {
  var that = this
  return new Promise((resolve, reject) => {
    lock.release(code, (err, ok) => {
      if (err) {
        reject(err)
      }
      if (ok) {
        resolve(ok)
      } else {
        reject(err)
        console.log("Lock was not released, perhaps it's already been released or timed out")
      }
    })
  })
}

//used to handle generic 500 errors
//TODO improve to split different errors... PK repeated,... etc
function handleError(error, cb) {
  console.log('mongodb error ocurred ' + JSON.stringify(error));
  console.log(error);
  cb(createError(500, error.message));
}

MongoStorage.prototype.close = function () {
  var that = this;
  return new Promise(function (resolve, reject) {
    // that.entities.close(function (r) {
    //   console.log('entities db closed!');
    //   that.groups.close(function (r) {
    //     console.log('groups db closed!');
    //     resolve();
    //   });
    // });
  });

};
//inserts a entity with the given id and type in the entity table. The given attributes are stored in the attributeValue table regarding to their type (int or string)
MongoStorage.prototype.createEntityPromise = function (entity_id, entity_type, owner, data) {
  console.log("arguments for createEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return createSomething("entities", pk, owner, data, this.entities);
};

/*
Reads entity from the database and returns json
*/
MongoStorage.prototype.readEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for readEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return readSomething("entities", pk, this.entities);
};

//updates the attributes of the entity with the given id
MongoStorage.prototype.updateEntityPromise = function (entity_id, entity_type, data) {
  console.log("arguments for updateEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return updateSomething("entities", pk, data, this.entities);
};

//deletes the entity with the given id and all its attributes
MongoStorage.prototype.deleteEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for deleteEntity leveldb " + JSON.stringify(arguments));

  var that = this;
  var group, entity;
  return new Promise(function (resolve, reject) {
    var pk = buildEntityPk(entity_id, entity_type);
    var t_groups = that.groups;
    var t_entities = that.entities;
    readSomething("entity", pk, t_entities)
      .then(function (entity) {
        var groups = entity.groups;
        var readGroups = [];
        if (groups && groups.length > 0) {
          groups.forEach(function (group_pk) {
            readGroups.push(readSomething("groups", group_pk, t_groups));
          });
          return Promise.all(readGroups);
        } else {
          return Promise.resolve([]); //return an empty set of entities so that the promise chain keeps going :)
        }
      }).then(function (groups) {
        var ps = [];
        groups.forEach(function (g) {
          ps.push(new Promise(function (re, rej) {
            g.entities = g.entities.filter(function (v) {
              return (v.type !== entity_type || v.id !== entity_id);
            });
            updateSomething("groups", buildGroupPk(g.group_name, g.owner), g, t_groups).then(re, rej);
          }));
        });
        return Promise.all(ps);
      }).then(function (res) {
        console.log("finished updating groups by removing entity from their attributes");
        console.log("attempting to delete entity " + JSON.stringify(pk));
        return deleteSomething("entities", pk, t_entities);
      }).then(function () {
        resolve();
      }).catch(function rej(reason) {
        console.log('level storage rejecting ' + reason);
        reject(reason);
      });
  });
};

MongoStorage.prototype.createGroupPromise = function (group_name, owner) {
  console.log("arguments for createGroupPromise leveldb " + JSON.stringify(arguments));
  var group = {};
  group.entities = [];
  var pk = buildGroupPk(group_name, owner);
  return createSomething("groups", pk, owner, group, this.groups);
};

MongoStorage.prototype.readGroupPromise = function (group_name, owner) {
  console.log("arguments for readGroupPromise leveldb " + JSON.stringify(arguments));
  var pk = buildGroupPk(group_name, owner);
  return readSomething("groups", pk, this.groups);
};

MongoStorage.prototype.updateGroupPromise = function (group_name, owner, data) {
  console.log("arguments for updateGroupPromise leveldb " + JSON.stringify(arguments));
  var pk = buildGroupPk(group_name, owner);
  return updateSomething("groups", pk, data, this.groups);
};

MongoStorage.prototype.deleteGroupPromise = function (group_name, owner) {
  console.log("arguments for deleteGroupPromise leveldb " + JSON.stringify(arguments));

  var that = this;
  var group, entity;
  return new Promise(function (resolve, reject) {
    var group_pk = buildGroupPk(group_name, owner);
    var t_groups = that.groups;
    var t_entities = that.entities;
    readSomething("groups", group_pk, t_groups)
      .then(function (group) {
        var entities = group.entities;
        var readEntities = [];
        if (entities && entities.length > 0) {
          entities.forEach(function (entity_pk) {
            readEntities.push(readSomething("entities", entity_pk, t_entities));
          });
          return Promise.all(readEntities);
        } else {
          return Promise.resolve([]); //return an empty set of entities so that the promise chain keeps going :)
        }
      }).then(function (entities) {
        var ps = [];
        entities.forEach(function (e) {
          ps.push(new Promise(function (re, rej) {
            e.groups = e.groups.filter(function (v) {
              return (v.group_name !== group_name || v.owner !== owner);
            });
            updateSomething("entities", getPk("entities", e), e, t_entities).then(re, rej);
          }));
        });
        return Promise.all(ps);
      }).then(function (res) {
        console.log("finished updating entities to remove group from their attributes");
        console.log("attempting to delete group " + JSON.stringify(group_pk));
        return deleteSomething("groups", group_pk, t_groups);
      }).then(function () {
        resolve()
      }).catch(function rej(reason) {
        console.log('level storage rejecting ' + reason);
        reject(reason)
      });
  });
};

MongoStorage.prototype.dropCollectionPromise = function (collection) {
  var that = this
  return new Promise((resolve, reject) => {
    if (that[collection]) {
      return that[collection].drop().then((res, err) => {
        if (!res) reject(createError(500, `Error occurred while dropping collection ${collection}`))
        else resolve()
      }).catch(err => {
        if (err.code === 26) {
          console.log(`Collection ${collection} could not be dropped since it is not existing`)
          resolve()
        } else {
          reject(err)
        }
      })
    } else {
      console.log(`Collection ${collection} could not be dropped since it is not existing`)
      resolve()
    }
  })
}

MongoStorage.prototype.emptyCollectionPromise = function (collection) {
  var that = this
  return new Promise((resolve, reject) => {
    if (that[collection]) {
      that[collection].remove({}).then((err, res) => {
        resolve()
      }).catch(err => {
        if (err.code === 26) {
          console.log(`Collection ${collection} could not be emptied since it is not existing`)
          resolve()
        } else {
          reject(err)
        }
      })
    } else {
      console.log(`Collection ${collection} could not be emptied since it is not existing`)
      resolve()
    }
  })
}

MongoStorage.prototype.addEntityToGroupPromise = function (group_name, owner, entity_id, entity_type) {
  console.log("arguments for AddEntityToGroupPromise leveldb " + JSON.stringify(arguments));
  var that = this;
  var group, entity;

  return new Promise(function (resolve, reject) {
    var group_pk = buildGroupPk(group_name, owner);
    var entity_pk = buildEntityPk(entity_id, entity_type);
    var t_groups = that.groups;
    var t_entities = that.entities;

    readSomething("groups", group_pk, t_groups).then(function (g) {
      group = g;
      console.log(JSON.stringify(group) + 'entities' + group.entities);
      var already_in_group = group.entities.filter(function (v) {
        console.log("processing entity " + JSON.stringify(v) + " in group " + JSON.stringify(group));
        return (v.id == entity_id && v.type == entity_type);
      });
      if (already_in_group.length > 0)
        return reject(createError(409, "entity with id " + entity_id + " and type" + entity_type + " is already in group with group name " + group_name + " owned by " + owner));
      else
        return readSomething("entities", entity_pk, t_entities);
    }).then(function (e) {
      entity = e;
      console.log('got entity ' + entity + entity_id + entity_type);
      if (!entity.hasOwnProperty("groups"))
        entity.groups = [];
      console.log('groups' + entity.groups);
      var already_in_group = entity.groups.filter(function (v) {
        return (v.group_name === group.group_name && v.owner === group.owner);
      });
      if (already_in_group.length > 0) {
        reject(createError(409, "entity with id " + pkToString(getPk("entities", entity)) + " is already in group with group name " + group_name + " owned by " + owner + " seems there is an inconsistency"));
      } else {
        entity.groups.push(getPk("groups", group));
        group.entities.push(getPk("entities", entity));
        return pushSomething("entities", entity_pk, 'groups', getPk("groups", group), t_entities);
      }
    }).then(function (result) {
      console.log('entity updated with group');
      return pushSomething("groups", group_pk, 'entities', getPk("entities", entity), t_groups);
    }).then(function (result) {
      console.log(' group updated with group ' + JSON.stringify(result));
      return readSomething("entities", entity_pk, t_entities);
    }).then(function (r) {
      console.log('resolving with updated entity ' + JSON.stringify(r));
      resolve(r);
    }, function rej(reason) {
      console.log('level storage rejecting ' + reason);
      reject(reason)
    });
  });
};

MongoStorage.prototype.removeEntityFromGroupPromise = function (group_name, owner, entity_id, entity_type) {

  console.log("arguments for removeEntityFromGroupPromise leveldb " + JSON.stringify(arguments));
  var that = this;
  var group, entity, entity_groups, group_entities;
  return new Promise(function (resolve, reject) {
    var group_pk = buildGroupPk(group_name, owner);
    var entity_pk = buildEntityPk(entity_id, entity_type);
    var t_groups = that.groups;
    var t_entities = that.entities;

    readSomething("groups", group_pk, t_groups)
      .then(function (g) {
        group = g;
        console.log(JSON.stringify(group) + 'entities' + group.entities);
        entity_groups = group.entities.filter(function (v) {
          console.log("processing entity " + JSON.stringify(v) + " in group " + JSON.stringify(group));
          return (v.id !== entity_id || v.type !== entity_type);
        });
        console.log('entity groups different length: ' + entity_groups.length + " group length: " + group.entities.length);
        if (entity_groups.length === group.entities.length)
          reject(createError(409, "entity with id " + entity_id + " and type" + entity_type + " is not in group with group name " + group_name + " owned by " + owner));
        else
          return readSomething("entities", entity_pk, t_entities);
      }).then(function (e) {
        entity = e;
        console.log('got entity ' + entity + entity_id + entity_type);
        if (!entity.hasOwnProperty("groups"))
          entity.groups = [];
        console.log('groups' + entity.groups);
        group_entities = entity.groups.filter(function (v) {
          return (v.group_name !== group.group_name || v.owner !== group.owner);
        });
        console.log('group entities different length: ' + group_entities.length + " entity group length: " + entity.groups.length);
        if (group_entities.length === entity.groups.length) {
          reject(createError(409, "entity with id " + pkToString(getPk("entities", entity)) + " is not in group with group name " + group_name + " owned by " + owner + " seems there is an inconsistency"));
        } else {
          entity.groups = group_entities;
          group.entities = entity_groups;
          return updateSomething("entities", entity_pk, entity, t_entities);
        }
      }).then(function (result) {
        console.log('entity updated. Resulting groups are ' + JSON.stringify(result.groups));
        return updateSomething("groups", group_pk, group, t_groups);
      }).then(function (result) {
        console.log(' group updated. Resulting entities are  ' + JSON.stringify(result.entities));
        return readSomething("entities", entity_pk, t_entities);
      }).then(function (r) {
        console.log('resolving with updated entity ' + JSON.stringify(r));
        resolve(r)
      }, function rej(reason) {
        console.log('level storage rejecting ' + reason);
        reject(reason)
      });
  });
};

// MongoStorage.prototype.clearDatabasePromise = function () {
//   return new Promise(function (resolve, reject) {
//     .then(res => {
//       resolve()
//     }).catch(err => {
//       handleError(err, reject)
//     })
//   });
// }

//attribute_constraints is an array of objects with the following properties: attribute_type, attribute_value
//attribute_type is specified by a json path. Which allows to traverse attributes that are nested
//also entity type can be undefined or null, in this case entities with any entity type are returned
MongoStorage.prototype.listEntitiesByAttributeValueAndType = function (attribute_constraints, entity_type) {
  console.log("arguments for listEntitiesByAttributeValueAndType leveldb " + JSON.stringify(arguments));

  function keyTrue(ke) {
    return true;
  }

  function keyAction(entity_type, key) {
    console.log('key action. expected entity type ' + entity_type + ' key:' + JSON.stringify(key));
    return entity_type === key.type;
  }

  function dataAction(attribute_constraints, value) {
    console.log('attribute contratints ' + JSON.stringify(attribute_constraints));
    console.log('got value' + JSON.stringify(value));
    if (!attribute_constraints || attribute_constraints.length === 0)
      return false;
    var passes = true;
    attribute_constraints.forEach(function (attribute_constraint) {
      passes = passes && (lo.get(value, attribute_constraint.attribute_type) === attribute_constraint.attribute_value);
    });
    return passes;
  }
  return iterateDbAndSearch("entities", entity_type ? keyAction.bind(this, entity_type) : keyTrue, dataAction.bind(this, attribute_constraints), this.entities);

};

MongoStorage.prototype.listEntitiesByEntityType = function (entity_type) {
  console.log("arguments for listEntitiesByEntityType leveldb " + JSON.stringify(arguments));

  function keyAction(entity_type, key) {
    console.log('key action. expected entity type ' + entity_type + ' key:' + JSON.stringify(key));
    return entity_type === key.type;
  }

  function dataAction(value) {
    return true;
  }
  return iterateDbAndSearch("entities", keyAction.bind(this, entity_type), dataAction.bind(this), this.entities);

};

MongoStorage.prototype.listGroups = function () {
  console.log("arguments for listEntitiesGroups leveldb " + JSON.stringify(arguments));

  function keyAction(entity_type, key) {
    return true;
  }

  function dataAction(value) {
    return true;
  }
  return iterateDbAndSearch("groups", keyAction.bind(this), dataAction.bind(this), this.groups);

};

MongoStorage.prototype.listEntitiesByGroup = function (group_name, owner) {
  console.log("arguments for listEntitiesByGroupId leveldb " + JSON.stringify(arguments));
  var that = this;
  return new Promise(function (resolve, reject) {
    that.readGroupPromise(group_name, owner)
      .then(function (group) {
        resolve(group.entities);
      }, reject);
  });
};

module.exports = MongoStorage;