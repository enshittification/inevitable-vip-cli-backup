const https = require( 'https' );
const gunzip = require( 'zlib' ).createGunzip();
const fs = require( 'fs' );
const path = require( 'path' );

// ours
const p = require( '../package.json' );

// Ensure build path exists
const bin = p.bin[ 'go-search-replace' ];
if ( ! fs.existsSync( path.dirname( bin ) ) ) {
	fs.mkdirSync( path.dirname( bin ) );
}

// Config
const URL = 'https://github.com:443/Automattic/go-search-replace/releases/download/{{version}}/go-search-replace_{{platform}}_{{arch}}.gz';

// Mapping from Node's `process.arch` to Golang's `$GOARCH`
const ARCH_MAPPING = {
	'ia32': '386',
	'x64': 'amd64',
	'arm': 'arm',
};

// Mapping between Node's `process.platform` to Golang's
const PLATFORM_MAPPING = {
	'darwin': 'darwin',
	'linux': 'linux',
	'win32': 'windows',
	'freebsd': 'freebsd',
};

// Windows executables compiled by Golang have a `.exe` extension
let arch = ARCH_MAPPING[process.arch];
if ( process.platform === 'win32' ) {
	arch += '.exe';
}

const url = URL
	.replace( /{{arch}}/, arch )
	.replace( /{{platform}}/, PLATFORM_MAPPING[process.platform] )
	.replace( /{{version}}/, p.goSearchReplace.version );

// Helper function to follow redirects
const download = function( url ) {
	https.request( url, res => {
		if ( res.statusCode >= 300 && res.statusCode < 400 ) {
			download( res.headers.location );
		} else {
			const dest = fs.createWriteStream( bin, { mode: 0o755 });
			res.pipe( gunzip ).pipe( dest );
		}
	})
	.on( 'error', err => console.log( err ) )
	.end();
};

download( url );