import { writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Database from 'bun:sqlite';

// Load environment variables
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
    console.log('No .env file found, generating defaults');
}

// Generate JWT secret if not exists
if (!process.env.JWT_SECRET) {
    const crypto = await import('crypto');
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
    const envContent = `JWT_SECRET=${process.env.JWT_SECRET}\nPORT=3000\n`;
    await writeFile('.env', envContent);
    console.log('Generated new JWT secret and saved to .env');
}

const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Initialize SQLite database
const db = new Database('./floorball_data.sqlite');

// Initialize auth tables
function initializeAuthTables() {
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
            max_usage INTEGER,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        )
    `);

    // Create indices
    db.run('CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username)');

    // Check if default admin exists
    const adminCheck = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
    if (!adminCheck) {
        const defaultPassword = 'changeme123';
        const passwordHash = bcrypt.hashSync(defaultPassword, 12);
        db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', passwordHash);
        console.log('Created default admin account - Username: admin, Password: changeme123');
    }
}

initializeAuthTables();

// Helper to generate access codes
function generateAccessCode(length = 6) {
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Verify JWT token
async function verifyToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Get content type
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

Bun.serve({
    port: port,
    async fetch(req) {
        const url = new URL(req.url);
        let filePath = url.pathname;

        console.log(`Request: ${req.method} ${filePath}`);

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // IMPORTANT: Allow login page without auth!
        if (filePath === '/login.html' || filePath === '/login.css') {
            const file = Bun.file('.' + filePath);
            if (await file.exists()) {
                return new Response(file, {
                    headers: {
                        'Content-Type': getContentType(filePath),
                        ...corsHeaders
                    }
                });
            }
        }

        // Handle root path
        if (filePath === '/') {
            // Check if user has token in Authorization header (not required)
            const token = req.headers.get('Authorization');
            const decoded = await verifyToken(token);

            if (decoded) {
                // Has valid token, go to dashboard
                filePath = '/dashboard.html';
            } else {
                // No token, go to login
                filePath = '/login.html';
            }
        }

        // API: Admin login
        if (filePath === '/api/auth/admin/login' && req.method === 'POST') {
            try {
                const { username, password } = await req.json();
                console.log(`Login attempt for user: ${username}`);

                const user = db.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?').get(username);

                if (!user) {
                    console.log('User not found');
                    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                const validPassword = bcrypt.compareSync(password, user.password_hash);
                if (!validPassword) {
                    console.log('Invalid password');
                    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // Update last login
                db.prepare('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

                // Generate JWT token
                const token = jwt.sign(
                    {
                        id: user.id,
                        username: user.username,
                        type: 'admin',
                        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
                    },
                    JWT_SECRET
                );

                console.log('Login successful for:', username);

                return new Response(JSON.stringify({
                    success: true,
                    token,
                    user: { id: user.id, username: user.username }
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
        if (filePath === '/api/auth/code/verify' && req.method === 'POST') {
            try {
                const { code } = await req.json();
                console.log(`Code verification attempt: ${code}`);

                const accessCode = db.prepare(`
                    SELECT id, code, game_id, type, is_active, expires_at, usage_count, max_usage
                    FROM access_codes
                    WHERE UPPER(code) = UPPER(?) AND is_active = 1
                `).get(code);

                if (!accessCode) {
                    return new Response(JSON.stringify({ error: 'Invalid code' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // Check expiration
                if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
                    return new Response(JSON.stringify({ error: 'Code expired' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // Check max usage
                if (accessCode.max_usage && accessCode.usage_count >= accessCode.max_usage) {
                    return new Response(JSON.stringify({ error: 'Code usage limit reached' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // Increment usage
                db.prepare('UPDATE access_codes SET usage_count = usage_count + 1 WHERE id = ?').run(accessCode.id);

                // Generate JWT token
                const token = jwt.sign(
                    {
                        type: 'viewer',
                        access_code_id: accessCode.id,
                        access_type: accessCode.type,
                        game_id: accessCode.game_id,
                        exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60)
                    },
                    JWT_SECRET
                );

                return new Response(JSON.stringify({
                    success: true,
                    token,
                    access_type: accessCode.type,
                    game_id: accessCode.game_id
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('Code verification error:', error);
                return new Response(JSON.stringify({ error: 'Verification failed' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Verify session
        if (filePath === '/api/auth/verify' && req.method === 'GET') {
            const decoded = await verifyToken(req.headers.get('Authorization'));

            if (!decoded) {
                return new Response(JSON.stringify({ valid: false }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({
                valid: true,
                user: decoded
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // API: Admin endpoints
        if (filePath.startsWith('/api/admin/')) {
            const decoded = await verifyToken(req.headers.get('Authorization'));

            if (!decoded || decoded.type !== 'admin') {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Get all access codes
            if (filePath === '/api/admin/codes' && req.method === 'GET') {
                try {
                    const codes = db.prepare(`
                        SELECT
                            ac.id, ac.code, ac.game_id, ac.type, ac.description,
                            ac.created_at, ac.expires_at, ac.usage_count, ac.max_usage, ac.is_active,
                            g.name as game_name
                        FROM access_codes ac
                        LEFT JOIN games g ON ac.game_id = g.id
                        ORDER BY ac.created_at DESC
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

            // Create new access code
            if (filePath === '/api/admin/codes' && req.method === 'POST') {
                try {
                    const { game_id, type, description, expires_at, max_usage } = await req.json();
                    const code = generateAccessCode();

                    db.prepare(`
                        INSERT INTO access_codes (code, game_id, type, description, expires_at, max_usage)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(code, game_id, type, description, expires_at, max_usage);

                    console.log(`New access code created: ${code}`);

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

            // Delete access code
            if (filePath.match(/^\/api\/admin\/codes\/\d+$/) && req.method === 'DELETE') {
                try {
                    const codeId = filePath.split('/').pop();
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
        }

        // Protected routes - check authentication for dashboard
        if (filePath === '/dashboard.html' || filePath.startsWith('/api/')) {
            const token = req.headers.get('Authorization');
            const decoded = await verifyToken(token);

            if (!decoded && !filePath.startsWith('/api/auth/')) {
                // No valid token for protected resource
                console.log('No valid token for protected resource:', filePath);

                // For HTML pages, redirect to login
                if (filePath.endsWith('.html')) {
                    filePath = '/login.html';
                } else {
                    // For API calls, return 401
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }
        }

        // Block direct access to old index.html
        if (filePath === '/index.html') {
            filePath = '/dashboard.html';
        }

        // Serve static files (CSS, JS, images)
        if (filePath.startsWith('/public/')) {
            const file = Bun.file('.' + filePath);
            if (await file.exists()) {
                return new Response(file, {
                    headers: {
                        'Content-Type': getContentType(filePath),
                        ...corsHeaders
                    }
                });
            }
        }

        // Try to serve the requested file
        const file = Bun.file('.' + filePath);
        if (await file.exists()) {
            return new Response(file, {
                headers: {
                    'Content-Type': getContentType(filePath),
                    ...corsHeaders
                }
            });
        }

        return new Response('File not found', { status: 404 });
    },
    error() {
        return new Response('Internal Server Error', { status: 500 });
    }
});

console.log(`🔒 Secure server running at http://localhost:${port}`);
console.log(`📝 Login at: http://localhost:${port}/login.html`);
console.log(`⚠️  Default admin: admin / changeme123`);
console.log('\nServer logs:');