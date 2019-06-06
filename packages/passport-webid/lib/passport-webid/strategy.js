var passport = require('passport')
var util = require('util');
var webid = require('webid/tls')


function Strategy(options, verify) {
	if (typeof options == 'function') {
		verify = options;
		options = {};
  	}
	passport.Strategy.call(this);
	this.name = 'webid';
	this.verify = verify;
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Strategy, passport.Strategy);

/**
 * Authentificate
 *
 */
Strategy.prototype.authenticate = function(req) {

	var self = this;
	var certificate = req.connection.getPeerCertificate()
	if (!certificate) {
		self.fail({message: 'No client-side certificate passord provided' });
	}
	else if(!certificate.hasOwnProperty("subjectaltname") || !certificate.subjectaltname){
		self.fail({message: 'Client side certificate does not havea subject alt name' });
	}
	else {

		// Verifying with node-webid
	    webid.verify(certificate, function (certificate , req, err, webid) {
        	if (err) {
            self.fail({message: err.toString() });
        	}
        	else {
            self.verify(webid, certificate, req, function (err, user) {
        			if (err) { return self.error(err); }
        			if (!user) { return self.fail(); }
        			self.success(user);
        		});
        	}
      }.bind(this, certificate, req));
  }
}

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;
