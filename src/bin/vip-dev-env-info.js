#!/usr/bin/env node

/**
 * @flow
 * @format
 */

/**
 * External dependencies
 */
import debugLib from 'debug';

/**
 * Internal dependencies
 */
import { trackEvent } from 'lib/tracker';
import command from 'lib/cli/command';
import { printEnvironmentInfo, printAllEnvironmentsInfo } from 'lib/dev-environment/dev-environment-core';
import { getEnvironmentName, handleCLIException } from 'lib/dev-environment/dev-environment-cli';
import { DEV_ENVIRONMENT_FULL_COMMAND } from 'lib/constants/dev-environment';
import { getEnvTrackingInfo, validateDependencies } from '../lib/dev-environment/dev-environment-cli';

const debug = debugLib( '@automattic/vip:bin:dev-environment' );

const examples = [
	{
		usage: `${ DEV_ENVIRONMENT_FULL_COMMAND } info --all`,
		description: 'Return information about all local dev environments',
	},
	{
		usage: `${ DEV_ENVIRONMENT_FULL_COMMAND } info --slug=my_site`,
		description: 'Return information about a local dev environment named "my_site"',
	},
];

command()
	.option( 'slug', 'Custom name of the dev environment' )
	.option( 'all', 'Show Info for all local dev environments' )
	.examples( examples )
	.argv( process.argv, async ( arg, opt ) => {
		await validateDependencies();
		const slug = getEnvironmentName( opt );

		const trackingInfo = opt.all ? { all: true } : getEnvTrackingInfo( slug );
		await trackEvent( 'dev_env_info_command_execute', trackingInfo );

		debug( 'Args: ', arg, 'Options: ', opt );

		try {
			if ( opt.all ) {
				await printAllEnvironmentsInfo();
			} else {
				await printEnvironmentInfo( slug );
			}
			await trackEvent( 'dev_env_info_command_success', trackingInfo );
		} catch ( error ) {
			handleCLIException( error, 'dev_env_info_command_error', trackingInfo );
		}
	} );
