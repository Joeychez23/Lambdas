/*
 *  chess-controller.js  --  chess validation
 *	Chess Move Engine
 *  DyanmoDB Controller Functions 
 *
 */

/* ---------------------------------------------------------------- */
// Global
/* ---------------------------------------------------------------- */

const AWS = require("aws-sdk");
const { ObjectId } = require("bson");
const { Chess } = require("chess.js");

AWS.config.update({ region: "us-east-1" });
const connection = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

/* ---------------------------------------------------------------- */
// Initalize game (POST)
/* ---------------------------------------------------------------- */
/**
 * [Initalizes game for both the client and server]
 * @param  {[object]} playerData [Contains client data]
 * @param  {[object]} gameData [Contains server data]
 * @return {[object]} response [Returns the results of game creation]
 */
async function initalizeGame(existingGameId, playerId1, playerId2, createdBy) {
	const board = new Chess().fen();

	let gameId;
	let response;
	if (existingGameId) { gameId = existingGameId; }
	else { gameId = `${new ObjectId()}`; } // CREATES UNIQUE GAME IDENTIFIER

	const params = {
		TableName: "lakeside_chess_db",
		Item: {
			game_id: { S: gameId },
			state: { S: "OPEN" },
			game_board: { S: board },
			moves: { S: JSON.stringify([]) },
			prev_move: { S: JSON.stringify([]) },
			w_knight: { S: JSON.stringify([{ from: null, to: 'b1' }, { from: null, to: 'g1' }]) },
			b_knight: { S: JSON.stringify([{ from: null, to: 'b8' }, { from: null, to: 'g8' }]) },
			white_player_id: { S: playerId1 },
			black_player_id: { S: playerId2 }
		}
	};

	await connection.putItem(params, function (err, data) { // POST REQUEST FOR GAME CREATION TO DYNAMODB
		if (err) {
			return;
		} else {
			return;
		}
	}).promise();

	async function handleUser(userId) {
		if (userId != "CHESS_AI") {
			response = await retrieveUser(userId);
			if (response.status == 500) { response = await initalizeUser(userId); }

			// if(createdBy == userId) { // ADD TO OPEN GAMES

			let userData = response?.user_data;
			let openGames = JSON.parse(userData.open_games.S);

			if (openGames.length > 1) {
				let count = 0;
				for (let i = 0; i < openGames.length; i++) {
					if (i == openGames.length - 1 && count == i && openGames[i] != gameId) { openGames[openGames.length] = gameId; }
					else if (openGames[i] != gameId) { count += 1; }
				}
			} else if (openGames.length == 1) {
				if (openGames[0] != gameId) {
					openGames[openGames.length] = gameId;
				}
			} else if (openGames.length == 0) {
				openGames[openGames.length] = gameId;
			}

			userData.open_games.S = openGames;

			//SET DATA
			userData.requested_games.S = JSON.parse(userData.requested_games.S);
			userData.closed_games.S = JSON.parse(userData.closed_games.S);

			//UPDATE DATA
			response = await updateUser(userData);

			// } else { ADD TO REQUESTED GAMES
			// }

		}
	}

	await handleUser(playerId1);
	await handleUser(playerId2);

	// NEEDS TO HANDLE CREATED BY TO ACCECPT AN INVITE
	// GET CREATED GAME
	response = await retrieveGame(params.Item.game_id.S); // CHECKS IF THE GAME WAS CREATED

	if (response.status == 200) { // RETURNS THE CREATED GAME IF FOUND
		response.message = "Initalized game successfully"
		return response; // RETURNS THE CREATED GAME
	} else {
		response.message = "Game initialization failed"
		return response;
	}
}

/* ---------------------------------------------------------------- */
// Retrieve game (GET)
/* ---------------------------------------------------------------- */
/**
 * [Initalizes game for both the client and server]
 * @param  {[object]} gameId [Takes game id from client or server to find associated content]
 * @return {[object]} response [Returns the results of the GET request]
 */
async function retrieveGame(gameId) {
	//ADD CHECK PLAYER ID TO RETURNED GAME
	const params = {
		TableName: "lakeside_chess_db",
		Key: {
			game_id: { S: gameId } // SEARCH KEY
		}
	}

	let response = await connection.getItem(params, function (err, data) { // GET REQUEST TO DYNAMODB
		if (err) {
			return
		} else {
			return data;
		}
	}).promise();

	if (response.Item) {
		response.Item.moves.S = JSON.parse(response.Item.moves.S);
		response.Item.prev_move.S = JSON.parse(response.Item.prev_move.S);
		return {
			status: 200,
			game_data: response.Item,
			message: `Retrieved game id: ${response.Item.game_id.S}`
		}
	} else {
		return {
			status: 500,
			message: "Game data not found"
		}
	}
}

/* ---------------------------------------------------------------- */
// Retrieve game (PUT)
/* ---------------------------------------------------------------- */
/**
 * [Updates the game for both the client and server]
 * @param  {[object]} gameData [Validated server data, modified by a successful client request]
 * @return {[object]} response [Returns the results of the PUT request]
 */
async function updateGame(gameData) {
	const params = {
		TableName: "lakeside_chess_db",
		Key: {
			game_id: { S: gameData.game_id.S }
		},
		UpdateExpression: 'SET moves = :moves, prev_move = :prev_move, game_board = :game_board, w_knight = :w_knight, b_knight = :b_knight', // WHAT IS BEING UPDATED, AND ASSOCIATED ATTRIBUTES TO WHAT THE DATA WILL BE
		//, w_knight_2 = :w_knight_2', // WHAT IS BEING UPDATED, AND ASSOCIATED ATTRIBUTES TO WHAT THE DATA WILL BE

		ExpressionAttributeValues: { // ASSOCIATED ATTRIBUTES
			":moves": { S: JSON.stringify(gameData.moves.S) }, // UPDATED MOVE ARRAY
			":prev_move": { S: JSON.stringify(gameData.prev_move.S) },
			":game_board": { S: gameData.game_board.S }, // UPDATED GAME FEN
			":w_knight": { S: gameData.w_knight.S }, // UPDATED WHITE KNIGHT 1
			":b_knight": { S: gameData.b_knight.S } // UPDATED BLACK KNIGHT 1
		}
	}

	await connection.updateItem(params, function (err, data) { // PUT REQUEST TO DYANMODB
		if (err) { return; }
		else { return; }
	}).promise();

	let response = await retrieveGame(gameData.game_id.S); // GET GAME BY ID
	let { game_board, moves } = response.game_data;

	if (response.status == 200) {
		if (JSON.stringify(moves.S) == JSON.stringify(gameData.moves.S) && game_board.S == gameData.game_board.S) { // IF UPDATED SUCCESSFULLY 
			return {
				status: 200,
				game_data: gameData,
				message: `Updated game attributes: ${response.game_data.game_id.S}`
			}
		} else {
			return {
				status: 500,
				message: `Game attributes failed to update: ${response.game_data.game_id.S}`
			}
		}
	} else {
		return {
			status: 500,
			message: `Game attributes failed to update: ${gameData.game_id.S}`
		}
	}
}


// module.exports = { initalizeGame, retrieveGame, updateGame }


/* ---------------------------------------------------------------- */
// Initalize user (POST)
/* ---------------------------------------------------------------- */
/**
 */
async function initalizeUser(userId) {
	//ADD CHECK PLAYER ID TO RETURNED GAME
	const params = {
		TableName: "lakeside_user_db",
		Item: {
			user_id: { S: userId },
			open_games: { S: JSON.stringify([]) },
			requested_games: { S: JSON.stringify([]) },
			closed_games: { S: JSON.stringify([]) },
		}
	}

	await connection.putItem(params, function (err, data) { // GET REQUEST TO DYNAMODB
		if (err) {
			return;
		} else {
			return;
		}
	}).promise();

	let response = await retrieveUser(userId);

	if (response.status == 200) {
		return {
			status: 200,
			user_data: response.user_data,
			message: `user id: ${response.user_data.user_id.S} initalized inside db`
		}
	} else {
		return {
			status: 500,
			message: "User data not found"
		}
	}
}



/* ---------------------------------------------------------------- */
// Retrieve user (GET)
/* ---------------------------------------------------------------- */
/**
 */
async function retrieveUser(userId) {
	//ADD CHECK PLAYER ID TO RETURNED GAME
	const params = {
		TableName: "lakeside_user_db",
		Key: {
			user_id: { S: userId } // SEARCH KEY
		}
	}

	let response = await connection.getItem(params, function (err, data) { // GET REQUEST TO DYNAMODB
		if (err) {
			return
		} else {
			return data;
		}
	}).promise();

	if (response.Item) {
		return {
			status: 200,
			user_data: response.Item,
			message: `Retrieved user id: ${response.Item.user_id.S}`
		}
	} else {
		return {
			status: 500,
			message: "User data not found"
		}
	}
}




async function updateUser(userData) {
	const params = {
		TableName: "lakeside_user_db",
		Key: {
			user_id: { S: userData.user_id.S }
		},
		UpdateExpression: 'SET requested_games = :requested_games, open_games = :open_games, closed_games = :closed_games',
		ExpressionAttributeValues: { // ASSOCIATED ATTRIBUTES
			":requested_games": { S: JSON.stringify(userData.requested_games.S) },
			":open_games": { S: JSON.stringify(userData.open_games.S) }, // UPDATED MOVE ARRAY
			":closed_games": { S: JSON.stringify(userData.closed_games.S) }, // UPDATED GAME FEN
		}
	}

	await connection.updateItem(params, function (err, data) { // PUT REQUEST TO DYANMODB
		if (err) { return; }
		else { return; }
	}).promise();

	let response = await retrieveUser(userData.user_id.S); // GET GAME BY ID
	// let { game_board, moves } = response.user_data;

	if (response.status == 200) {
		return {
			status: 200,
			user_data: response.user_data,
			message: `user id: ${response.user_data.user_id.S} updated`
		}
	} else {
		return {
			status: 500,
			message: `User attributes failed to update: ${userData.user_id.S}`
		}
	}
}







async function auth0UserByEmail(email) {


	const AUTH0_ISSUER_BASE_URL_ORIGIN = 'dev-h7163bsxqf345cvn.us.auth0.com'
	const AUTH0_CONNECTION = 'auth0-default-connection'

	// PROD
	// const AUTH0_SECRET = 'JC2778VNdZZii7gbzpibn+WCPO9/nVkBjdZFeTgSRa0='

	const AUTH0_CLIENT_ID = 'IDdJ6ppAaPY9ZU7UQRcd4qvAvBsGHYFP'
	const AUTH0_CLIENT_SECRET = 'IFOi_711DYey-ocwlUz7QygtFZ_3EynCjvGOBaJJ8Ncqswk76Kusp2seLJDTZQC5'

	const clientTokenResponse = await fetch(`https://${AUTH0_ISSUER_BASE_URL_ORIGIN}/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			grant_type: 'client_credentials',
			client_id: `${AUTH0_CLIENT_ID}`,
			client_secret: `${AUTH0_CLIENT_SECRET}`,
			audience: `https://${AUTH0_ISSUER_BASE_URL_ORIGIN}/api/v2/`
		}),
	})

	const clientTokenData = await clientTokenResponse.json();
	clientToken = clientTokenData.access_token;

	let userSearchOptions = {
		method: 'GET',
		headers: { authorization: `Bearer ${clientToken}` }
	}

	if (clientToken && email) {
		const userSearchResponse = await fetch(`https://${AUTH0_ISSUER_BASE_URL_ORIGIN}/api/v2/users?q=email:\"${email}\"&search_engine=v2`, userSearchOptions);
		const userResponse = await userSearchResponse.json();
		if (userResponse.length != 0) {
			for (let i = 0; i < userResponse.length; i++) {
				if (userResponse[i].identities[0].connection == AUTH0_CONNECTION) { return userResponse[i]; }
			}
		} else {
			if (userResponse[0].identities[0].connection == AUTH0_CONNECTION) { return userResponse[0] }
			else { return null; }
		}
	}
}


module.exports = { initalizeGame, retrieveGame, updateGame, initalizeUser, retrieveUser, updateUser, auth0UserByEmail }