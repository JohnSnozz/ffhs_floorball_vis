// SIMPLE WORKING SERVER - NO LOOPS!
import { existsSync, readFileSync } from 'fs';

const port = 3000;

// Simple file server
Bun.serve({
    port: port,
    async fetch(req) {
        const url = new URL(req.url);
        let path = url.pathname;

        console.log(`Request: ${path}`);

        // Root goes to login
        if (path === '/') {
            path = '/login.html';
        }

        // Serve the file
        try {
            const file = Bun.file('.' + path);
            if (await file.exists()) {
                // Determine content type
                let contentType = 'text/plain';
                if (path.endsWith('.html')) contentType = 'text/html';
                else if (path.endsWith('.css')) contentType = 'text/css';
                else if (path.endsWith('.js')) contentType = 'application/javascript';
                else if (path.endsWith('.json')) contentType = 'application/json';

                return new Response(file, {
                    headers: {
                        'Content-Type': contentType
                    }
                });
            }
        } catch (e) {
            console.error('Error:', e);
        }

        return new Response('File not found: ' + path, { status: 404 });
    }
});

console.log(`Server running at http://localhost:${port}`);
console.log('Go to http://localhost:3000/login.html');