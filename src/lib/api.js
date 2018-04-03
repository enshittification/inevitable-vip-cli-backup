const vip = require( 'vip' );
const api = new vip();

const { getEnv } = require( './config' );
getEnv( 'PROXY', ( err, proxy ) => {
	if ( err || ! proxy ) {
		return;
	}

	api.proxy = proxy;
});

const { getCredentials } = require( './utils' );
getCredentials( function( err, credentials ) {
	if ( err ) {
		return;
	}

	api.auth.apiUserId = credentials.userId;
	api.auth.token = credentials.accessToken;
	api.caps = credentials.caps;

	getEnv( 'PROXY', ( err, proxy ) => {
		if ( err ) {
			return;
		}

		if ( ! proxy ) {
			return;
		}

		api.proxy = proxy;
	});
});

export const auth = api.auth;

function handleAuth( request ) {
	var callback = request.callback;
	request.callback = function( err, res ) {
		if ( res.status === 401 ) {
			return console.error( 'Invalid or expired token. Please login with `vipgo login`' );
		}

		callback.call( request, err, res );
	};
}

export function get( url ) {
	return api.get( url ).use( handleAuth );
}

export function post( url ) {
	return api.post( url ).use( handleAuth );
}

export function put( url ) {
	return api.put( url ).use( handleAuth );
}

export function del( url ) {
	return api.del( url ).use( handleAuth );
}

// caps
export function currentUserCan( cap, action ) {
	return api.currentUserCan( cap, action );
}
export function currentUserCanRead( cap ) {
	return api.currentUserCanRead( cap );
}
export function currentUserCanEdit( cap ) {
	return api.currentUserCanEdit( cap );
}
export function currentUserCanAdd( cap ) {
	return api.currentUserCanAdd( cap );
}
export function currentUserCanDelete( cap ) {
	return api.currentUserCanDelete( cap );
}
