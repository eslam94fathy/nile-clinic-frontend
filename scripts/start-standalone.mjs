// `pnpm start`: the standalone server, as the Docker image runs it (ADR 0022), on this computer only. The server listens
// on HOSTNAME, which Git Bash and some other shells set to the computer's name, so it's always given here; set
// START_HOSTNAME to listen elsewhere. Settings come from `.env.local` through Node's `--env-file-if-exists`.
process.env.HOSTNAME = process.env.START_HOSTNAME ?? "localhost";
await import("../.next/standalone/server.js");
