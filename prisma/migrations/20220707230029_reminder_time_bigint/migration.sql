/*
  Warnings:

  - You are about to alter the column `time` on the `reminders` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reminders" (
    "author" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "text" TEXT,
    "time" BIGINT
);
INSERT INTO "new_reminders" ("author", "id", "text", "time") SELECT "author", "id", "text", "time" FROM "reminders";
DROP TABLE "reminders";
ALTER TABLE "new_reminders" RENAME TO "reminders";
CREATE UNIQUE INDEX "reminders_id_key" ON "reminders"("id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
