const fs = require( 'fs' );
const crypto = require( 'crypto' );
const promptly = require( 'promptly' );
const vip = require( 'vip' );

var s_token_iv = 'XWRCbboGgpK1Q23c';
var s_token_ky = 'w3C1LwkexA8exKsjuYxRBCHOhqMZ5Wiy4mYPT4UxiJOvKNF7hSLwwt7dqpYyj3cA';

var utils = {
	encrypt: function( data, key ) {
		var cryptkey = crypto.createHash( 'sha256' ).update( key + s_token_ky + key ).digest();
		var encipher = crypto.createCipheriv( 'aes-256-cbc', cryptkey, s_token_iv );
		var encryptdata = encipher.update( data, 'utf8', 'binary' );
		encryptdata += encipher.final( 'binary' );
		var encoded = new Buffer( encryptdata, 'binary' ).toString( 'base64' );
		return encoded;
	},
	decrypt: function( data, key ) {
		var cryptkey = crypto.createHash( 'sha256' ).update( key + s_token_ky + key ).digest();
		var decipher = crypto.createDecipheriv( 'aes-256-cbc', cryptkey, s_token_iv );
		var encr_data = new Buffer( data, 'base64' ).toString( 'binary' );
		var decoded = decipher.update( encr_data, 'binary', 'utf8' );
		decoded += decipher.final( 'utf8' );
		return decoded;
	},
	setCredentials: function( credentials, callback ) {
		credentials.userId = credentials.userId || '';
		credentials.accessToken = credentials.accessToken || '';

		const api = new vip();

		api.auth.apiUserId = credentials.userId;
		api.auth.token = credentials.accessToken;

		api
			.get( '/api_users/' + api.auth.apiUserId )
			.end( ( err, res ) => {
				if ( err ) {
					return callback( err );
				}

				credentials.role = res.body.data[0].api_user_role_id;

				var encoded = this.encrypt( credentials.accessToken, credentials.userId );
				credentials.accessToken = encoded;

				credentials = JSON.stringify( credentials );
				fs.writeFileSync('/tmp/.vip-go-api', credentials );

				return callback( null, credentials );
			});
	},
	getCredentials: function( callback ){
		try {
			var r = fs.readFileSync( '/tmp/.vip-go-api', 'utf8' );
		} catch (e) {
			return callback( 'Could not get credentials' );
		}

		r = JSON.parse( r );

		if ( ! r.accessToken ) {
			return;
		}

		try {
			var decoded = this.decrypt( r.accessToken, r.userId );
		} catch (e) {
			fs.unlinkSync( '/tmp/.vip-go-api' );
		}

		r.accessToken = decoded;

		return callback( null, r );
	},
	findSite: function( domain, cb ) {
		var request, api = require( './api' );
		if ( ! isNaN( parseInt( domain ) ) ) {
			request = api
				.get( '/sites/' + domain );
		} else {
			request = api
				.get( '/sites' )
				.query({ search: domain });
		}

		return request
			.query({ pagesize: 1 })
			.end( ( err, res ) => {
				if ( err ) {
					return cb( err.response.error );
				}

				var site = res.body.data[0];

				if ( ! site ) {
					return cb();
				}

				cb( null, site );
			});
	},
	findAndConfirmSite: function( site, cb ) {
		utils.findSite( site, ( err, s ) => {
			if ( err ) {
				return console.error( err );
			}

			if ( ! s ) {
				return console.error( "Couldn't find site:", site );
			}

			console.log( "Client Site:", s.client_site_id );
			console.log( "Primary Domain:", s.domain_name );
			console.log( "Environment:", s.environment_name );

			promptly.confirm( "Are you sure?", ( err, yes ) => {
				if ( err ) {
					return console.error( err );
				}

				if ( ! yes ) {
					// Bails. Do not pass go. Do not collect $200.
					return;
				}

				cb( s );
			});
		});
	},
};

module.exports = utils;