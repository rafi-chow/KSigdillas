import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  return port;
}
export async function testPostgres() {
  const directory = await mkdtemp(join(tmpdir(), "ksigdillas-test-pg-"));
  const port = await freePort();
  const instance = new EmbeddedPostgres({
    databaseDir: directory,
    port,
    user: "postgres",
    password: "local-test-only",
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
    postgresFlags: ["-h", "127.0.0.1", "-k", directory],
  });
  await instance.initialise();
  await instance.start();
  return {
    instance,
    url: `postgresql://postgres:local-test-only@127.0.0.1:${port}/postgres`,
    port,
  };
}
