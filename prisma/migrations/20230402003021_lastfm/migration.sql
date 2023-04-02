-- CreateTable
CREATE TABLE "lastFmAccounts" (
    "discordUser" TEXT NOT NULL PRIMARY KEY,
    "lastFmUser" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "lastFmAccounts_lastFmUser_key" ON "lastFmAccounts"("lastFmUser");
