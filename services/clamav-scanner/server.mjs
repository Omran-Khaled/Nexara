import { createServer } from 'node:http';
import { connect } from 'node:net';
import { timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 8080);
const clamdHost = process.env.CLAMD_HOST || '127.0.0.1';
const clamdPort = Number(process.env.CLAMD_PORT || 3310);
const authToken = process.env.SCANNER_AUTH_TOKEN || '';
const maxBytes = Number(process.env.SCANNER_MAX_BYTES || 52_428_800);

if (!authToken) throw new Error('SCANNER_AUTH_TOKEN is required.');
if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('SCANNER_MAX_BYTES must be a positive integer.');

function authorized(request) {
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const expected = Buffer.from(authToken);
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function clamdCommand(command) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: clamdHost, port: clamdPort });
    const chunks = [];
    const timer = setTimeout(() => socket.destroy(new Error('ClamAV timed out.')), 15_000);
    socket.on('connect', () => socket.write(command));
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')); });
    socket.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

function scan(buffer) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: clamdHost, port: clamdPort });
    const response = [];
    const timer = setTimeout(() => socket.destroy(new Error('ClamAV timed out.')), 30_000);
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, Math.min(buffer.length, offset + 64 * 1024));
        const length = Buffer.allocUnsafe(4); length.writeUInt32BE(chunk.length);
        socket.write(length); socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (chunk) => response.push(chunk));
    socket.on('end', () => {
      clearTimeout(timer);
      const result = Buffer.concat(response).toString('utf8');
      if (/\bOK\b/.test(result)) return resolve('CLEAN');
      if (/\bFOUND\b/.test(result)) return resolve('INFECTED');
      reject(new Error(`Unexpected ClamAV response: ${result.slice(0, 200)}`));
    });
    socket.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (!authorized(request)) return send(response, 401, { error: 'UNAUTHORIZED' });
  try {
    if (request.method === 'GET' && request.url === '/health') {
      const result = await clamdCommand('zPING\0');
      return result.includes('PONG') ? send(response, 200, { ready: true }) : send(response, 503, { ready: false });
    }
    if (request.method === 'POST' && request.url === '/scan') {
      if (request.headers['content-type'] !== 'application/octet-stream') return send(response, 415, { error: 'UNSUPPORTED_MEDIA_TYPE' });
      const body = await readBody(request);
      const status = await scan(body);
      return send(response, 200, { status });
    }
    return send(response, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    return send(response, error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 503, { error: 'SCANNER_UNAVAILABLE' });
  }
}).listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'clamav_scanner_started', port })));
