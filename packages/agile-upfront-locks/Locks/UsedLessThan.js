//from https://github.com/SEDARI/ulocks
// TODO: Review lub and le operations

var w = require('winston');
var Audit = require('agile-audit');


w.level = process.env.LOG_LEVEL;

module.exports = function (Lock) {
  "use strict";

  var ActionExecutedLessThan = function (lock) {
    // call the super class constructor
    Lock.call(this, lock);
  };

  ActionExecutedLessThan.meta = {
    arity: 2,
    descr: "This lock is open iff the entity to which this lock is applied to has the specified ID.",
    name: "has ID",
    args: [
      "action",
      "count"
    ]
  };

  Lock.registerLock("actionExecLessThan", ActionExecutedLessThan);

  ActionExecutedLessThan.prototype = Object.create(Lock.prototype);

  ActionExecutedLessThan.prototype.le = function (other) {
    w.debug("ActionExecutedLessThan.prototype.le: " + this + " <= " + other);
    if (this.eq(other))
      return true;
    else {
      w.debug("\t====> false");
      return false;
    }
  };

  ActionExecutedLessThan.prototype.copy = function () {
    var c = new ActionExecutedLessThan(this);
    return c;
  };

  ActionExecutedLessThan.prototype.isOpen = function (context, scope) {
    w.debug("ActionExecutedLessThan.prototype.isOpen");
    if (valid(context)) {
      if (!context.isStatic) {
        if (valid(context.entity) && valid(context.entity.data) && valid(context.entity.data.id) && valid(context.entity.data.type)) {
          if(!process.env.NO_AUDIT || process.env.NO_AUDIT!=="1"){
            var conf = JSON.parse(process.env.AUDIT_CONF);
            w.log('ActionExecutedLessThan configuration obtained from AUDIT_CONF env varialbe is : '+conf);
            var that = this;
            return new Promise(function(resolve, reject) {
              if(!conf.dbName){
                Promise.reject(new Error("Cannot find configuration for audit db in ActionExecutedLessThan got: "+JSON.stringify(conf)))
              }
              var audit = new Audit(conf);
              //the entity on which you want to check the condition. The user who should not have used my actions more than X times.
              var user = context.entity.data;
              var me = context.getOtherEntity().data;
              var action = that.args[0];
              var number = that.args[1];

              Promise.all([
                  Promise.resolve()
                ])
                .then(function() {
                    return audit.aggregateActionsEntityByUser(me.id, me.type);
                }).then(function(aggregation) {

                  w.debug("ActionExecutedLessThan me " + me.id +' '+ me.type)
                  w.debug("ActionExecutedLessThan user " + user.id +' '+ user.type)
                  w.debug(JSON.stringify(aggregation, null, 2));


                  if(aggregation[user.id] && aggregation[user.id][action]){
                    w.debug('ActionExecutedLessThan found action '+action);
                    if(aggregation[user.id][action].count >= number){
                      resolve({
                        open: false,
                        cond: true,
                        lock: that
                      });
                    }
                    else{
                      resolve({
                        open: true,
                        cond: true,
                        lock: that
                      });
                    }
                  }
                  else{
                    resolve({
                      open: true,
                      cond: true,
                      lock: that
                    });
                  }

                }).catch(function(error){
                  resolve({
                    open: false,
                    cond: true,
                    lock: this
                  });
                });

            });
          }
          else{
            return Promise.resolve({
              open: false,
              cond: true,
              lock: this
            });
          }
        } else {
          return Promise.reject(new Error("ActionExecutedLessThan.prototype.isOpen: Entity in context does not specify the property 'id'!" + JSON.stringify(context, null, 2)));
        }
      } else {
        return Promise.reject(new Error("ActionExecutedLessThan.prototype.isOpen not implemented for static analysis, yet"));
      }
    } else
      return Promise.reject(new Error("ActionExecutedLessThan.prototype.isOpen: Context is invalid"));
  };

  ActionExecutedLessThan.prototype.lub = function (lock) {
    if (this.eq(lock))
      return this;
    else if (this.lock != lock.lock){
        return null;
    }
    else{
      if(this.args[0] === lock.args[0]){
        if (this.args[1] > lock.args[1])
          return lock;
        else
          return this;
      }
      else{
        return null;
      }
    }
  }

  function valid(o) {
    return (o !== undefined && o !== null);
  }
}
