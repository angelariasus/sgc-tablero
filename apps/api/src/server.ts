import { buildApp } from "./app";
import { assemble } from "./bootstrap";
import { loadEnv } from "./env";

async function main() {
  const env = loadEnv();
  const { deps, handle, log } = await assemble(env);
  const app = await buildApp(deps);
  log.forEach((l) => app.log.info(l));
  const close = async (sig: string) => {
    app.log.info(`${sig}: cerrando…`);
    await app.close().catch(() => {});
    await handle.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void close("SIGTERM"));
  process.on("SIGINT", () => void close("SIGINT"));
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
