import { writeFile, appendFile, mkdir, readFile } from 'fs/promises';
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

    // Save to .env for persistence
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
    // Admin users table
    db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )
    `);

    // Access codes table
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

    // Create indices for performance
    db.run('CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username)');

    // Check if default admin exists
    const adminCheck = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
    if (!adminCheck) {
        // Create default admin account (password: changeme123)
        const defaultPassword = 'changeme123';
        const passwordHash = bcrypt.hashSync(defaultPassword, 12);
        db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', passwordHash);
        console.log('Created default admin account - Username: admin, Password: changeme123 (PLEASE CHANGE!)');
    }
}

initializeAuthTables();

// Helper function to generate access codes
function generateAccessCode(length = 6) {
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Middleware to verify JWT token
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

// Public paths that don't require authentication
const publicPaths = [
    '/login.html',
    '/api/auth/admin/login',
    '/api/auth/code/verify'
];

// Check if path is public
function isPublicPath(path) {
    // Always allow login page and auth endpoints
    if (publicPaths.includes(path)) return true;

    // Allow CSS files for login page
    if (path === '/login.css') return true;

    return false;
}

// Check if path requires admin access
function requiresAdmin(path) {
    const adminPaths = [
        '/api/admin/',
        '/api/save-database',
        '/api/debug-log',
        '/index.html',  // Old import page
        '/import'
    ];

    return adminPaths.some(adminPath => path.startsWith(adminPath));
}

Bun.serve({
    port: port,
    async fetch(req) {
        const url = new URL(req.url);
        let filePath = url.pathname;

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Redirect root to login if not authenticated
        if (filePath === '/') {
            const token = req.headers.get('Authorization');
            const decoded = await verifyToken(token);

            if (!decoded) {
                // Redirect to login
                return new Response(null, {
                    status: 302,
                    headers: {
                        'Location': '/login.html',
                        ...corsHeaders
                    }
                });
            } else {
                // Redirect to dashboard if authenticated
                return new Response(null, {
                    status: 302,
                    headers: {
                        'Location': '/dashboard.html',
                        ...corsHeaders
                    }
                });
            }
        }

        // Check authentication for protected resources
        if (!isPublicPath(filePath)) {
            const token = req.headers.get('Authorization');
            const decoded = await verifyToken(token);

            // For HTML pages without token, redirect to login
            if (!decoded && filePath.endsWith('.html')) {
                return new Response(null, {
                    status: 302,
                    headers: {
                        'Location': '/login.html',
                        ...corsHeaders
                    }
                });
            }

            // For API calls without token, return 401
            if (!decoded && (filePath.startsWith('/api/') || filePath.startsWith('/public/'))) {
                return new Response(JSON.stringify({ error: 'Authentication required' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Check admin access for restricted paths
            if (decoded && requiresAdmin(filePath) && decoded.type !== 'admin') {
                return new Response(JSON.stringify({ error: 'Admin access required' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Authentication endpoints

        // Admin login
        if (filePath === '/api/auth/admin/login' && req.method === 'POST') {
            try {
                const { username, password } = await req.json();

                const user = db.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?').get(username);

                if (!user || !bcrypt.compareSync(password, user.password_hash)) {
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
                        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
                    },
                    JWT_SECRET
                );

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

        // Code-based access
        if (filePath === '/api/auth/code/verify' && req.method === 'POST') {
            try {
                const { code } = await req.json();

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

                // Generate JWT token for viewer
                const token = jwt.sign(
                    {
                        type: 'viewer',
                        access_code_id: accessCode.id,
                        access_type: accessCode.type,
                        game_id: accessCode.game_id,
                        exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 hours
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

        // Verify session endpoint
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

        // Admin-only endpoints (require admin auth)
        if (filePath.startsWith('/api/admin/')) {
            const decoded = await verifyToken(req.headers.get('Authorization'));

            if (!decoded || decoded.type !== 'admin') {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Change admin password
            if (filePath === '/api/admin/change-password' && req.method === 'POST') {
                try {
                    const { currentPassword, newPassword } = await req.json();

                    const user = db.prepare('SELECT password_hash FROM admin_users WHERE id = ?').get(decoded.id);

                    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
                        return new Response(JSON.stringify({ error: 'Current password incorrect' }), {
                            status: 400,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    const newHash = bcrypt.hashSync(newPassword, 12);
                    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(newHash, decoded.id);

                    return new Response(JSON.stringify({ success: true }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                } catch (error) {
                    console.error('Password change error:', error);
                    return new Response(JSON.stringify({ error: 'Failed to change password' }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
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

            // Update access code
            if (filePath.match(/^\/api\/admin\/codes\/\d+$/) && req.method === 'PUT') {
                try {
                    const codeId = filePath.split('/').pop();
                    const updates = await req.json();

                    const allowedFields = ['description', 'expires_at', 'max_usage', 'is_active'];
                    const setClause = [];
                    const values = [];

                    for (const [key, value] of Object.entries(updates)) {
                        if (allowedFields.includes(key)) {
                            setClause.push(`${key} = ?`);
                            values.push(value);
                        }
                    }

                    if (setClause.length > 0) {
                        values.push(codeId);
                        db.prepare(`UPDATE access_codes SET ${setClause.join(', ')} WHERE id = ?`).run(...values);
                    }

                    return new Response(JSON.stringify({ success: true }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                } catch (error) {
                    console.error('Update code error:', error);
                    return new Response(JSON.stringify({ error: 'Failed to update code' }), {
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

        // Protected data endpoints (require any auth)
        if (filePath.startsWith('/api/data/')) {
            const decoded = await verifyToken(req.headers.get('Authorization'));

            if (!decoded) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Check viewer permissions
            if (decoded.type === 'viewer' && decoded.access_type === 'game') {
                // Viewer can only access specific game data
                const requestedGameId = url.searchParams.get('game_id');
                if (requestedGameId && parseInt(requestedGameId) !== decoded.game_id) {
                    return new Response(JSON.stringify({ error: 'Access denied' }), {
                        status: 403,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            // Continue to handle data requests...
        }

        // Handle database save endpoint (admin only)
        if (filePath === '/api/save-database' && req.method === 'POST') {
            const decoded = await verifyToken(req.headers.get('Authorization'));

            if (!decoded || decoded.type !== 'admin') {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const arrayBuffer = await req.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const dbPath = join('./floorball_data.sqlite');
                await writeFile(dbPath, uint8Array);

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('Database save error:', error);
                return new Response(JSON.stringify({
                    success: false,
                    error: error.message
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Debug logging endpoint (admin only)
        if (filePath === '/api/debug-log' && req.method === 'POST') {
            const decoded = await verifyToken(req.headers.get('Authorization'));

            if (!decoded || decoded.type !== 'admin') {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

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
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('Logging error:', error);
                return new Response(JSON.stringify({
                    success: false,
                    error: error.message
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Block access to old index.html - redirect to dashboard
        if (filePath === '/index.html') {
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': '/dashboard.html',
                    ...corsHeaders
                }
            });
        }

        // Serve static files
        const file = Bun.file('.' + filePath);
        const fileExists = await file.exists();

        if (!fileExists) {
            return new Response('File not found', { status: 404 });
        }

        // Set content type based on file extension
        const contentType = getContentType(filePath);

        return new Response(file, {
            headers: {
                'Content-Type': contentType,
                ...corsHeaders
            }
        });
    },
    error() {
        return new Response('Internal Server Error', { status: 500 });
    }
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

console.log(`🔒 Secure server running at http://localhost:${port}`);
console.log(`📝 Login at: http://localhost:${port}/login.html`);
console.log(`⚠️  Default admin: admin / changeme123 (PLEASE CHANGE!)`);
console.log(`Press Ctrl+C to stop the server`);