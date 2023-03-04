# To Use

![Build](https://github.com/scratchyone/modbot/workflows/Build/badge.svg)

Create .env and fill in the required options:

```powershell
DISCORD_TOKEN # Required
SENTRY_TOKEN # Optional, used for reporting errors to sentry.io
SUGGESTIONMANAGER_URL # Base URL of suggestionmanager backend, optional but required for suggestion command to work
SUGGESTIONMANAGER_TOKEN # Token from url for submit suggestion page on suggestionmanager, optional but required for suggestion command to work
MEDIAGEN_URL # URL for a mediagen deployment (scratchyone/mediagen), optional but required for poll and owo commands to work
PORT # Optional, required for web UI to work
UI_URL # Optional, URL for the deployment of the web UI, required for web UI to work
AUTHOR_NAME # Optional, name of the author of the bot, used in m: about command
BUCKET_NAME # Optional, name of Google Cloud Storage bucket
BOT_PREFIX # Optional, change default prefix
LOG_LEVEL # Optional, change default log level
WOLFRAMALPHA_KEY # WolframAlpha API key, required for m: alpha command
OPENAI_KEY # OpenAI API key, required for m: ask command
```

Then start the bot with:

```powershell
npm install
npx prisma generate # Generate library
npx prisma migrate deploy # Run DB migrations
npm run build # Compile everything
node build/main.js # Make sure to start the bot from the root directory and not the build directory or the DB will be lost on rebuild
```

# Contributing

When making a pull request, make sure to run `npm run test`. This closely matches the tests run by GitHub Actions. Your change will not be merged if it fails these tests. `npm run dev` is also very helpful for development, so you don't need to recompile the project on every change.
