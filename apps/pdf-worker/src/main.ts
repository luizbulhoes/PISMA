import http from 'node:http';
import { sha256 } from '@pisma/security';

const port = Number(process.env.PORT ?? 3001);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'pisma-pdf-worker' }));
    return;
  }
  if (req.method === 'POST' && req.url === '/render') {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const hash = sha256(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          accepted: true,
          contentSha256: hash,
          note: 'Worker stub Onda 0 — renderização completa nas ondas de documentos',
        }),
      );
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, () => {
  console.log(`pdf-worker on :${port}`);
});
