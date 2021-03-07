/*
  Warnings:

  - Made the column `token` on table `capabilities` required. The migration will fail if there are existing NULL values in that column.

*/

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_capabilities" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT,
    "type" TEXT,
    "expire" INTEGER
);
INSERT INTO "new_capabilities" ("token", "user", "type", "expire") SELECT "token", "user", "type", "expire" FROM "capabilities";
DROP TABLE "capabilities";
ALTER TABLE "new_capabilities" RENAME TO "capabilities";
CREATE TABLE "new_reminderSubscribers" (
    "user" TEXT NOT NULL,
    "id" TEXT NOT NULL,

    PRIMARY KEY ("user", "id")
);
INSERT INTO "new_reminderSubscribers" ("user", "id") SELECT "user", "id" FROM "reminderSubscribers";
DROP TABLE "reminderSubscribers";
ALTER TABLE "new_reminderSubscribers" RENAME TO "reminderSubscribers";
CREATE TABLE "new_slowmodes" (
    "channel" TEXT NOT NULL PRIMARY KEY,
    "time" INTEGER NOT NULL,
    "delete_mm" INTEGER NOT NULL
);
INSERT INTO "new_slowmodes" ("channel", "time", "delete_mm") SELECT "channel", "time", "delete_mm" FROM "slowmodes";
DROP TABLE "slowmodes";
ALTER TABLE "new_slowmodes" RENAME TO "slowmodes";
CREATE TABLE "new_timerevents" (
    "timestamp" BIGINT NOT NULL,
    "event" TEXT NOT NULL,

    PRIMARY KEY ("timestamp", "event")
);
INSERT INTO "new_timerevents" ("timestamp", "event") SELECT "timestamp", "event" FROM "timerevents";
DROP TABLE "timerevents";
ALTER TABLE "new_timerevents" RENAME TO "timerevents";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
