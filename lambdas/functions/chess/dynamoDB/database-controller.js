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

const CHESS_TABLE = "chess_db"; // KEY: game_id (S), NAMES MATCH chess-frontend/terraform/aws-enviroment/locals.tf
const USER_TABLE = "user_db"; // KEY: user_id (S)

const GAME_TTL = 60 * 60 * 24 * 25; // GAMES EXPIRE 25 DAYS AFTER THE LAST MOVE (SECONDS)

/* ---------------------------------------------------------------- */
// Expire Time
/* ---------------------------------------------------------------- */
/**
 * @description Builds the expireAt value DynamoDB TTL reads on chess_db
 * @return {[string]} expireAt [epoch SECONDS as a string, the SDK rejects plain numbers for N]
 */
function expireTime() {
	return `${Math.floor(Date.now() / 1000) + GAME_TTL}`;
}

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
	let params = {
		TableName: CHESS_TABLE,
		Item: {
			game_id: { S: gameId },
			state: { S: "OPEN" },
			game_board: { S: board },
			moves: { S: JSON.stringify([]) },
			prev_move: { S: JSON.stringify([]) },
			w_knight: { S: JSON.stringify([{ from: null, to: 'b1' }, { from: null, to: 'g1' }]) },
			b_knight: { S: JSON.stringify([{ from: null, to: 'b8' }, { from: null, to: 'g8' }]) },
			white_player_id: { S: playerId1 },
			black_player_id: { S: playerId2 },
			expireAt: { N: expireTime() } // TTL, PUSHED BACK ON EVERY MOVE IN updateGame
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
		if (userId != "CHESS_AI" && userId != "GUEST_USER") { // GUESTS HAVE NO GAME LIST, SKIP THEM LIKE THE AI
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
		TableName: CHESS_TABLE,
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
		TableName: CHESS_TABLE,
		Key: {
			game_id: { S: gameData.game_id.S }
		},
		UpdateExpression: 'SET moves = :moves, prev_move = :prev_move, game_board = :game_board, w_knight = :w_knight, b_knight = :b_knight, expireAt = :expireAt', // WHAT IS BEING UPDATED, AND ASSOCIATED ATTRIBUTES TO WHAT THE DATA WILL BE
		//, w_knight_2 = :w_knight_2', // WHAT IS BEING UPDATED, AND ASSOCIATED ATTRIBUTES TO WHAT THE DATA WILL BE

		ExpressionAttributeValues: { // ASSOCIATED ATTRIBUTES
			":moves": { S: JSON.stringify(gameData.moves.S) }, // UPDATED MOVE ARRAY
			":prev_move": { S: JSON.stringify(gameData.prev_move.S) },
			":game_board": { S: gameData.game_board.S }, // UPDATED GAME FEN
			":w_knight": { S: gameData.w_knight.S }, // UPDATED WHITE KNIGHT 1
			":b_knight": { S: gameData.b_knight.S }, // UPDATED BLACK KNIGHT 1
			":expireAt": { N: expireTime() } // ACTIVE GAMES NEVER EXPIRE, ONLY ABANDONED ONES
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
		TableName: USER_TABLE,
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
		TableName: USER_TABLE,
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
		TableName: USER_TABLE,
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

/* ---------------------------------------------------------------- */
// Prune open games
/* ---------------------------------------------------------------- */
/**
 * @description Drops games TTL already deleted from a user's open_games & saves the shorter list
 * @param  {[object]} userData [user item from retrieveUser]
 * @return {[object]} userData [same item, open_games.S only lists games that still exist]
 */
async function pruneOpenGames(userData) {
	const openGames = [...new Set(JSON.parse(userData.open_games.S))]; // BATCH GET FAILS ON DUPLICATE KEYS
	if (openGames.length == 0) { return userData; }

	let liveGames = [];
	try {
		for (let i = 0; i < openGames.length; i += 100) { // BATCH GET TAKES 100 KEYS MAX
			const gameIds = openGames.slice(i, i + 100);
			const params = {
				RequestItems: {
					[CHESS_TABLE]: {
						Keys: gameIds.map((gameId) => ({ game_id: { S: gameId } })),
						ProjectionExpression: "game_id" // ONLY CHECKING THE GAME EXISTS
					}
				}
			};

			const response = await connection.batchGetItem(params).promise();
			const foundGames = response.Responses[CHESS_TABLE].map((game) => game.game_id.S);
			const uncheckedGames = (response.UnprocessedKeys[CHESS_TABLE]?.Keys || []).map((key) => key.game_id.S);

			for (let j = 0; j < gameIds.length; j++) {
				if (foundGames.includes(gameIds[j]) || uncheckedGames.includes(gameIds[j])) { liveGames.push(gameIds[j]); } // UNCHECKED GAMES ARE KEPT, NEVER DROP A REAL GAME
			}
		}
	} catch (err) {
		console.log(`Open games check failed: ${err.message}`);
		return userData; // SHOW THE LIST AS IS RATHER THAN BREAKING HOME
	}

	if (liveGames.length == openGames.length) { return userData; } // NOTHING EXPIRED

	const prunedGames = JSON.stringify(liveGames);
	const params = {
		TableName: USER_TABLE,
		Key: {
			user_id: { S: userData.user_id.S }
		},
		UpdateExpression: 'SET open_games = :open_games',
		ConditionExpression: 'open_games = :old_open_games', // SKIPS THE SAVE IF A GAME WAS ADDED MEANWHILE, NEXT LOAD PRUNES AGAIN
		ExpressionAttributeValues: {
			":open_games": { S: prunedGames },
			":old_open_games": { S: userData.open_games.S }
		}
	}

	try {
		await connection.updateItem(params).promise(); // PUT REQUEST TO DYANMODB
	} catch (err) {
		if (err.code != "ConditionalCheckFailedException") { console.log(`Open games save failed: ${err.message}`); }
	}

	userData.open_games.S = prunedGames;
	return userData;
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


module.exports = { initalizeGame, retrieveGame, updateGame, initalizeUser, retrieveUser, updateUser, pruneOpenGames, auth0UserByEmail }