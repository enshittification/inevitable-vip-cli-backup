/**
 * External dependencies
 */
import nock from 'nock';
import url from 'url';

/**
 * Internal dependencies
 */
import Tracks from 'lib/analytics/tracks';

describe( 'lib/analytics/tracks', () => {
	const {
		protocol: endpointProtocol,
		host: endpointHost,
		path: endpointPath
	} = url.parse( Tracks.ENDPOINT );

	const buildNock = () => {
		return nock( `${ endpointProtocol }//${ endpointHost }` )
			.post( endpointPath );
	};

	afterEach( () => nock.cleanAll() );

	describe( '.send()', () => {
		it( 'should correctly construct remote request', ( done ) => {
			const tracksClient = new Tracks( 123, 'vip', {
				userAgent: 'vip-cli'
			} );

			const params = { extra: 'param' };

			const expectedBody = 'commonProps%5B_ui%5D=123' +
				'&commonProps%5B_ut%5D=vip' +
				'&extra=param';

			buildNock()
				// No arrow function because we need `this`
				.reply( function( uri, requestBody ) {
					expect( this.req.headers[ 'user-agent' ] )
						.toEqual( [ 'vip-cli' ] ); // The header value is returned as an array

					expect( requestBody ).toEqual( expectedBody );
				} );

			tracksClient.send( params )
				.then( () => done() );
		} );
	} );

	describe( '.trackEvent()', () => {
		it( 'should pass event details to request', ( done ) => {
			const tracksClient = new Tracks( 123, 'vip', {} );

			const eventName = 'clickButton';
			const eventDetails = {
				buttonName: 'deploy',
			};

			const expectedBodyMatch = 'events%5B0%5D%5B_en%5D=clickButton' +
				'&events%5B0%5D%5BbuttonName%5D=deploy';

			buildNock()
				.reply( ( uri, requestBody ) => {
					expect( requestBody ).toContain( expectedBodyMatch );
				} );

			tracksClient.trackEvent( eventName, eventDetails )
				.then( () => done() );
		} );
	} );
} );
