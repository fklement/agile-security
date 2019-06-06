var conf = require('./conf/api-conf');
var IdmCore = require('../index');
var idmcore = new IdmCore(conf);
var token = "6328602477442473";
var action = "create";
var entity_type = "/sensor";
var entity_id = "323";
var data = {
  "name": "Barack Obam2a",
};

/*
 To run this example you need to replace the token with a token that has been aquired from an instance of agile-idm-web-ui
 also agile-idm-web-ui needs to be runnin gin the location specified by the field authentication.web-server in the configuration
 if you want to restart the test with a clean database just remove the folders called database_entities and database_groups

 */
var prom = idmcore.createEntity(token, entity_id, entity_type, data);
prom.then(function (data) {
  console.log('data from api after creation: ' + JSON.stringify(data));
  return idmcore.readEntity(token, entity_id, entity_type);
}).then(function (read) {
  console.log('now reading data again gave back : ' + JSON.stringify(read));
}).catch(function (error) {
  console.log('something went wrong in the example: ' + error);
});
