#!/usr/bin/env node

/**
 * @flow
 * @format
 */

/**
 * External dependencies
 */
import chalk from 'chalk';
import gql from 'graphql-tag';

/**
 * Internal dependencies
 */
import command from 'lib/cli/command';
import { currentUserCanImportForApp, isSupportedApp } from 'lib/site-import/db-file-import';
import { uploadImportSqlFileToS3 } from 'lib/client-file-uploader';
import { trackEvent } from 'lib/tracker';
import { validate } from 'lib/validations/sql';
import API from 'lib/api';

/**
 * - Include `import_in_progress` state & error out if appropriate (this likely needs to be exposed in the data graph)
 * - Include `hasImporterS3Credentials` & error out if false (this needs to be implemented)
 */
const appQuery = `
	id,
	name,
	type,
	organization { id, name },
	environments{
		id
		appId
		type
		name
		importStatus {
			progress {
				started_at
				steps { name, started_at, finished_at, result, output }
				finished_at
			}
		}
		syncProgress { status }
		primaryDomain { name }
	}
`;

const START_IMPORT_MUTATION = gql`
mutation StartImport($input: AppEnvironmentImportInput){
	startImport(input: $input) {
		app {
		  id
		  name
		}
		message
		success
	  }
}
`;

const IMPORT_PROGRESS_QUERY = gql`
query App( $id: Int ) {
	app( id: $id ){
		environments{
			id
			importStatus {
				progress {
					started_at
					steps { name, started_at, finished_at, result, output }
					finished_at
				}
			}
		}
	}
}
`;

const err = message => {
	console.log( chalk.red( message.toString().replace( /^(Error: )*/, 'Error: ' ) ) );
	process.exit( 1 );
};

command( {
	appContext: true,
	appQuery,
	requiredArgs: 1, // TODO print proper usage example
	envContext: true,
	module: 'import-sql',
	requireConfirm: 'Are you sure you want to import the contents of the provided SQL file?',
} ).argv( process.argv, async ( arg, opts ) => {
	const { app, env } = opts;
	const { importStatus: { progress: importProgressAtLaunch } } = env;
	const [ fileName ] = arg;

	const trackEventWithEnv = async ( eventName, eventProps = {} ) =>
		trackEvent( eventName, { ...eventProps, appId: env.appId, envId: env.id } );

	await trackEventWithEnv( 'import_sql_command_execute' );

	console.log( '** Welcome to the WPVIP Site SQL Importer! **\n' );

	if ( ! currentUserCanImportForApp( app ) ) {
		err( 'The currently authenticated account does not have permission to perform a SQL import.' );
	}

	if ( ! isSupportedApp( app ) ) {
		await trackEventWithEnv( 'import_sql_command_error', { errorType: 'unsupported-app' } );
		err( 'The type of application you specified does not currently support SQL imports.' );
	}

	const previousStartedAt = importProgressAtLaunch.started_at || 0;
	const previousFinishedAt = importProgressAtLaunch.finished_at || 0;

	if ( previousStartedAt && ! previousFinishedAt ) {
		await trackEventWithEnv( 'import_sql_command_error', { errorType: 'existing-import' } );
		// TODO link to status page when one exists
		err( 'There is already an ongoing import for this site.' );
	}

	console.log( { importProgressAtLaunch } );

	await validate( fileName, true );

	/**
	 * TODO: We should check for various site locks (including importing) prior to the upload.
	 */

	const api = await API();

	const startImportVariables = {};

	try {
		const { fileMeta: { basename, md5 }, result } = await uploadImportSqlFileToS3( { app, env, fileName } );
		startImportVariables.input = {
			id: app.id,
			environmentId: env.id,
			basename: basename,
			md5: md5,
		};

		console.log( { basename, md5, result } );
	} catch ( e ) {
		err( e );
	}

	try {
		await api.mutate( { mutation: START_IMPORT_MUTATION, variables: startImportVariables } );
	} catch ( gqlErr ) {
		await trackEventWithEnv( 'import_sql_command_error', { errorType: 'StartImport-failed', gqlErr } );
		err( `StartImport call failed: ${ gqlErr }` );
	}

	await trackEventWithEnv( 'import_sql_command_queued' );

	console.log( '🚧 🚧 🚧 Your sql file import is queued 🚧 🚧 🚧' );

	const doneImporting = new Promise( ( resolve, reject ) => {
		const queryInterval = setInterval( async () => {
			const { data: { app: { environments } } } = await api.query( {
				query: IMPORT_PROGRESS_QUERY,
				variables: { id: app.id },
				fetchPolicy: 'network-only',
			} );
			const { importStatus: { progress } } = environments.find( e => e.id === env.id );

			// TODO UX
			if ( ! ( progress && progress.started_at > previousFinishedAt ) ) {
				console.log( 'waiting for import to start' );
				return;
			}

			console.log( { progress } );

			if ( progress.finished_at > previousFinishedAt ) {
				clearInterval( queryInterval );
				resolve();
			}
		}, 5000 );
	} );

	await doneImporting;

	console.log( 'Finished importing the SQL file. Reconfiguring and reloading...' );
} );
