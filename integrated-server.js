// INTEGRATED SERVER - Based on working standalone version
import { writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Database from 'bun:sqlite';

// Load or create JWT secret
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    const crypto = await import('crypto');
    JWT_SECRET = crypto.randomBytes(64).toString('hex');

    // Save to .env for persistence
    const envContent = `JWT_SECRET=${JWT_SECRET}\nPORT=3000\n`;
    await writeFile('.env', envContent);
    console.log('Generated new JWT secret');
}

const port = 3000;

// Initialize database
const db = new Database('./floorball_data.sqlite');

// Create tables if not exist
db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS access_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        game_id INTEGER,
        type TEXT NOT NULL CHECK(type IN ('game', 'season')),
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        usage_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )
`);

// Create default admin if not exists
const adminCheck = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
if (!adminCheck) {
    const passwordHash = bcrypt.hashSync('changeme123', 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', passwordHash);
    console.log('Created default admin: admin / changeme123');
}

// Create sample access codes if none exist
const codeCheck = db.prepare('SELECT COUNT(*) as count FROM access_codes').get();
if (codeCheck.count === 0) {
    db.prepare('INSERT INTO access_codes (code, type, description) VALUES (?, ?, ?)').run('TEST01', 'season', 'Test Season Access');
    db.prepare('INSERT INTO access_codes (code, type, description) VALUES (?, ?, ?)').run('GAME01', 'game', 'Test Game Access');
    console.log('Created sample access codes: TEST01, GAME01');
}

// Helper functions
function generateAccessCode() {
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function getContentType(path) {
    if (path.endsWith('.html')) return 'text/html';
    if (path.endsWith('.css')) return 'text/css';
    if (path.endsWith('.js')) return 'application/javascript';
    if (path.endsWith('.json')) return 'application/json';
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    return 'text/plain';
}

// Start server
Bun.serve({
    port: port,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;
        const method = req.method;

        console.log(`${method} ${path}`);

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };

        // Handle CORS preflight
        if (method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // API: Admin login
        if (path === '/api/admin/login' && method === 'POST') {
            try {
                const { username, password } = await req.json();

                const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

                if (!user || !bcrypt.compareSync(password, user.password_hash)) {
                    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // Update last login
                db.prepare('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

                // Create token
                const token = jwt.sign(
                    { id: user.id, username: user.username, type: 'admin' },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                return new Response(JSON.stringify({
                    success: true,
                    token,
                    user: { username: user.username, type: 'admin' }
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                console.error('Login error:', error);
                return new Response(JSON.stringify({ error: 'Login failed' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Code verification
        if (path === '/api/code/verify' && method === 'POST') {
            try {
                const { code } = await req.json();

                const accessCode = db.prepare(
                    'SELECT * FROM access_codes WHERE UPPER(code) = UPPER(?) AND is_active = 1'
                ).get(code);

                if (!accessCode) {
                    return new Response(JSON.stringify({ error: 'Invalid code' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // Increment usage
                db.prepare('UPDATE access_codes SET usage_count = usage_count + 1 WHERE id = ?').run(accessCode.id);

                // Create token
                const token = jwt.sign(
                    {
                        type: 'viewer',
                        code: accessCode.code,
                        accessType: accessCode.type,
                        gameId: accessCode.game_id
                    },
                    JWT_SECRET,
                    { expiresIn: '8h' }
                );

                return new Response(JSON.stringify({
                    success: true,
                    token,
                    accessType: accessCode.type
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                console.error('Code verify error:', error);
                return new Response(JSON.stringify({ error: 'Verification failed' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Get all access codes (admin only)
        if (path === '/api/codes' && method === 'GET') {
            // Simple auth check via Authorization header
            const authHeader = req.headers.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, JWT_SECRET);

                if (decoded.type !== 'admin') {
                    return new Response(JSON.stringify({ error: 'Admin access required' }), {
                        status: 403,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                const codes = db.prepare(`
                    SELECT
                        c.*,
                        g.name as game_name
                    FROM access_codes c
                    LEFT JOIN games g ON c.game_id = g.id
                    ORDER BY c.created_at DESC
                `).all();

                return new Response(JSON.stringify(codes), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                console.error('Get codes error:', error);
                return new Response(JSON.stringify({ error: 'Failed to get codes' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Create new access code (admin only)
        if (path === '/api/codes' && method === 'POST') {
            const authHeader = req.headers.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, JWT_SECRET);

                if (decoded.type !== 'admin') {
                    return new Response(JSON.stringify({ error: 'Admin access required' }), {
                        status: 403,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                const { type, description, gameId } = await req.json();
                const code = generateAccessCode();

                db.prepare(
                    'INSERT INTO access_codes (code, type, description, game_id) VALUES (?, ?, ?, ?)'
                ).run(code, type || 'season', description || 'Generated Code', gameId || null);

                return new Response(JSON.stringify({ success: true, code }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                console.error('Create code error:', error);
                return new Response(JSON.stringify({ error: 'Failed to create code' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Delete access code (admin only)
        if (path.startsWith('/api/codes/') && method === 'DELETE') {
            const authHeader = req.headers.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, JWT_SECRET);

                if (decoded.type !== 'admin') {
                    return new Response(JSON.stringify({ error: 'Admin access required' }), {
                        status: 403,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                const codeId = path.split('/').pop();
                db.prepare('DELETE FROM access_codes WHERE id = ?').run(codeId);

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                console.error('Delete code error:', error);
                return new Response(JSON.stringify({ error: 'Failed to delete code' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Serve static files
        try {
            let filePath = path;

            // Default to standalone dashboard
            if (filePath === '/') {
                filePath = '/standalone-dashboard.html';
            }

            const file = Bun.file('.' + filePath);

            if (await file.exists()) {
                return new Response(file, {
                    headers: {
                        'Content-Type': getContentType(filePath),
                        ...corsHeaders
                    }
                });
            }
        } catch (error) {
            console.error('File error:', error);
        }

        return new Response('Not found', { status: 404 });
    }
});

console.log(`
🚀 Integrated Server Running!
================================
URL: http://localhost:${port}
Dashboard: http://localhost:${port}/standalone-dashboard.html

Default Logins:
- Admin: admin / changeme123
- Viewer Codes: TEST01, GAME01

API Endpoints:
- POST /api/admin/login
- POST /api/code/verify
- GET  /api/codes (admin only)
- POST /api/codes (admin only)
- DELETE /api/codes/:id (admin only)
================================
`);