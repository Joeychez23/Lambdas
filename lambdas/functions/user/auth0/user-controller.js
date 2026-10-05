/*
 *  chess-controller.js  --  chess validation
 *	Chess Move Engine
 *  DyanmoDB Controller Functions 
 *
 */

/* ---------------------------------------------------------------- */
// Global
/* ---------------------------------------------------------------- */

async function getAuth0User(email) {

	const AUTH0_ISSUER_BASE_URL_ORIGIN = "dev-h7163bsxqf345cvn.us.auth0.com"
	const AUTH0_CONNECTION = "auth0-default-connection"
	const AUTH0_CLIENT_ID = "IDdJ6ppAaPY9ZU7UQRcd4qvAvBsGHYFP"
	const AUTH0_CLIENT_SECRET = "IFOi_711DYey-ocwlUz7QygtFZ_3EynCjvGOBaJJ8Ncqswk76Kusp2seLJDTZQC5"

	let userInfo;
	let clientToken;

	if (email) { return await handleAuth();}

	async function handleAuth() {
		userInfo = await reqUser();
		if (userInfo) { return userInfo }

		async function reqUser() { // THIS FUNCTION CANNOT BE CLIENT SIDE, MUST BE MOVED TO LAMBDA
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

			if (clientToken) {
				const userSearchResponse = await fetch(`https://${AUTH0_ISSUER_BASE_URL_ORIGIN}/api/v2/users?q=email:\"${email}\"&search_engine=v2`, userSearchOptions);
				const userResponse = await userSearchResponse.json();

				if (userResponse.length == 1) {
					if (userResponse[0].identities[0].connection == AUTH0_CONNECTION) { return userResponse[0] }
				} else if (userResponse.length > 1) {
					for (let i = 0; i < userResponse.length; i++) {
						if (userResponse[i].identities[0].connection == AUTH0_CONNECTION) { return userResponse[i] }
					}
				} else { return; }
			}
		}
	}
	// });
}


module.exports = { getAuth0User }