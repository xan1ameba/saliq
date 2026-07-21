/* Tiny static file server for Saliq AI — run with:  node server.js
   Serves the site at http://localhost:5500 and http://localhost:3000
   (3000 is Supabase's default Site URL, so login tokens are caught
   even if the Supabase URL settings still have the default value) */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORTS = [5500, 3000];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.mp3':  'audio/mpeg',
  '.mp4':  'video/mp4',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf'
};

function handler(req, res) {
  const urlPath  = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relative);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found: ' + urlPath);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

PORTS.forEach((port) => {
  const server = http.createServer(handler);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use — skipping it (the site may already be running there).`);
    } else {
      console.error(`Server error on port ${port}:`, err.message);
    }
  });

  server.listen(port, () => {
    console.log(`Saliq AI is running at  http://localhost:${port}`);
  });
});

console.log('Keep this window open while using the site. Press Ctrl+C to stop.');
