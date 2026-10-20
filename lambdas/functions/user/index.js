/*
 *  chess.js  --  chess validation
 *	Chess Move Engine
 *
 */

/* ---------------------------------------------------------------- */
// Global
/* ---------------------------------------------------------------- */

const { getAuth0User } = require('./auth0/user-controller.js');

/* ---------------------------------------------------------------- */
// lambda function
/* ---------------------------------------------------------------- */
/**
 * [Returns http response code]
 * @param  {[object]} req [contains client data]
 * @return {[object]} httpResponse [returns x-custom-header with a JSON body]
 */
'use strict';
exports.handler = async (req) => {
	let headers = {
		'Access-Control-Allow-Headers': "Options, Content-Type, Accept",
		'Access-Control-Allow-Origin': "*",
		'Content-Type': 'application/json',
		'Access-Control-Allow-Methods': "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
	}
	if (req?.httpMethod || false) {
		if (req?.body || false) {
			let reqData = JSON.parse(req.body);
			// if(reqData.email && ((req.multiValueHeaders.origin && req.headers.origin) && (req.headers.referer && req.multiValueHeaders.referer) || (JSON.stringify(req.headers).split('\"user-agent\":\"insomnia/2023.4.0\"').length > 1))) {
			if(reqData.email) {
				let response = await getAuth0User(reqData.email);
				let httpResponse = {
					statusCode: 200,
					headers,
					body: JSON.stringify({
						status: 200,
						userData: response,
						message: "USER DATA FOUND"
					})
				};
				return httpResponse;
			} else {
				let httpResponse = {
					statusCode: 200,
					headers,
					body: JSON.stringify({
						status: 500,
						message: "INVALID HTTP METHOD"
					})
				};
				return httpResponse;
			}
		} else {
			let httpResponse = {
				statusCode: 200,
				headers,
				body: JSON.stringify({
					status: 500,
					message: "EVENT BODY NOT FOUND",
				})
			};
			return httpResponse;
		}
	} else {
		let httpResponse = {
			statusCode: 200,
			headers,
			body: JSON.stringify({
				status: 500,
				message: "NO METHOD FOUND",
			})
		};
		return httpResponse;
	}
}