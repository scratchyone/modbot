# To Use

Create .env and fill in the tokens and port:

```powershell
DISCORD_TOKEN=token # Required
SENTRY_TOKEN=token # Optional
PORT=port # Optional
UPDATE_COMMAND # Command(s) used to update and restart the bot, __ID__ will be replaced with the id given in the command, optional
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
