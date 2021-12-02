#!/usr/bin/env node
// @flow
/**
 * Internal dependencies
 */
import command from 'lib/cli/command';
import { rollbar } from 'lib/rollbar';
import { trackEvent } from 'lib/tracker';
import * as logsLib from 'lib/logs/logs';
import * as exit from 'lib/cli/exit';
import { formatData } from 'lib/cli/format';

const LIMIT_MAX = 5000;
const LIMIT_MIN = 1;
const ALLOWED_TYPES = [ 'app', 'batch' ];
const ALLOWED_FORMATS = [ 'csv', 'json', 'console' ];

export async function getLogs( arg: string[], opt ): Promise<void> {
	validateInputs( opt.type, opt.limit, opt.format );

	const trackingParams = {
		command: 'vip logs',
		org_id: opt.app.organization.id,
		app_id: opt.app.id,
		env_id: opt.env.id,
		type: opt.type,
		limit: opt.limit,
		format: opt.format,
	};

	await trackEvent( 'logs_command_execute', trackingParams );

	let logs = [];
	try {
		logs = await logsLib.getRecentLogs( opt.app.id, opt.env.id, opt.type, opt.limit );
	} catch ( error ) {
		rollbar.error( error );

		await trackEvent( 'logs_command_error', { ...trackingParams, error: error.message } );

		return exit.withError( error.message );
	}

	await trackEvent( 'logs_command_success', {
		...trackingParams,
		logs_output: logs.length,
	} );

	if ( ! logs.length ) {
		console.error( 'No logs found' );
		return;
	}

	// Strip out __typename
	logs = logs.map( log => {
		const { timestamp, message } = log;

		return { timestamp, message };
	} );

	let output = '';
	if ( opt.format && 'console' === opt.format ) {
		const rows = [];
		for ( const { timestamp, message } of logs ) {
			rows.push( `${ timestamp } ${ message }` );
			output = rows.join( '\n' );
		}
	} else {
		output = formatData( logs, opt.format );
	}

	console.log( output );
}

export function validateInputs( type: string, limit: number, format: string ): void {
	if ( ! ALLOWED_TYPES.includes( type ) ) {
		exit.withError( `Invalid type: ${ type }. The supported types are: ${ ALLOWED_TYPES.join( ', ' ) }.` );
	}

	if ( ! ALLOWED_FORMATS.includes( format ) ) {
		exit.withError( `Invalid format: ${ format }. The supported formats are: ${ ALLOWED_FORMATS.join( ', ' ) }.` );
	}

	if ( ! Number.isInteger( limit ) || limit < LIMIT_MIN || limit > LIMIT_MAX ) {
		exit.withError( `Invalid limit: ${ limit }. It should be a number between ${ LIMIT_MIN } and ${ LIMIT_MAX }.` );
	}
}

export const appQuery = `
	id
	name
	environments {
		id
		appId
		name
		type
	}
	organization {
		id
		name
	}
`;

command( {
	appContext: true,
	appQuery,
	envContext: true,
	module: 'logs',
} )
	.option( 'type', 'The type of logs to be returned: "app" or "batch"', 'app' )
	.option( 'limit', 'The maximum number of log lines', 500 )
	.option( 'format', 'Output the log lines in CSV or JSON format', 'console' )
	.examples( [
		{
			usage: 'vip @mysite.production logs',
			description: 'Get the most recent app logs',
		},
		{
			usage: 'vip @mysite.production logs --type batch',
			description: 'Get the most recent batch logs',
		},
		{
			usage: 'vip @mysite.production logs --limit 100',
			description: 'Get the most recent 100 log entries',
		},
		{
			usage: 'vip @mysite.production logs --limit 100 --format csv',
			description: 'Get the most recent 100 log entries formatted as comma-separated values (CSV)
		},
		{
			usage: 'vip @mysite.production logs --limit 100 --format json',
			description: 'Get the most recent 100 log entries formatted as JSON',
		},
	] )
	.argv( process.argv, getLogs );
