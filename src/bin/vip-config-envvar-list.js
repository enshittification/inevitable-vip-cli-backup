#!/usr/bin/env node

/**
 * @flow
 * @format
 */

/**
 * External dependencies
 */
import chalk from 'chalk';

/**
 * Internal dependencies
 */
import command from 'lib/cli/command';
import { formatData } from 'lib/cli/format';
import { appQuery, listEnvVars } from 'lib/envvar/api';
import { debug, getEnvContext } from 'lib/envvar/logging';
import { rollbar } from 'lib/rollbar';
import { trackEvent } from 'lib/tracker';

const usage = 'vip config envvar list';

// Command examples
const examples = [
	{
		usage,
		description: 'Lists all environment variables (names only)',
	},
];

command( {
	appContext: true,
	appQuery,
	envContext: true,
	format: true,
	usage,
} )
	.examples( examples )
	.argv( process.argv, async ( arg: string[], opt ) => {
		const trackingParams = {
			app_id: opt.app.id,
			command: usage,
			env_id: opt.env.id,
			format: opt.format,
			org_id: opt.app.organization.id,
		};

		debug( `Request: list environment variables for ${ getEnvContext( opt.app, opt.env ) }` );
		await trackEvent( 'envvars_list_command_execute', trackingParams );

		const envvars = await listEnvVars( opt.app.id, opt.env.id, opt.format )
			.catch( async err => {
				rollbar.error( err );
				await trackEvent( 'envvars_list_query_error', { ...trackingParams, error: err.message } );

				throw err;
			} );

		await trackEvent( 'envvars_list_command_success', trackingParams );

		if ( 0 === envvars.length ) {
			console.log( chalk.yellow( 'There are no environment variables' ) );
			process.exit();
		}

		// Display context for non-machine-readable formats.
		if ( [ 'keyValue', 'table' ].includes( opt.format ) ) {
			console.log( 'For security, the values of environment variables cannot be retrieved.' );
			console.log();
		}

		console.log( formatData( envvars, opt.format ) );
	} );
