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

  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
    if (caPath && fs.existsSync(caPath)) {
      options.ca = fs.readFileSync(caPath);
    }
    https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
      console.log('HTTPS server running on port ' + PORT);
    });
  } else {
    console.log('SSL certificates not found, starting HTTP server');
    app.listen(PORT, '0.0.0.0', () => {
      console.log('HTTP server running on port ' + PORT);
    });
  }

  http.createServer((req, res) => {
    if (certPath && keyPath) {
      res.writeHead(301, { Location: 'https://' + req.headers.host + req.url });
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Stock Management API - HTTP fallback');
    }
  }).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('HTTP redirect server running on port ' + HTTP_PORT);
  });
}

start().catch(err => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
