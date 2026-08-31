/*
 *  chess-controller.js  --  chess validation
 *	Chess Move Engine
 *  SES Controller Functions 
 *
 */

/* ---------------------------------------------------------------- */
// Global
/* ---------------------------------------------------------------- */

const AWS = require("aws-sdk");

AWS.config.update({ region: "us-east-1" });
const connection = new AWS.SES({ apiVersion: '2012-08-10' });



/* ---------------------------------------------------------------- */
// Initalize game (POST)
/* ---------------------------------------------------------------- */
/**
 * [Initalizes game for both the client and server]
 * @param  {[object]} playerData [Contains client data]
 * @param  {[object]} gameData [Contains server data]
 * @return {[object]} response [Returns the results of game creation]
 */
async function sendToOpponentEmail(emailTo, username) {
    console.log(`Received event`);
    const params = {
        Destination: {
            ToAddresses: [emailTo]
        },
        Message: {
            Body: {
                Text: {
					Data: "Something"
				}
            },
            Subject: {
                Data: "Email from xxxxxxx Contact Us Form"
            }
        },
        Source: `${username}@chess.aws-prac-route53.com`
    };

    console.log(`sending: ${JSON.stringify(params)}`);
    return await connection.sendEmail(params, null).promise();
}

module.exports = { sendToOpponentEmail }