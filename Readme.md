# To Use

Create .env and fill in the tokens and port:

```powershell
DISCORD_TOKEN=token # Required
SENTRY_TOKEN=token # Optional
PORT=port # Optional
```

Then start the bot with:

```powershell
npm install -g nearley
npm install -g db-migrate
db-migrate up # Runs all DB migrations
nearleyc .\commands.ne -o .\commands.js # Compile parsing grammar
node main.js # This will also start a web server if PORT is set
```
