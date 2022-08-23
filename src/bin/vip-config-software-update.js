#!/usr/bin/env node

/**
 * @flow
 * @format
 */

/**
 * External dependencies
 */
import chalk from 'chalk';
import debugLib from 'debug';

/**
 * Internal dependencies
 */
import command from 'lib/cli/command';
import { appQuery, appQueryFragments } from 'lib/config/software';
import { getUpdateResult, promptForUpdate, triggerUpdate } from '../lib/config/software';
import { ProgressTracker } from '../lib/cli/progress';
import UserError from '../lib/user-error';

const debug = debugLib( '@automattic/vip:bin:config-software' );

const UPDATE_SOFTWARE_PROGRESS_STEPS = [
	{ id: 'trigger', name: 'Trigger software update' },
	{ id: 'process', name: 'Process software update' },
];

const cmd = command( {
	appContext: true,
	appQuery,
	appQueryFragments,
	envContext: true,
	wildcardCommand: true,
	usage: 'vip config software update <wordpress|php|nodejs|muplugins> <version>',
} ).examples( [
	{
		usage: 'vip config software update wordpress 6.0',
		description: 'Update WordPress to 6.0.x',
	},
	{
		usage: 'vip config software update nodejs 16',
		description: 'Update Node.js to v16',
	},
] );
cmd.option( 'force', 'Auto-confirm update' );
cmd.argv( process.argv, async ( arg: string[], opt ) => {
	const { app, env } = opt;
	const { softwareSettings } = env;

	if ( softwareSettings === null ) {
		throw UserError( 'Software settings are not supported for this environment.' );
	}

	const updateOptions: UpdatePromptOptions = {
		force: !! opt.force,
	};

	if ( arg.length > 0 ) {
		updateOptions.component = arg[ 0 ];
	}
	if ( arg.length > 1 ) {
		updateOptions.version = arg[ 1 ];
	}

	const updateData = await promptForUpdate( app.typeId, updateOptions, softwareSettings );

	const hasProcessJob = updateData.component !== 'nodejs';
	const steps = hasProcessJob ? UPDATE_SOFTWARE_PROGRESS_STEPS : [ UPDATE_SOFTWARE_PROGRESS_STEPS[ 0 ] ];
	const progressTracker = new ProgressTracker( steps );

	progressTracker.startPrinting();
	progressTracker.stepRunning( 'trigger' );

	const triggerResult = await triggerUpdate( { appId: app.id, envId: env.id, ...updateData } );
	debug( 'Triggered update with result', triggerResult );

	progressTracker.stepSuccess( 'trigger' );

	if ( hasProcessJob ) {
		const { ok, errorMessage } = await getUpdateResult( app.id, env.id );

		if ( ok ) {
			progressTracker.stepSuccess( 'process' );
		} else {
			progressTracker.stepFailed( 'process' );
		}
		progressTracker.print();
		progressTracker.stopPrinting();

		if ( ok ) {
			console.log( chalk.green( '✓' ) + ' Software update complete' );
		} else {
			throw Error( errorMessage );
		}
	} else {
		progressTracker.print();
		progressTracker.stopPrinting();
		const deploymentsLink = `https://dashboard.wpvip.com/apps/${ app.id }/${ env.uniqueLabel }/deploys`;
		const message = ` A new build of the application code has been initiated and will be deployed using Node.js v${ updateData.version } when the build is successful\n` +
			`View the deployments page in VIP Dashboard for progress updates. - ${ deploymentsLink }`;
		console.log( chalk.green( '✓' ) + message );
	}
} );
