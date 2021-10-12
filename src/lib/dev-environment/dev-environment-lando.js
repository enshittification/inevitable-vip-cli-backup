/**
 * @flow
 * @format
 */

/**
 * External dependencies
 */
import debugLib from 'debug';
import path from 'path';
import Lando from 'lando/lib/lando';
import landoUtils from 'lando/plugins/lando-core/lib/utils';
import landoBuildTask from 'lando/plugins/lando-tooling/lib/build';
import chalk from 'chalk';

/**
 * Internal dependencies
 */

/**
 * This file will hold all the interactions with lando library
 */

const debug = debugLib( '@automattic/vip:bin:dev-environment-lando' );

function getLandoConfig() {
	const landoPath = path.join( __dirname, '..', '..', '..', 'node_modules', 'lando' );

	debug( `Getting lando config, using path '${ landoPath }' for plugins` );

	return {
		logLevelConsole: 'warn',
		landoFile: '.lando.yml',
		preLandoFiles: [ '.lando.base.yml', '.lando.dist.yml', '.lando.upstream.yml' ],
		postLandoFiles: [ '.lando.local.yml' ],
		pluginDirs: [
			landoPath,
			{
				path: path.join( landoPath, 'integrations' ),
				subdir: '.',
			},
		],
		proxyName: 'vip-dev-env-proxy',
		// This is a way to make lando config merging actually not include any of its fallback
		// Each item in the array will overwrite one fallback port. And there are 4 default fallbacks
		// for both http an https each.
		proxyHttpFallbacks: [ '80', '80', '80', '80' ],
		proxyHttpsFallbacks: [ '443', '443', '443', '443' ],
	};
}

export async function landoStart( instancePath: string ) {
	debug( 'Will start lando app on path:', instancePath );

	const lando = new Lando( getLandoConfig() );
	await lando.bootstrap();

	const app = lando.getApp( instancePath );
	await app.init();

	await app.start();
}

export async function landoRebuild( instancePath: string ) {
	debug( 'Will rebuild lando app on path:', instancePath );

	const lando = new Lando( getLandoConfig() );
	await lando.bootstrap();

	const app = lando.getApp( instancePath );
	await app.init();

	await ensureNoOrphantProxyContainer( lando );

	await app.rebuild();
}

export async function landoStop( instancePath: string ) {
	debug( 'Will stop lando app on path:', instancePath );

	const lando = new Lando( getLandoConfig() );
	await lando.bootstrap();

	const app = lando.getApp( instancePath );
	await app.init();

	await app.stop();
}

export async function landoDestroy( instancePath: string ) {
	debug( 'Will destroy lando app on path:', instancePath );
	const lando = new Lando( getLandoConfig() );
	await lando.bootstrap();

	const app = lando.getApp( instancePath );
	await app.init();

	await app.destroy();
}

export async function landoInfo( instancePath: string ) {
	const lando = new Lando( getLandoConfig() );
	await lando.bootstrap();

	const app = lando.getApp( instancePath );
	await app.init();

	let appInfo = landoUtils.startTable( app );

	const reachableServices = app.info.filter( service => service.urls.length );
	reachableServices.forEach( service => appInfo[ `${ service.service } urls` ] = service.urls );

	const isUp = await isEnvUp( app );

	const extraService = await getExtraServicesConnections( lando, app );
	appInfo = {
		...appInfo,
		...extraService,
	};

	appInfo.status = isUp ? chalk.green( 'UP' ) : chalk.yellow( 'DOWN' );

	// Drop vipdev prefix
	appInfo.name = appInfo.name.replace( /^vipdev/, '' );

	return appInfo;
}

const extraServiceDisplayConfiguration = [
	{
		name: 'vip-search',
		label: 'enterprise search',
		protocol: 'http',
	},
	{
		name: 'phpmyadmin',
		// Skipping, as the phpmyadmin was already printed by the regular services
		skip: true,
	},
];

async function getExtraServicesConnections( lando, app ) {
	const extraServices = {};
	const allServices = await lando.engine.list( { project: app.project } );

	for ( const service of allServices ) {
		const displayConfiguration = extraServiceDisplayConfiguration.find(
			conf => conf.name === service.service
		) || {};

		if ( displayConfiguration.skip ) {
			continue;
		}

		const containerScan = service?.id ? await lando.engine.docker.scan( service?.id ) : null;
		if ( containerScan?.NetworkSettings?.Ports ) {
			const mappings = Object.keys( containerScan.NetworkSettings.Ports )
				.map( internalPort => containerScan.NetworkSettings.Ports[ internalPort ] )
				.filter( externalMapping => externalMapping?.length );

			if ( mappings?.length ) {
				const { HostIp: host, HostPort: port } = mappings[ 0 ][ 0 ];
				const label = displayConfiguration.label || service.service;
				const value = ( displayConfiguration.protocol ? `${ displayConfiguration.protocol }://` : '' ) + `${ host }:${ port }`;
				extraServices[ label ] = value;
			}
		}
	}

	return extraServices;
}

async function isEnvUp( app ) {
	const reachableServices = app.info.filter( service => service.urls.length );
	const urls = reachableServices.map( service => service.urls ).flat();

	const scanResult = await app.scanUrls( urls, { max: 1 } );
	// If all the URLs are reachable than the app is considered 'up'
	return scanResult?.length && scanResult.filter( result => result.status ).length === scanResult.length;
}

export async function landoExec( instancePath: string, toolName: string, args: Array<string> ) {
	const lando = new Lando( getLandoConfig() );
	await lando.bootstrap();

	const app = lando.getApp( instancePath );
	await app.init();

	const isUp = await isEnvUp( app );

	if ( ! isUp ) {
		throw new Error( 'environment needs to be started before running wp command' );
	}

	const tool = app.config.tooling[ toolName ];
	if ( ! tool ) {
		throw new Error( 'wp is not a known lando task' );
	}

	/*
	 lando is looking in both passed args and process.argv so we need to do a bit of hack to fake process.argv
	 so that lando doesn't try to interpret args not meant for wp.

	 Lando drops first 3 args (<node> <lando> <command>) from process.argv and process rest, so we will fake 3 args + the real args
	*/
	process.argv = [ '0', '1', '3' ].concat( args );

	tool.app = app;
	tool.name = toolName;

	const task = landoBuildTask( tool, lando );

	const argv = {
		_: args, // eslint-disable-line
	};

	await task.run( argv );
}

/**
 * Sometimes the proxy network seems to disapper leaving only orphant stopped proxy container.
 * It seems to happen while restarting/powering off computer. This container would then failed
 * to start due to missing network.
 *
 * This function tries to detect such scenario and remove the orphant. So that regular flow
 * can safelly add a network and a new proxy container.
 *
 * @param {object} lando Bootstrapped Lando object
 */
async function ensureNoOrphantProxyContainer( lando ) {
	const proxyContainerName = lando.config.proxyContainer;

	const docker = lando.engine.docker;
	const containers = await docker.listContainers( { all: true } );
	const proxyContainerExists = containers.some( container => container.Names.includes( `/${ proxyContainerName }` ) );

	if ( ! proxyContainerExists ) {
		return;
	}

	const proxyContainer = await docker.getContainer( proxyContainerName );
	const status = await proxyContainer.inspect();
	if ( status?.State?.Running ) {
		return;
	}

	await proxyContainer.remove();
}
