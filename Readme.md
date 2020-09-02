# To Use

Create .env and fill in the tokens and port:

```env
DISCORD_TOKEN=token
SENTRY_TOKEN=token
PORT=port
```

Then start the bot with:

```powershell
npm install -g nearley
nearleyc .\commands.ne -o .\commands.js # Compile parsing grammar
node main.js # This will also start a web server for the admin console's backend at PORT
```
