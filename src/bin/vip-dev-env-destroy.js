#!/usr/bin/env node

/**
 * @flow
 * @format
 */

/**
 * External dependencies
 */
import debugLib from 'debug';
import chalk from 'chalk';

/**
 * Internal dependencies
 */
import { trackEvent } from 'lib/tracker';
import command from 'lib/cli/command';
import * as exit from 'lib/cli/exit';
import { destroyEnvironment } from 'lib/dev-environment/dev-environment-core';
import { getEnvironmentName } from 'lib/dev-environment/dev-environment-cli';
import { DEV_ENVIRONMENT_FULL_COMMAND } from 'lib/constants/dev-environment';
import { getEnvTrackingInfo } from '../lib/dev-environment/dev-environment-cli';

const debug = debugLib( '@automattic/vip:bin:dev-environment' );

const examples = [
	{
		usage: `${ DEV_ENVIRONMENT_FULL_COMMAND } destroy`,
		description: 'Destroys the default local dev environment',
	},
	{
		usage: `${ DEV_ENVIRONMENT_FULL_COMMAND } destroy --slug=foo`,
		description: 'Destroys a local dev environment named foo',
	},
];

command()
	.option( 'slug', 'Custom name of the dev environment' )
	.option( 'soft', 'Keep config files needed to start an environment intact' )
	.examples( examples )
	.argv( process.argv, async ( arg, opt ) => {
		const slug = getEnvironmentName( opt );

		const trackingInfo = getEnvTrackingInfo( slug );
		await trackEvent( 'dev_env_destroy_command_execute', trackingInfo );

		debug( 'Args: ', arg, 'Options: ', opt );

		try {
			const removeFiles = ! ( opt.soft || false );
			await destroyEnvironment( slug, removeFiles );

			const message = chalk.green( '✓' ) + ' Environment destroyed.\n';
			console.log( message );
			await trackEvent( 'dev_env_destroy_command_success', trackingInfo );
		} catch ( error ) {
			const errorTrackingInfo = Object.assign( {}, trackingInfo, { error: error.message } );
			await trackEvent( 'dev_env_destroy_command_error', errorTrackingInfo );
			exit.withError( error.message );
		}
	} );
