/*
  Warnings:

  - You are about to alter the column `removable` on the `reactionroles` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("undefined")` to `Int`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reactionroles" (
    "message" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "removable" INTEGER NOT NULL,

    PRIMARY KEY ("message", "emoji", "server")
);
INSERT INTO "new_reactionroles" ("message", "server", "emoji", "role", "removable") SELECT "message", "server", "emoji", "role", "removable" FROM "reactionroles";
DROP TABLE "reactionroles";
ALTER TABLE "new_reactionroles" RENAME TO "reactionroles";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
