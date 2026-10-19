import app from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const server = app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`KrishiSetu API listening on port ${config.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
