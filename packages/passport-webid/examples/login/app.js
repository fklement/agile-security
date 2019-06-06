const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const logger = require('morgan');
const methodOverride = require('method-override');
var https = require('https');
var express = require('express');
var passport = require('passport');
var util = require('util');
var fs = require('fs');
var WebIDStrategy = require('../../../passport-webid').Strategy;
var db = require('./db');
var flash = require('connect-flash');

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
   db.find(id, function (err, user) {
    done(err, user);
  });
});


passport.use(new WebIDStrategy(  { failureRedirect: '/fail', failureFlash: true },
    function(webid, certificate, req, done) {
      db.find(webid, function (err, user) {
        if(user)
           done(null, user);
        else {
          var user = { id: webid, username:webid, certificate: JSON.stringify(certificate, null, 2) };
          db.store(user,done);
        }
     });


  }
));

var options = {
    key: fs.readFileSync('./ssl/privatekey.pem'),
    cert: fs.readFileSync('./ssl/certificate.pem'),
    requestCert: true
};

var app = express();

// configure Express

  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(logger('dev'));
  app.use(cookieParser());
  app.use(bodyParser());
  app.use(methodOverride());
  app.use(session({  secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false
  }));
  app.use(passport.initialize());
  app.use(flash());
  app.use(passport.session());
  app.use(express.static(__dirname + '/../../public'));


//show information of the user when he is logged in
app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

//error page
app.get('/fail', function(req, res){
  res.render('fail', { user : req.user, error : req.flash('error')});


});

//login page = verifies webid
app.get('/login',
  passport.authenticate('webid', { failureRedirect: '/fail', failureFlash: true  }),
  function(req, res) {
    res.redirect('/');
});

//logout
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});






// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/fail')
}


https.createServer(options, app).listen(1443);
