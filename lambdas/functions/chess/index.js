/*
 *  chess.js  --  chess validation
 *	Chess Move Engine
 *
 */

/* ---------------------------------------------------------------- */
// Global
/* ---------------------------------------------------------------- */

const { validateMove } = require("./validate/validate.js")
const { initalizeGame, retrieveGame, updateGame, retrieveUser, auth0UserByEmail } = require('./dynamoDB/database-controller.js');
// const { sendToOpponentEmail } = require("./ses/email-controller.js");
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
			if (!reqData.move && reqData.player_id && reqData.game_id) {
				let response = await retrieveGame(reqData.game_id);

				const playerId = reqData.player_id
				let playerColor;
				let ai;
				let opponentColor;

				if (playerId == response.game_data.white_player_id.S) {
					playerColor = "w";
					opponentColor = "b"
				}
				else if (playerId == response.game_data.black_player_id.S) {
					playerColor = "b";
					opponentColor = "w"
				}

				if (response.game_data.white_player_id.S == "SINCLAIR_CHESS_AI") { ai = true; }
				else if (response.game_data.black_player_id.S == "SINCLAIR_CHESS_AI") { ai = true; }
				else { ai = false; }

				if (response.game_data && playerColor) {
					let httpResponse = {
						statusCode: 200,
						headers,
						body: JSON.stringify({
							status: response.status,
							game_id: response.game_data?.game_id.S || null,
							game_board: response.game_data?.game_board.S || null,
							ai: ai ? ai : false,
							player_color: playerColor,
							opponent_color: opponentColor ? opponentColor : null,
							moves: response.game_data?.moves.S || null,
							prev_move: response.game_data?.prev_move.S || null,
							w_knight: response.game_data?.w_knight.S || null,
							b_knight: response.game_data?.b_knight.S || null,
							message: response.message,
						})
					};
					return httpResponse;
				}
				else {
					let httpResponse = {
						statusCode: 200,
						headers,
						body: JSON.stringify({
							status: response.status,
							message: response.message
						})
					};
					return httpResponse;
				}
				// Seperate Init from Process Move
			} else if (reqData.move || (reqData.player_id_1 && reqData.player_id_2)) {
				let response = await processMove(reqData); // POST OR GET -> VALIDATE -> PUT

				let ai;
				if (response.game_data.white_player_id.S == "SINCLAIR_CHESS_AI") { ai = true; }
				else if (response.game_data.black_player_id.S == "SINCLAIR_CHESS_AI") { ai = true; }
				else { ai = false; }

				if (response.game_data) { // REQUEST PROCESSED
					let httpResponse = {
						statusCode: 200,
						headers,
						body: JSON.stringify({
							status: response.status,
							game_id: response.game_data?.game_id.S || null,
							ai: ai ? ai : false,
							game_board: response.game_data?.game_board.S || null,
							w_knight: response.game_data?.w_knight.S || null,
							b_knight: response.game_data?.b_knight.S || null,
							message: response.message,
						})
					};
					return httpResponse;
				} else {
					let httpResponse = {
						statusCode: 200,
						headers,
						body: JSON.stringify({
							status: response.status,
							message: response.message
						})
					};
					return httpResponse;
				}
			} else if ( reqData.user_id ) {
				const userId = reqData.user_id
				let response = await retrieveUser(userId);

				if (response.user_data) { // REQUEST PROCESSED
					let httpResponse = {
						statusCode: 200,
						headers,
						body: JSON.stringify({
							status: response.status,
							user_id: response.user_data?.user_id.S || null,
							requested_games: response.user_data?.requested_games.S || null,
							open_games: response.user_data?.open_games.S || null,
							closed_games: response.user_data?.closed_games.S || null,
							message: response.message,
						})
					};
					return httpResponse;
				} else {
					let httpResponse = {
						statusCode: 200,
						headers,
						body: JSON.stringify({
							status: response.status,
							message: response.message
						})
					};
					return httpResponse;
				}


			} else if(reqData.game_id && reqData.challenger_id && reqData.opponent_email) {
				// await sendToOpponentEmail(reqData.opponentEmail, "test");
				let opponentData = await auth0UserByEmail(reqData.opponent_email);
				opponentId = opponentData?.user_id.split("auth0|")[1]
				let response = await initalizeGame(reqData.game_id, reqData.challenger_id, opponentId);
				response = await retrieveGame(reqData.game_id); // GET GAME DATA BY ID
				if (response.game_data) {
					let httpResponse = {
						statusCode: 200,
						headers,
						body: JSON.stringify({
							status: response.status,
							game_id: response.game_data?.game_id.S || null,
							message: response.message,
						})
					};
					return httpResponse;
				}
				else {
					let httpResponse = {
						statusCode: 200,
						headers,
						body: JSON.stringify({
							status: response.status,
							message: response.message
						})
					};
					return httpResponse;
				}
			} else {
				let httpResponse = {
					statusCode: 200,
					headers,
					body: JSON.stringify({
						status: response.status,
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

/* ---------------------------------------------------------------- */
// Processes player move
/* ---------------------------------------------------------------- */
/**
 * [Returns final response which is complete when the user is validated and the data is updated OR create a new game (POSSIBLE CHANGE)]
 * @param  {[object]} playerData [contains client data]
 * @param  {[object]} gameData [contains server data]
 * @return {[object]} response [returns the results of the move processing]
 */
async function processMove(playerData) {
	if ((playerData?.game_id || false) && playerData.player_id_1 && playerData.player_id_2) { // CONDITIONALIZE NEW GAME
		let response = await initalizeGame(playerData.game_id, playerData.player_id_1, playerData.player_id_2);
		return response;
	}
	if ((!playerData.game_id) && playerData.player_id_1 && playerData.player_id_2) { // CONDITIONALIZE NEW GAME
		let response = await initalizeGame(false, playerData.player_id_1, playerData.player_id_2);
		return response;
	}
	if (playerData.game_id && playerData.player_id) { // CONDITIONALIZE EXISTING GAME
		let response = await retrieveGame(playerData.game_id); // GET GAME DATA BY ID
		if (response.status == 200) {
			response = await validateMove(playerData, response.game_data); // VALIDATE MOVE WITH EXISTING BOARD
			if (response.status == 200) {
				response = await updateGame(response.game_data); // PUT VALIDATED MOVE
				if (response.status == 200) {
					response.message = "Validation Successful";
					return response;
				} else {
					return response;
				}
			}
			else {
				return response;
			}
		} else {
			return response;
		}
	}
}