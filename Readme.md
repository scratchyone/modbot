# To Use

![Build](https://github.com/scratchyone/modbot/workflows/Build/badge.svg)

Create .env and fill in the tokens and port:

```powershell
DISCORD_TOKEN # Required
SENTRY_TOKEN # Optional
UPLOAD_CHANNEL # ID of channel used to upload images to discord cdn, optional but required for poll command to work
SUGGESTIONMANAGER_URL # Base URL of suggestionmanager backend, optional but required for suggestion command to work
SUGGESTIONMANAGER_TOKEN # Token from url for submit suggestion page on suggestionmanager, optional but required for suggestion command to work
```

Then start the bot with:

```powershell
npm install
npm run nearley # Compile parsing grammar
npm run tsc # Compile typescript
npx knex migrate:latest # Runs all DB migrations
node main.js
```

# Contributing

When making a pull request, make sure to run `npm run test`. This closely matches the tests run by GitHub Actions. Your change will not be merged if it fails these tests. `npm run dev` is also very helpful for development, so you don't need to recompile the project on every change. If you add a new TypeScript file, make sure that you add the path of the generated JavaScript file to `.gitignore` and to the `clear` script in `package.json`. You can create new DB migrations with `npx knex migrate:make NAME`. When adding commands, prefer to use a simple command with multiple `util_functions.ask` steps over a long and complicated command with many arguments
