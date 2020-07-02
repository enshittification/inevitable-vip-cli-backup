#!/usr/bin/env node
// @flow

/**
 * External dependencies
 */
import url from 'url';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs';

/**
 * Internal dependencies
 */
import command from 'lib/cli/command';

command( { requiredArgs: 1, format: true } )
	.example( 'vip import validate files <file>', 'Validate your media files' )
	.argv( process.argv, async ( file, options ) => {
		// File comes in as an array as part of the args- turn it into a string
		const fileString = file.join();

		// Then parse the file to its URL parts
		file = url.parse( fileString );
		
		// Extract the path of the file
		const path = file.path;

		const recommendedFileStructure = console.log(
			'Please follow this structure for your media files: \n' +
			chalk.underline( 'Single sites:') +
			chalk.yellow(' `uploads/year/month/image.png` \n') +
			' e.g.-' + chalk.yellow('`uploads/2020/06/image.png` \n') +
			chalk.underline('Multisites:') +
			chalk.cyan(' `uploads/sites/siteID/year/month/image.png` \n') +
			' e.g.-' + chalk.cyan('`uploads/sites/5/2020/06/images.png`')
		);

		// Ensure media files are stored in an `uploads` directory
		if ( path.search( 'uploads' ) === -1 ) {
			console.error( chalk.red( '✕' ), 'Error: Media files must be in an `uploads` directory' );
			console.log();
			console.log( recommendedFileStructure );
		}

		// Folder structure validation
		fs.readdir( fileString, ( error, files ) => {
			if ( error ) {
				console.error( chalk.red( '✕ Error:' ), `Unable to read directory ${ fileString }: ${ error.message }` );
			}

			if ( ! files.length ) {
				console.error(chalk.red( '✕ Error:' ), 'Media files directory cannot be empty' );
			}
		} )
	} );