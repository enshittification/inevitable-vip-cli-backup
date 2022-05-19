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
import { getEnvironmentName } from 'lib/dev-environment/dev-environment-cli';
import { DEV_ENVIRONMENT_FULL_COMMAND } from 'lib/constants/dev-environment';
import { addDevEnvConfigurationOptions, getEnvTrackingInfo, handleCLIException, promptForArguments, validateDependencies } from '../lib/dev-environment/dev-environment-cli';
import type { InstanceOptions } from '../lib/dev-environment/types';
import { doesEnvironmentExist, readEnvironmentData, updateEnvironment } from '../lib/dev-environment/dev-environment-core';
import { DEV_ENVIRONMENT_NOT_FOUND, DEV_ENVIRONMENT_PHP_VERSIONS } from '../lib/constants/dev-environment';

const debug = debugLib( '@automattic/vip:bin:dev-environment' );

const examples = [
	{
		usage: `${ DEV_ENVIRONMENT_FULL_COMMAND } update`,
		description: 'Retriggers setup wizard in order to change environment configuration',
	},
];
const cmd = command().option( 'slug', 'Custom name of the dev environment' );

addDevEnvConfigurationOptions( cmd );

cmd.examples( examples );
cmd.argv( process.argv, async ( arg, opt ) => {
	await validateDependencies();
	const slug = getEnvironmentName( opt );

	const trackingInfo = getEnvTrackingInfo( slug );
	await trackEvent( 'dev_env_update_command_execute', trackingInfo );

	try {
		const environmentAlreadyExists = doesEnvironmentExist( slug );
		if ( ! environmentAlreadyExists ) {
			throw new Error( DEV_ENVIRONMENT_NOT_FOUND );
		}

		const currentInstanceData = readEnvironmentData( slug );

		debug( 'Read instance data', currentInstanceData );

		const preselectedOptions = {
			// Title and multisite can't be changed during update
			title: currentInstanceData.wpTitle,
			multisite: currentInstanceData.multisite,
			...opt,
		};

		const defaultOptions: InstanceOptions = {
			clientCode: currentInstanceData.clientCode.dir || currentInstanceData.clientCode.tag || 'latest',
			muPlugins: currentInstanceData.muPlugins.dir || currentInstanceData.muPlugins.tag || 'latest',
			wordpress: currentInstanceData.wordpress.tag,
			elasticsearch: currentInstanceData.elasticsearch,
			php: currentInstanceData.php || DEV_ENVIRONMENT_PHP_VERSIONS.default,
			mariadb: currentInstanceData.mariadb,
			statsd: currentInstanceData.statsd,
			phpmyadmin: currentInstanceData.phpmyadmin,
			xdebug: currentInstanceData.xdebug,
			mediaRedirectDomain: currentInstanceData.mediaRedirectDomain,
			multisite: false,
			title: '',
		};

		const instanceData = await promptForArguments( preselectedOptions, defaultOptions );
		instanceData.siteSlug = slug;

		await updateEnvironment( instanceData );

		const message = '\n' + chalk.green( '✓' ) + ' environment updated. Restart environment for changes to take an affect.';
		console.log( message );
		await trackEvent( 'dev_env_update_command_success', trackingInfo );
	} catch ( error ) {
		if ( 'ENOENT' === error.code ) {
			const message = 'Environment was created before update was supported.\n\nTo update environment please destroy it and create a new one.';
			handleCLIException( new Error( message ), 'dev_env_update_command_error', trackingInfo );
		} else {
			handleCLIException( error, 'dev_env_update_command_error', trackingInfo );
		}
	}
} );