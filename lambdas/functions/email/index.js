/* ---------------------------------------------------------------- */
// Global
/* ---------------------------------------------------------------- */

const aws = require("aws-sdk");
const ses = new aws.SES({ region: "us-west-1" });

/* ---------------------------------------------------------------- */
// lambda function
/* ---------------------------------------------------------------- */
/**
 * [Returns http response code]
 * @param  {[object]} req [contains client data]
 * @return {[object]} httpResponse [returns x-custom-header with a JSON body]
 */
("use strict");
exports.handler = async (req) => {
	let headers = {
		"Access-Control-Allow-Headers": "Options, Content-Type, Accept",
		"Access-Control-Allow-Origin": "*",
		"Content-Type": "application/json",
		"Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
	};
	let httpResponse;
	if (req?.httpMethod || false) {
		if (req?.body || false) {
			let response = JSON.parse(req.body);
			const params = {
				Destination: {
					ToAddresses: ["joeychez23@outlook.com"],
				},
				Message: {
					Body: {
						Text: { Data: `Sender: ${response.email}\nMessage: ${response.message}` },
					},
				Subject: { Data: response.subject },
				},
				Source: "joeychez23@outlook.com",
			};

			let data;
			await ses.sendEmail(params).promise().then(function (event) { data = event })

			httpResponse = {
				statusCode: 200,
				headers,
				body: JSON.stringify({
					status: 200,
					data: data,
					message: "EMAIL SENT"
				})
			};
			return httpResponse;
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
};
