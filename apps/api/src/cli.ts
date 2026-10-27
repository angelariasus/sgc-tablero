import { connectPglite, connectPostgres } from "@sgc/db";
import { loadEnv } from "./env";
import { seedAll } from "./seed";

const cmd = process.argv[2];
const env = loadEnv({ ...process.env, DEV_AUTH: process.env.DEV_AUTH ?? "true" });
const handle = env.DATABASE_URL ? await connectPostgres(env.DATABASE_URL, { max: 2 }) : await connectPglite(env.PGLITE_DIR);
try {
  if (cmd === "migrate") {
    await handle.migrate();
    console.log("Migraciones aplicadas.");
  } else if (cmd === "seed") {
    await handle.migrate();
    console.log(await seedAll(handle.db));
  } else {
    console.error("Uso: cli.ts migrate | seed");
    process.exitCode = 1;
  }
} finally {
  await handle.close();
}
