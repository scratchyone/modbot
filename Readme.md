# To Use
![Node.js CI](https://github.com/scratchyone/modbot/workflows/Node.js%20CI/badge.svg)


Create .env and fill in the tokens and port:

```powershell
DISCORD_TOKEN # Required
SENTRY_TOKEN # Optional
PORT # Optional
UPDATE_COMMAND # Command(s) used to update and restart the bot, __ID__ will be replaced with the id given in the command, optional
UPLOAD_CHANNEL #ID of channel used to upload images to discord cdn
```

Then start the bot with:

```powershell
npm install -g nearley
npm install -g db-migrate
npm install
npx db-migrate up # Runs all DB migrations
nearleyc .\commands.ne -o .\commands.js # Compile parsing grammar
node main.js # This will also start a web server if PORT is set
```
