# To Use

![Build](https://github.com/scratchyone/modbot/workflows/Build/badge.svg)

Create .env and fill in the required options:

```powershell
DISCORD_TOKEN # Required
SENTRY_TOKEN # Optional, used for reporting errors to sentry.io
SUGGESTIONMANAGER_URL # Base URL of suggestionmanager backend, optional but required for suggestion command to work
SUGGESTIONMANAGER_TOKEN # Token from url for submit suggestion page on suggestionmanager, optional but required for suggestion command to work
MEDIAGEN_URL # URL for a mediagen deployment (scratchyone/mediagen), optional but required for poll and owo commands to work
```

Then start the bot with:

```powershell
npm install
npm run build # Compile everything
npx knex migrate:latest # Runs all DB migrations
node build/main.js # Make sure to start the bot from the root directory and not the build directory or the DB will be lost on rebuild
```

# Contributing

When making a pull request, make sure to run `npm run test`. This closely matches the tests run by GitHub Actions. Your change will not be merged if it fails these tests. `npm run dev` is also very helpful for development, so you don't need to recompile the project on every change. You can create new DB migrations with `npx knex migrate:make NAME`. When adding commands, prefer to use a simple command with multiple `util_functions.ask` steps over a long and complicated command with many arguments. If you add a new command, you're going to need to register it in `types.ts` as well as `commands.ne`
