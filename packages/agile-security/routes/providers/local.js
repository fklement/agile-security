var passport = require('passport');
var express = require('express');

function RouterPassport(router, conf) {

  //Local
  router.route('/local').get(function (req, res) {
    var options = [{
      "name": "username",
      "type": "text",
      "label": "username"
    }, {
      "name": "password",
      "type": "password",
      "label": "password"
    }];
    res.render('local', {
      auth_type: 'local',
      fields: options
    });
  });
  router.route('/local').post(
    passport.authenticate('local' /*'github'*/ , {
      successReturnToOrRedirect: '/',
      failureRedirect: conf.failureRedirect,
      //failureFlash: true

    })
  );
  return router;
}
module.exports = RouterPassport;
