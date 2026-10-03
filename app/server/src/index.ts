import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { openDatabase } from './db/database.js';

const database = openDatabase();
const server = createServer(
  createApp(database, { serveFrontend: config.isProduction }),
);

server.listen(config.port, config.host, () => {
  console.log(`Books web app listening at http://${config.host}:${config.port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; shutting down`);
  server.close((error) => {
    database.close();
    if (error) {
      console.error('Failed to close the HTTP server cleanly', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
