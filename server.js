import { writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// Load .env file if it exists
try {
  const envPath = './.env';
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
} catch (error) {
  console.log('No .env file found, using defaults');
}

const port = process.env.PORT || 3000;

Bun.serve({
  port: port,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname;

    // Handle database save endpoint
    if (filePath === '/api/save-database' && req.method === 'POST') {
      try {
        const arrayBuffer = await req.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const dbPath = join('./floorball_data.sqlite');
        await writeFile(dbPath, uint8Array);

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        console.error('Database save error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Handle debug logging endpoint
    if (filePath === '/api/debug-log' && req.method === 'POST') {
      try {
        const logEntry = await req.json();
        const date = new Date().toISOString().split('T')[0];
        const logFileName = `${date}-debug.log`;
        const logPath = join('./dev/logs', logFileName);

        if (!existsSync('./dev/logs')) {
          await mkdir('./dev/logs', { recursive: true });
        }

        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${logEntry.message}`;
        const dataLine = logEntry.data ? `\nData: ${logEntry.data}` : '';
        const fullLogEntry = `${logLine}${dataLine}\n\n`;

        await appendFile(logPath, fullLogEntry);

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        console.error('Logging error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Default to index.html for root
    if (filePath === '/') {
      filePath = '/index.html';
    }

    // Serve static files
    const file = Bun.file('.' + filePath);

    // Check if file exists
    const fileExists = await file.exists();
    if (!fileExists) {
      return new Response('File not found', { status: 404 });
    }

    // Set content type based on file extension
    const contentType = getContentType(filePath);

    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  },
  error() {
    return new Response('Internal Server Error', { status: 500 });
  },
});

function getContentType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const mimeTypes = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'csv': 'text/csv',
    'sqlite': 'application/octet-stream',
    'wasm': 'application/wasm'
  };

  return mimeTypes[ext] || 'text/plain';
}

console.log(`Server running at http://localhost:${port}`);
console.log(`Serving files from: ${process.cwd()}`);
console.log(`Press Ctrl+C to stop the server`);
