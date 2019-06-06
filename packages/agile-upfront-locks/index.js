var fs = require('fs');
var w = require('winston');

var items = ["Locks","Actions"]
var lists = []
items.forEach(function(folder){
  var l = []
  var fss = fs.readdirSync(__dirname+"/"+folder);
  fss.forEach(function (file) {
    if(file!=="index.js"){
       console.log("reading "+folder+" in "+__dirname+"/"+folder+"/"+file);
       l.push(require(__dirname+"/"+folder+"/"+file));
    }

  });
  lists.push(l);
})

module.exports = {
  locks: lists[items.indexOf("Locks")],
  actions: lists[items.indexOf("Actions")]
};
