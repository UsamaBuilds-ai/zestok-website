const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const https = require('https');
const http = require('http');
const fs = require('fs');

const app = require('../src/server');
const { ensureMasterDb } = require('../src/db/pool');

const PORT = parseInt(process.env.API_PORT, 10) || 443;
const HTTP_PORT = parseInt(process.env.API_HTTP_PORT, 10) || 80;

async function start() {
  try {
    await ensureMasterDb();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    console.log('Server will start but database operations may fail');
  }

  const certPath = process.env.SSL_CERT_PATH;
  const keyPath = process.env.SSL_KEY_PATH;
  const caPath = process.env.SSL_CA_PATH;

  if (!certPath || !keyPath || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('SSL certificates required. Set SSL_CERT_PATH and SSL_KEY_PATH in .env');
    process.exit(1);
  }

  const options = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
  if (caPath && fs.existsSync(caPath)) {
    options.ca = fs.readFileSync(caPath);
  }

  const httpsServer = https.createServer(options, app);
  httpsServer.listen(PORT, '0.0.0.0', () => {
    console.log('HTTPS server running on port ' + PORT);
  });
  httpsServer.on('error', (err) => {
    console.error('HTTPS server error:', err.message);
    process.exit(1);
  });

  const httpServer = http.createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers.host + req.url });
    res.end();
  });
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('HTTP redirect server running on port ' + HTTP_PORT);
  });
  httpServer.on('error', (err) => {
    console.error('HTTP redirect server error:', err.message);
  });
}

start().catch(err => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
