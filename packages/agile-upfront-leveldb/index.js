var level = require('level');
//var uuid = require("uuid/v4");
var transaction = require('level-transactions');
var dbHandle = null;
var policies = null;
var settings_file = null;
var Promise = require('bluebird');
var console = require('./log');

module.exports = {
    init: init,
    close: close,
    create: create,
    update: update,
    read: read,
    del: del
};

function reInit(){
  var settings = settings_file;
  return new Promise(function(resolve, reject) {
       if(dbHandle){
          resolve();
      }
      else{
        console.log("reinitializing policies db! ")
        return init(settings);
      }

  });
}
/**
 * Initializes the database
 *
 * @param settings the settings for the mongodb database.
 */
function init(settings) {
    settings_file = settings;
    var filename = settings.dbName;
    var that = this;
    //console.log("attempting to use file  "+filename + "_policies");
    return new Promise(function(resolve, reject) {
         if(!dbHandle){
           var options = {
             keyEncoding: 'utf8',
             valueEncoding: 'json'
           };
           dbHandle = level(filename + "_policies", options);
        }
        resolve();
    });
}

function close(callback) {
  return new Promise(function(resolve, reject) {
    console.log("closing database object");
    if (dbHandle)
      dbHandle.close(function () {
        dbHandle = null;
        console.log("database cleaned");
        return resolve();
      });
    else {
      return reject();
    }
});
}


function read(id) {
    return new Promise(function(resolve, reject) {
      reInit().then(function(){
        var tr = transaction(dbHandle);
        tr.get(id, function (error, policy) {
              if (error && error.notFound){
                tr.commit(function(){
                  resolve(null);
                });
              }
              else if(error){
                tr.rollback(function(){
                  reject(error);
                });
              }
              else if(policy){
                if(policy.pO){
                  tr.commit(function(){
                   resolve(policy);
                  });
                }
                else{
                  tr.rollback(function(){
                   reject(new Error("ERROR: Entry for entity '"+id+"' has invalid format."));
                  });
                }
              }
              else{
                tr.rollback(function(){
                  reject(new Error("unknown error while reading policy. error "+JSON.stringify(error)+" policy "+JSON.stringify(policy)));
                });
              }
            });
          });
      });
}

function create(id, policy) {
    //console.log("creating id "+id+" policy "+JSON.stringify(policy));
    return new Promise(function(resolve, reject) {
      reInit().then(function(){
       var tr = transaction(dbHandle);
        var ret=  { _id: id, pO : policy, t:1};
        tr.put(id,ret,function (error) {
          if(error){
            tr.rollback(function(){
               reject(error);
            });
          }
          else{
            tr.commit(function(){
                resolve(ret);
            })

          }
        });
      });
    });
};

function update(id, policy, uid) {

  //normally uid should be checked to match t.
  return new Promise(function(resolve, reject) {
    reInit().then(function(){
    var tr = transaction(dbHandle);
    //console.log("creating id "+id+" policy "+JSON.stringify(policy));
      var ret=  { _id: id, pO : policy, t:1};
      tr.put(id, ret, function (error) {
        if(error){
          tr.rollback(function(){
            reject(error);
          });
        }
        else{
          tr.commit(function(){
              console.log("id:  "+id+" object "+JSON.stringify(ret.pO)+ " has been stored ");
              resolve(ret);
          });
        }
      });
  });
});
};

function del(id) {

    return new Promise(function(resolve, reject) {
      reInit().then(function(){

      var tr = transaction(dbHandle);
      tr.get(id, function (error, data) {
            if (error && error.notFound){
              tr.rollback(function(){
                resolve(null);
              });

            }
            else if(error){
              tr.rollback(function(){
                reject(error);
              });
            }
            else if(!data) {
              tr.rollback(function(){
                resolve(null);
              });
            }
            else{
              if(data.pO){
                tr.del(id, function (error) {
                      if(error) {
                          tr.rollback(function(){
                             reject(error);
                          });
                      } else {
                          tr.commit(function(){
                            resolve(data);
                          });
                      }
                  });
              }
              else{
               tr.rollback(function(){
                  resolve(null);
               });
              }
            }

      });
    });
   });

};
