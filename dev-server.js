// Simple development server using Bun
import { writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

        const dbPath = join('./public/assets/shots_database.sqlite');
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

    // Handle logging endpoint
    if (filePath === '/api/log' && req.method === 'POST') {
      try {
        const logEntry = await req.json();
        const date = new Date().toISOString().split('T')[0];
        const logFileName = `${date}-app.log`;
        const logPath = join('./logs', logFileName);

        // Ensure logs directory exists
        if (!existsSync('./logs')) {
          await mkdir('./logs', { recursive: true });
        }

        // Format log entry
        const logLine = `[${logEntry.timestamp}] [${logEntry.level}] ${logEntry.category}: ${logEntry.message}`;
        const dataLine = logEntry.data ? `\nData: ${logEntry.data}` : '';
        const fullLogEntry = `${logLine}${dataLine}\n\n`;

        // Append to log file
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

    // Remove leading slash and construct file path from public folder
    const file = Bun.file('./public' + filePath);

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
    return new Response('File not found', { status: 404 });
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

console.log(`🚀 Development server running at http://localhost:${port}`);
console.log(`📁 Serving files from: ${process.cwd()}`);
console.log(`🛑 Press Ctrl+C to stop the server`);