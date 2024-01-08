import chalk from 'chalk';

import deleteEnvVar from './api-delete';
import getEnvVar from './api-get';
import getEnvVars from './api-get-all';
import listEnvVars from './api-list';
import setEnvVar from './api-set';
import { debug } from '../../lib/envvar/logging';

// Reexport for convenience
export { deleteEnvVar, getEnvVar, getEnvVars, listEnvVars, setEnvVar };

// The subquery for environments lets users choose any environment, including production.
export const appQuery = `
	id
	name
	environments {
		id
		appId
		name
		primaryDomain {
			name
		}
		type
	}
	organization {
		id
		name
	}
`;

export function validateName( name: string ): boolean {
	const sanitizedName = name
		.trim()
		.toUpperCase()
		.replace( /[^A-Z0-9_]/g, '' );
	return name === sanitizedName && /^[A-Z]/.test( sanitizedName );
}

export function validateNameWithMessage( name: string ): boolean {
	debug( `Validating environment variable name "${ name }"` );

	if ( ! validateName( name ) ) {
		const message = [
			'Environment variable name must consist of A-Z, 0-9, or _,',
			'and must start with an uppercase letter.',
		].join( '\n' );

		console.log( chalk.bold.red( message ) );
		return false;
	}

	return true;
}
