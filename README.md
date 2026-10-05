# Chess Validation (Lambdas)

The serverless backend for the [Chess](https://github.com/Joeychez23/Chess)
app ([live](https://chess.aws-prac-route53.com/)). Every move the browser
sends is replayed with chess.js against the board stored in DynamoDB. The
move is saved only if it's legal and it really is that player's turn. This
repo also holds the Lambda behind the portfolio's contact form.

Built with Node.js Lambdas, API Gateway (REST, proxy integration), DynamoDB,
[chess.js](https://github.com/jhlywa/chess.js), the Auth0 Management API, SES,
and Terraform.

## Architecture

```
chess frontend (CloudFront) ──POST──▶ API Gateway /api/chess ──▶ lakeside-chess-lambda ──▶ DynamoDB
                                                                         │                  lakeside_chess_db
                                                                         │                  lakeside_user_db
                                                                         └──▶ Auth0 Management API (find opponent by email)

portfolio contact form ──────POST──▶ API Gateway /api/email ──▶ email-lambda ──▶ SES
```

| Function | Route | Purpose |
| --- | --- | --- |
| `functions/chess` → `lakeside-chess-lambda` | `POST /api/chess` | Games: create, read, validate and save moves, list a player's games, start a game by email |
| `functions/email` → `email-lambda` | `POST /api/email` | Sends `{ email, subject, message }` to the site owner's inbox through SES |
| `functions/user` | not deployed | Looks up an Auth0 user by email. The Terraform for it is written but commented out. |

## Chess API

There is one endpoint. Every request is a `POST` with a JSON body, and the
handler decides what to do from which fields are present. The HTTP status is
always 200; the real result is in the body's `status` (`200` or `500`) and
`message`.

| Operation | Body | Response |
| --- | --- | --- |
| Get game | `{ game_id, player_id }` | `game_board` (FEN), `player_color`, `opponent_color`, `ai`, `moves`, `prev_move`, `w_knight`, `b_knight` |
| Move | `{ game_id, player_id, move: ["e7", "e8"], promotion? }` | Updated `game_board`, `ai`, knight tracking |
| New / reset game | `{ game_id?, player_id_1, player_id_2 }` | The created game. `player_id_1` plays white. Use `"CHESS_AI"` for the computer. Without `game_id`, a new ObjectId is generated. With an existing one, that game is overwritten. |
| Player's games | `{ user_id }` | `open_games`, `requested_games`, `closed_games` (JSON-encoded arrays) |
| Challenge by email | `{ game_id, challenger_id, opponent_email }` | Finds the opponent's Auth0 account and creates the game with the challenger as white |

Example:

```bash
curl -X POST https://backend.chess.aws-prac-route53.com/api/chess \
  -H "Content-Type: application/json" \
  -d '{ "player_id_1": "testPlayer", "player_id_2": "CHESS_AI" }'
```

### Move validation

`validate/validate.js` runs these checks for every move:

1. Load the stored FEN into chess.js.
2. Check that `player_id` is the player for the side to move, and that the
   piece on the `from` square is theirs.
3. Play the move with chess.js, which throws on an illegal move →
   `"Invalid piece movement"`.
4. On success, save the new FEN, add the move (SAN) to `moves`, and record
   `prev_move`. `updateGame()` then reads the item back and checks that the
   write actually landed.

The computer opponent runs in the browser. Its moves arrive under the player
id `CHESS_AI` and go through the same checks.

**Knight tracking.** `w_knight` and `b_knight` store each knight's last
`{ from, to }`, so the frontend can draw every knight facing the direction it
last moved. A pawn promoted to a knight adds an entry, and a captured knight
is cleared.

### Data model

Both tables are in **us-east-1** and aren't created by this Terraform. Every
attribute is a string; arrays are stored as JSON.

| Table | Key | Attributes |
| --- | --- | --- |
| `lakeside_chess_db` | `game_id` | `state`, `game_board` (FEN), `moves`, `prev_move`, `w_knight`, `b_knight`, `white_player_id`, `black_player_id` |
| `lakeside_user_db` | `user_id` | `open_games`, `requested_games`, `closed_games` |

A user row is created the first time that player is put into a game, and each
new game is added to both players' `open_games`.

## Deploy

**Before applying**, these must already exist in AWS (Terraform looks them
up rather than creating them):

- The two DynamoDB tables above
- An IAM role named `iam_for_lambda`. Terraform attaches
  `AmazonDynamoDBFullAccess` and `AmazonSESFullAccess` to it.
- The API Gateway custom domain `backend.chess.aws-prac-route53.com` and the
  Route 53 zone for `aws-prac-route53.com`. The base path mapping to the stage
  is commented out in `modules/api-gw/main.tf`, so map it in the console or
  un-comment it.
- A verified SES identity (us-west-1) for the email Lambda
- An Auth0 machine-to-machine app with `read:users` on the Management API, for
  challenge-by-email

Install each function's dependencies, because Terraform zips the whole
function folder, `node_modules` included:

```bash
(cd lambdas/functions/chess && npm install)
(cd lambdas/functions/email && npm install)
```

Then apply:

```bash
cd terraform/aws-enviroment
terraform init
terraform apply
```

This creates:

- Both Lambdas (`nodejs18.x`), packaged by `archive_file` into
  `lambdas/functions/<name>.zip`
- REST API `primary-api-gw` with `/api/chess` and `/api/email` (`ANY`,
  `AWS_PROXY`)
- A deployment and a stage named after the region (`us-east-1`), plus invoke
  permissions

The endpoint is
`https://<api-id>.execute-api.us-east-1.amazonaws.com/us-east-1/api/chess`,
or `https://backend.chess.aws-prac-route53.com/api/chess` through the custom
domain. Names, domain, and handler folder are set in
`terraform/aws-enviroment/locals.tf`.

## Running locally

`lambdas/netlify.toml` serves the chess function through Netlify Dev on port
3003:

```bash
cd lambdas
netlify dev
```

The function is at `http://localhost:3003/.netlify/functions/index`. It still
reads and writes the real DynamoDB tables, so your shell needs AWS
credentials.

## Project layout

```
lambdas/
  functions/
    chess/
      index.js                         Handler: picks the operation from the request body
      validate/validate.js             chess.js move validation and knight tracking
      dynamoDB/database-controller.js  Game and user reads/writes, Auth0 lookup by email
      ses/email-controller.js          Opponent invite email (written, not wired in yet)
    email/index.js                     Contact form → SES
    user/                              Auth0 user lookup by email (not deployed)
  netlify.toml                         Local run through Netlify Dev
terraform/
  aws-enviroment/                      Root module: names, domains, handler folder
  modules/api-gw/                      REST API, /api/chess + /api/email, stage, invoke permissions
  modules/api-gw/lambda/               Zips a function folder, creates the Lambda, attaches IAM policies
```

## Limitations

- The API has no authorization (`authorization = "NONE"`, CORS `*`). Anyone
  who knows a game id and the player ids in it can read or move in that game,
  including moving as `CHESS_AI`.
- Every response is HTTP 200, so clients have to check the body's `status`.
- `nodejs18.x` is deprecated on Lambda. The functions bundle `aws-sdk` v2
  themselves, so moving to a newer runtime should only need the `runtime`
  value changed in `modules/api-gw/lambda/main.tf`.
