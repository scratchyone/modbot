# To Use

![Build](https://github.com/scratchyone/modbot/workflows/Build/badge.svg)

Create .env and fill in the tokens and port:

```powershell
DISCORD_TOKEN # Required
SENTRY_TOKEN # Optional
UPLOAD_CHANNEL # ID of channel used to upload images to discord cdn
SUGGESTIONMANAGER_URL # Base URL of suggestionmanager backend
SUGGESTIONMANAGER_TOKEN # Token from url for submit suggestion page on suggestionmanager
```

Then start the bot with:

```powershell
npm install
npm run nearley # Compile parsing grammar
npm run tsc # Compile typescript
npx knex migrate:latest # Runs all DB migrations
node main.js # This will also start a web server if PORT is set
```
