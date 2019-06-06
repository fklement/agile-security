//from https://github.com/SEDARI/ulocks
// TODO: Review isOpen, lub and le operations
// they should be able to respect type hierarchies, e.g. flow to an client
// should also allow flow of a message to its subcomponents, i.e. variables
// apis, ...

var w = require('winston');
w.level = process.env.LOG_LEVEL;

module.exports = function (Lock) {
  "use strict";

  var IsGroupMemberLock = function (lock) {
    // call the super class constructor
    Lock.call(this, lock);
  };

  IsGroupMemberLock.meta = {
    arity: 2,
    descr: "This lock is open iff the entity to which this lock is applied to is a member of a specified group",
    name: "is group member",
    args: [
      "group_name",
      "id"
    ]
  }

  Lock.registerLock("isGroupMember", IsGroupMemberLock);

  IsGroupMemberLock.prototype = Object.create(Lock.prototype);

  IsGroupMemberLock.prototype.le = function (other) {
    w.debug("IsGroupMemberLock.prototype.le: " + this + " <= " + other);

    if (this.eq(other))
      return true;
    else {
      w.debug("\t====> false");
      return false;
    }
  };

  IsGroupMemberLock.prototype.copy = function () {
    var c = new IsGroupMemberLock(this);
    return c;
  }

  IsGroupMemberLock.prototype.isOpen = function (context, scope) {
    w.debug("IsGroupMemberLock.prototype.isOpen");

    if (valid(context)) {
      if (!context.isStatic) {
        w.error(JSON.stringify(context.entity.data))
        if (valid(context.entity) && valid(context.entity.data) && valid(context.entity.data.id)) {
          var other = context.getOtherEntity();

          //w.error(JSON.stringify(other.data))

          if (valid(other) && valid(other.data) && valid(other.data.owner)) {
            w.error(JSON.stringify(other.data))

            if(!context.entity.data.hasOwnProperty("groups")){
              return Promise.resolve({
                open: false,
                cond: false,
                lock: this
              });
            } else {
              let gs = context.entity.data.groups;
              let there = false;
              gs.forEach((group)=>{
                  //w.error("wwww"+JSON.stringify(this.args))
                  //w.error(JSON.stringify(context.entity.id))
                  //w.error("www"+JSON.stringify(group))
                   if(group.group_name === this.args[0] && group.owner === this.args[1]){
                     there = true
                   }
              })

              if (there)
                return Promise.resolve({
                  open: true,
                  cond: false
                });
              else
                return Promise.resolve({
                  open: false,
                  cond: false,
                  lock: this
                });
            }
          } else {
            return Promise.reject(new Error("IsGroupMemberLock.prototype.isOpen cannot evaluate opposing entities in message context or context is invalid!"));
          }
        } else {
          return Promise.reject(new Error("IsGroupMemberLock.prototype.isOpen current context is invalid!"));
        }
      } else {
        return Promise.reject(new Error("IsGroupMemberLock.prototype.isOpen not implemented for static analysis, yet"));
      }
    } else
      return Promise.reject(new Error("IsOwnerLock.prototype.isOpen: Context is invalid"));
  };

  IsGroupMemberLock.prototype.lub = function (lock) {
    if (this.eq(lock))
      return this;
    else {
      if (this.lock == lock.lock)
        return Lock.closedLock();
      else
        return null;
    }
  }

  function valid(o) {
    return o !== undefined && o !== null;
  }
}
