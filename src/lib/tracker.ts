import debugLib from 'debug';

import Pendo from './analytics/clients/pendo';
import Tracks from './analytics/clients/tracks';
import Analytics from './analytics/index';
import env from './env';
import config from '../lib/cli/config';
import Token from '../lib/token';

import type { AnalyticsClient } from './analytics/clients/client';
import type { Response } from 'node-fetch';

const debug = debugLib( '@automattic/vip:analytics' );

let analytics: Analytics | null = null;

async function init(): Promise< Analytics > {
	const uuid = await Token.uuid();

	const clients: AnalyticsClient[] = [];

	const tracksUserType = config.tracksUserType;
	const tracksEventPrefix = config.tracksEventPrefix;

	if ( tracksUserType && tracksEventPrefix ) {
		clients.push( new Tracks( uuid, tracksUserType, tracksEventPrefix, env ) );

		clients.push(
			new Pendo( {
				env,
				eventPrefix: tracksEventPrefix,
				userId: uuid,
			} )
		);
	}

	return new Analytics( clients );
}

async function getInstance(): Promise< Analytics > {
	if ( analytics ) {
		return analytics;
	}

	analytics = await init();

	return analytics;
}

export async function trackEvent(
	name: string,
	props: Record< string, unknown > = {}
): Promise< ( false | Response )[] > {
	try {
		await Token.uuid();
		const client = await getInstance();
		return await client.trackEvent( name, props );
	} catch ( err ) {
		debug( 'trackEvent() failed', err );
		return [];
	}
}

export async function aliasUser( vipUserId: number ): Promise< void > {
	if ( vipUserId ) {
		try {
			await trackEvent( '_alias_user', {
				ui: vipUserId,
				_ut: config.tracksUserType,
				anonid: await Token.uuid(),
			} );
			await Token.setUuid( `${ vipUserId }` );
		} catch ( err ) {
			debug( 'aliasUser() failed', err );
		}
	}
}

export function trackEventWithEnv(
	appId: string | number,
	envId: string | number,
	eventName: string,
	eventProps: Record< string, unknown > = {}
): Promise< false | unknown[] > {
	return trackEvent( eventName, { ...eventProps, app_id: appId, env_id: envId } );
}

export type CommandTracker = ( type: string, data?: Record< string, unknown > ) => Promise< void >;

export function makeCommandTracker(
	command: string,
	trackingInfo: Record< string, unknown > = {}
): CommandTracker {
	const trackerFn = async ( type: string, data: Record< string, unknown > = {} ) => {
		await trackEvent( `${ command }_command_${ type }`, { ...trackingInfo, ...data } );
	};

	return trackerFn;
}
