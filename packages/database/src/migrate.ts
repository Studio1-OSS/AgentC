import { createDatabase, migrateDatabase } from "./client.js";

const url = process.env.DATABASE_URL ?? "file:./data/cloud-agent.db";
const { sqlite } = createDatabase(url);
migrateDatabase(sqlite);
sqlite.close();
console.log(`Migrated database at ${url}`);
