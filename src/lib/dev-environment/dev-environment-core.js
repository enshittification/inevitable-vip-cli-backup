/**
 * @flow
 * @format
 */

/**
 * External dependencies
 */
import debugLib from 'debug';
import xdgBasedir from 'xdg-basedir';
import os from 'os';
import fs from 'fs';
import ejs from 'ejs';
import path from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';

/**
 * Internal dependencies
 */
import { landoDestroy, landoInfo, landoRunWp, landoStart, landoStop } from './dev-environment-lando';
import { printTable } from './dev-environment-cli';
import { DEV_ENVIRONMENT_CONTAINER_IMAGES, DEV_ENVIRONMENT_DEFAULTS, DOCKER_HUB_WP_IMAGES } from '../constants/dev-environment';

const debug = debugLib( '@automattic/vip:bin:dev-environment' );

const landoFileTemplatePath = path.join( __dirname, '..', '..', '..', 'assets', 'dev-environment.lando.template.yml.ejs' );
const configDefaultsFilePath = path.join( __dirname, '..', '..', '..', 'assets', 'dev-environment.wp-config-defaults.php' );
const landoFileName = '.lando.yml';

export async function startEnvironment( slug: string ) {
	debug( 'Will start an environment', slug );

	const instancePath = getEnvironmentPath( slug );

	debug( 'Instance path for', slug, 'is:', instancePath );

	const environmentExists = fs.existsSync( instancePath );

	if ( ! environmentExists ) {
		throw new Error( 'Environment not found.' );
	}

	await landoStart( instancePath );
}

export async function stopEnvironment( slug: string ) {
	debug( 'Will stop an environment', slug );

	const instancePath = getEnvironmentPath( slug );

	debug( 'Instance path for', slug, 'is:', instancePath );

	const environmentExists = fs.existsSync( instancePath );

	if ( ! environmentExists ) {
		throw new Error( 'Environment not found.' );
	}

	await landoStop( instancePath );
}

type NewInstanceOptions = {
	title: string,
	multisite: boolean,
	phpVersion: string,
	wordpress: string,
	muPlugins: string,
	jetpack: string,
	clientCode: string
}

export async function createEnvironment( slug: string, options: NewInstanceOptions ) {
	debug( 'Will start an environment', slug, 'with options: ', options );

	const instancePath = getEnvironmentPath( slug );

	debug( 'Instance path for', slug, 'is:', instancePath );

	const alreadyExists = fs.existsSync( instancePath );

	if ( alreadyExists ) {
		throw new Error( 'Environment already exists.' );
	}

	const instanceData = await generateInstanceData( slug, options );

	debug( 'Instance data to create a new environment:', instanceData );

	await prepareLandoEnv( instanceData, instancePath );
}

export async function destroyEnvironment( slug: string ) {
	debug( 'Will destroy an environment', slug );
	const instancePath = getEnvironmentPath( slug );

	debug( 'Instance path for', slug, 'is:', instancePath );

	const environmentExists = fs.existsSync( instancePath );

	if ( ! environmentExists ) {
		throw new Error( 'Environment not found.' );
	}

	await landoDestroy( instancePath );

	// $FlowFixMe: Seems like a Flow issue, recursive is a valid option and it won't work without it.
	fs.rmdirSync( instancePath, { recursive: true } );
}

export async function printAllEnvironmentsInfo() {
	const allEnvNames = getAllEnvironmentNames();

	debug( 'Will print info for all environments. Names found: ', allEnvNames );

	console.log( 'Found ' + chalk.bold( allEnvNames.length ) + ' environments' + ( allEnvNames.length ? ':' : '.' ) );
	for ( const envName of allEnvNames ) {
		console.log( '\n' );
		await printEnvironmentInfo( envName );
	}
}

export async function printEnvironmentInfo( slug: string ) {
	debug( 'Will get info for an environment', slug );

	const instancePath = getEnvironmentPath( slug );

	debug( 'Instance path for', slug, 'is:', instancePath );

	const environmentExists = fs.existsSync( instancePath );

	if ( ! environmentExists ) {
		throw new Error( 'Environment not found.' );
	}

	const appInfo = await landoInfo( instancePath );

	printTable( appInfo );
}

export async function runWp( slug: string, args: Array<string> ) {
	debug( 'Will run a wp command on env', slug, 'with args', args );

	const instancePath = getEnvironmentPath( slug );

	debug( 'Instance path for', slug, 'is:', instancePath );

	const environmentExists = fs.existsSync( instancePath );

	if ( ! environmentExists ) {
		throw new Error( 'Environment not found.' );
	}

	await landoRunWp( instancePath, args );
}

async function prepareLandoEnv( instanceData, instancePath ) {
	const landoFile = await ejs.renderFile( landoFileTemplatePath, instanceData );

	const landoFileTargetPath = path.join( instancePath, landoFileName );
	const configDefaultsTargetPath = path.join( instancePath, 'config' );
	const configDefaultsFileTargetPath = path.join( configDefaultsTargetPath, 'wp-config-defaults.php' );

	fs.mkdirSync( instancePath, { recursive: true } );
	fs.writeFileSync( landoFileTargetPath, landoFile );
	fs.mkdirSync( configDefaultsTargetPath );
	fs.copyFileSync( configDefaultsFilePath, configDefaultsFileTargetPath );

	debug( `Lando file created in ${ landoFileTargetPath }` );
}

export async function generateInstanceData( slug: string, options: NewInstanceOptions ) {
	const instanceData = {
		siteSlug: slug,
		wpTitle: options.title || DEV_ENVIRONMENT_DEFAULTS.title,
		multisite: options.multisite || DEV_ENVIRONMENT_DEFAULTS.multisite,
		phpVersion: options.phpVersion || DEV_ENVIRONMENT_DEFAULTS.phpVersion,
		wordpress: await getParamInstanceData( options.wordpress, 'wordpress' ),
		muPlugins: await getParamInstanceData( options.muPlugins, 'muPlugins' ),
		jetpack: await getParamInstanceData( options.jetpack, 'jetpack' ),
		clientCode: await getParamInstanceData( options.clientCode, 'clientCode' ),
	};

	return instanceData;
}

async function getLatestWordPressImage() {
	const request = await fetch( DOCKER_HUB_WP_IMAGES );
	const body = await request.json();
	const tags = body.results.map( x => x.name ).sort();
	return {
		mode: 'image',
		image: DEV_ENVIRONMENT_CONTAINER_IMAGES.wordpress.image,
		tag: tags.pop(),
	};
}

export async function getParamInstanceData( passedParam: string, type: string ) {
	if ( passedParam ) {
		// cast to string
		const param = passedParam + '';
		if ( param.includes( '/' ) ) {
			return {
				mode: 'local',
				dir: param,
			};
		}

		if ( type === 'jetpack' && param === 'mu' ) {
			return {
				mode: 'inherit',
			};
		}

		return {
			mode: 'image',
			image: DEV_ENVIRONMENT_CONTAINER_IMAGES[ type ].image,
			tag: param,
		};
	}

	return type === 'wordpress' ? getLatestWordPressImage() : DEV_ENVIRONMENT_DEFAULTS[ type ];
}

function getAllEnvironmentNames() {
	const mainEnvironmentPath = xdgBasedir.data || os.tmpdir();

	const baseDir = path.join( mainEnvironmentPath, 'vip', 'dev-environment' );

	const doWeHaveAnyEnvironment = fs.existsSync( baseDir );

	let envNames = [];
	if ( doWeHaveAnyEnvironment ) {
		const files = fs.readdirSync( baseDir );

		envNames = files.filter( file => {
			const fullPath = path.join( baseDir, file );
			return fs.lstatSync( fullPath ).isDirectory();
		} );
	}

	return envNames;
}

export function getEnvironmentPath( name: string ) {
	if ( ! name ) {
		throw new Error( 'Name was not provided' );
	}

	const mainEnvironmentPath = xdgBasedir.data || os.tmpdir();

	return path.join( mainEnvironmentPath, 'vip', 'dev-environment', name );
}

