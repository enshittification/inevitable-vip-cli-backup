/** @format */
// @flow
/**
 * External dependencies
 */
import chalk from 'chalk';

export type Tuple = {
	key: string,
	value: string,
};

export function formatData( data: Array<any>, format: string ): string {
	if ( ! data || ! data.length ) {
		return '';
	}

	switch ( format ) {
		case 'ids':
			return ids( data );

		case 'json':
			return JSON.stringify( data, null, '\t' );

		case 'csv':
			return csv( data );

		case 'keyValue':
			return keyValue( data );

		case 'table':
		default:
			return table( data );
	}
}

export function formatEnvironment( environment: string ): string {
	if ( 'production' === environment.toLowerCase() ) {
		return chalk.red( environment.toUpperCase() );
	}

	return chalk.blueBright( environment.toLowerCase() );
}

function ids( data: Array<any> ): string {
	const fields = Object.keys( data[ 0 ] ).map( key => key.toLowerCase() );
	if ( 0 > fields.indexOf( 'id' ) ) {
		return 'No ID field found';
	}

	const id = [];
	data.forEach( datum => id.push( datum.id ) );

	return id.join( ' ' );
}

function csv( data: Array<any> ): string {
	const { Parser } = require( 'json2csv' );
	const fields = Object.keys( data[ 0 ] );

	const parser = new Parser( { fields: formatFields( fields ) } );

	return parser.parse( data );
}

export function table( data: Array<any> ): string {
	const Table = require( 'cli-table' );
	const fields = Object.keys( data[ 0 ] );
	const dataTable = new Table( {
		head: formatFields( fields ),
		style: {
			head: [ 'blueBright' ],
		},
	} );

	data.forEach( datum => {
		const row = [];
		fields.forEach( field => row.push( datum[ field ] ) );
		dataTable.push( row );
	} );

	return dataTable.toString();
}

function formatFields( fields: Array<string> ) {
	return fields.map( field => {
		return field
			.split( /(?=[A-Z])/ )
			.join( ' ' )
			.toLowerCase();
	} );
}

export function keyValue( values: Array<Tuple> ): string {
	const lines = [];
	const pairs = values.length > 0;

	if ( pairs ) {
		lines.push( '===================================' );
	}

	for ( const { key, value } of values ) {
		let formattedValue = value;

		switch ( key.toLowerCase() ) {
			case 'environment':
				formattedValue = formatEnvironment( value );
				break;
		}

		lines.push( `+ ${ key }: ${ formattedValue }` );
	}

	lines.push( '===================================' );

	return lines.join( '\n' );
}

export function requoteArgs( args: Array<string> ): Array<string> {
	return args.map( arg => {
		if ( arg.includes( '--' ) && arg.includes( '=' ) && arg.includes( ' ' ) ) {
			return arg.replace( /^--(.*)=(.*)$/, '--$1="$2"' );
		}

		if ( arg.includes( ' ' ) && ! isJsonObject( arg ) ) {
			return `"${ arg }"`;
		}

		return arg;
	} );
}

export function isJsonObject( str: string ): boolean {
	return typeof str === 'string' && str.trim().startsWith( '{' ) && isJson( str );
}

export function isJson( str: string ): boolean {
	try {
		JSON.parse( str );
	} catch ( error ) {
		return false;
	}
	return true;
}

export function capitalize( str: string ): string {
	if ( typeof str !== 'string' || ! str.length ) {
		return '';
	}
	return str[ 0 ].toUpperCase() + str.slice( 1 );
}

export const RUNNING_SPRITE_GLYPHS = [ '⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏' ];

export class RunningSprite {
	count: number;

	constructor() {
		this.count = 0;
	}

	next() {
		if ( ++this.count >= RUNNING_SPRITE_GLYPHS.length ) {
			this.count = 0;
		}
	}

	toString() {
		const glyph = RUNNING_SPRITE_GLYPHS[ this.count ];
		this.next(); // TODO: throttle
		return glyph;
	}
}

export function getGlyphForStatus( status: string, runningSprite: RunningSprite ) {
	switch ( status ) {
		default:
			return '';
		case 'pending':
			return '○';
		case 'running':
			return chalk.blueBright( runningSprite );
		case 'success':
			return chalk.green( '✓' );
		case 'failed':
			return chalk.red( '✕' );
		case 'unknown':
			return chalk.yellow( '✕' );
		case 'skipped':
			return chalk.green( '-' );
	}
}

// Format Search and Replace values to output
export const formatSearchReplaceValues = ( values, message ) => {
	// Convert single pair S-R values to arrays
	const searchReplaceValues = typeof values === 'string' ? [ values ] : values;

	const formattedOutput = searchReplaceValues.map( pairs => {
		// Turn each S-R pair into its own array, then trim away whitespace
		const [ from, to ] = pairs.split( ',' ).map( pair => pair.trim() );

		const output = message( from, to );

		return output;
	} );
	return formattedOutput;
};

// Format bytes into kilobytes, megabytes, etc based on the size
export const formatBytes = ( bytes, decimals = 2 ) => {
	if ( 0 === bytes ) {
		return '0 Bytes';
	}

	const kk = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = [ 'bytes', 'KB', 'MB', 'GB', 'TB' ];
	const idx = Math.floor( Math.log( bytes ) / Math.log( kk ) );

	return parseFloat( ( bytes / Math.pow( kk, idx ) ).toFixed( dm ) ) + ' ' + sizes[ idx ];
}
