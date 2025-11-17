// Simple auth server - minimal changes to original dashboard
import { writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Database from 'bun:sqlite';

// Load or create JWT secret
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    const crypto = await import('crypto');
    JWT_SECRET = crypto.randomBytes(64).toString('hex');
    const envContent = `JWT_SECRET=${JWT_SECRET}\nPORT=3000\n`;
    await writeFile('.env', envContent);
}

// Load .env file
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

// Initialize database
const db = new Database('./floorball_data.sqlite');

// Create auth tables
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
        type TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
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
    db.prepare('INSERT INTO access_codes (code, type, description, game_id) VALUES (?, ?, ?, ?)').run('GAME01', 'game', 'Test Game Access', 1);
}

// Simple login page HTML - styled to match dashboard
const loginPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Floorball Dashboard - Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #1A1A1D;
            color: #E5E5E7;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            position: relative;
        }

        /* Background grid pattern */
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image:
                linear-gradient(to right, #2A2A2F 1px, transparent 1px),
                linear-gradient(to bottom, #2A2A2F 1px, transparent 1px);
            background-size: 30px 30px;
            opacity: 0.2;
            pointer-events: none;
        }

        .login-container {
            width: 100%;
            max-width: 450px;
            position: relative;
            z-index: 1;
        }

        /* Logo section matching dashboard header */
        .logo-section {
            text-align: center;
            margin-bottom: 30px;
        }

        .logo-placeholder {
            display: inline-block;
            margin-bottom: 20px;
        }

        .dashboard-title {
            font-size: 26px;
            font-weight: 600;
            color: #E5E5E7;
            letter-spacing: -0.5px;
        }

        .login-box {
            background: #25252A;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.4);
            border: 1px solid #3D3D42;
        }

        .tabs {
            display: flex;
            margin-bottom: 30px;
            border-bottom: 2px solid #3D3D42;
        }

        .tab {
            flex: 1;
            padding: 12px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #A0A0A3;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            transition: all 0.2s ease;
        }

        .tab.active {
            color: #4A9D9C;
            border-bottom-color: #4A9D9C;
        }

        .tab:hover:not(.active) {
            color: #E5E5E7;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .form-group {
            margin-bottom: 24px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: #A0A0A3;
            font-size: 13px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        input {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #3D3D42;
            border-radius: 6px;
            font-size: 14px;
            background: #1A1A1D;
            color: #E5E5E7;
            transition: all 0.2s ease;
        }

        input::placeholder {
            color: #5A5A5F;
        }

        input:focus {
            outline: none;
            border-color: #4A9D9C;
            background: #1F1F22;
            box-shadow: 0 0 0 3px rgba(74, 157, 156, 0.15);
        }

        input#accessCode {
            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
            font-size: 22px;
            text-align: center;
            letter-spacing: 4px;
            text-transform: uppercase;
            padding: 15px;
            background: #1A1A1D;
            border: 2px solid #3D3D42;
        }

        input#accessCode:focus {
            border-color: #4A9D9C;
            background: #1F1F22;
        }

        .btn-login {
            width: 100%;
            padding: 14px;
            background: #4A9D9C;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .btn-login:hover {
            background: #5CB8B7;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(74, 157, 156, 0.3);
        }

        .btn-login:active {
            transform: translateY(0);
        }

        .message {
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 20px;
            display: none;
            font-size: 13px;
            font-weight: 500;
        }

        .message.error {
            background: rgba(220, 53, 69, 0.1);
            color: #FF6B6B;
            border: 1px solid rgba(220, 53, 69, 0.3);
            display: block;
        }

        .message.success {
            background: rgba(74, 157, 156, 0.1);
            color: #5CB8B7;
            border: 1px solid rgba(74, 157, 156, 0.3);
            display: block;
        }

        .help-text {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #3D3D42;
            font-size: 12px;
            color: #A0A0A3;
            text-align: center;
            line-height: 1.6;
        }

        .help-text strong {
            color: #E5E5E7;
            display: block;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <!-- Logo section matching dashboard -->
        <div class="logo-section">
            <div class="logo-placeholder">
                <svg width="70" height="70" viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#4a9d9c;stop-opacity:0.3" />
                            <stop offset="100%" style="stop-color:#6366f1;stop-opacity:0.2" />
                        </linearGradient>
                    </defs>
                    <polygon points="45,15 65,27.5 65,52.5 45,65 25,52.5 25,27.5"
                             fill="url(#grad1)"
                             stroke="#4a9d9c"
                             stroke-width="1.5"
                             opacity="0.6"/>
                    <text x="45" y="47"
                          font-family="'Courier New', monospace"
                          font-size="20"
                          font-weight="700"
                          fill="#4a9d9c"
                          text-anchor="middle"
                          letter-spacing="1"
                          dominant-baseline="middle">SNZ</text>
                    <circle cx="35" cy="68" r="2" fill="#4a9d9c" opacity="0.7"/>
                    <circle cx="45" cy="70" r="2.5" fill="#5cb8b7" opacity="0.7"/>
                    <circle cx="55" cy="68" r="2" fill="#4a9d9c" opacity="0.7"/>
                </svg>
            </div>
            <h1 class="dashboard-title">Floorball Statistics Dashboard</h1>
        </div>

        <div class="login-box">
            <div class="tabs">
                <button class="tab active" onclick="showTab('code')">Access Code</button>
                <button class="tab" onclick="showTab('admin')">Admin Login</button>
            </div>

            <div id="message" class="message"></div>

            <!-- Code Tab -->
            <div id="codeTab" class="tab-content active">
                <div class="form-group">
                    <label>Access Code</label>
                    <input type="text" id="accessCode" maxlength="6" placeholder="Enter 6-digit code"
                           onkeypress="if(event.key==='Enter') loginWithCode()">
                </div>
                <button class="btn-login" onclick="loginWithCode()">Access Dashboard</button>
            </div>

            <!-- Admin Tab -->
            <div id="adminTab" class="tab-content">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="username" placeholder="Enter username" onkeypress="if(event.key==='Enter') loginAsAdmin()">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" placeholder="Enter password" onkeypress="if(event.key==='Enter') loginAsAdmin()">
                </div>
                <button class="btn-login" onclick="loginAsAdmin()">Login</button>
            </div>

        </div>
    </div>

    <script>
        function showTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            if (tab === 'admin') {
                document.querySelector('.tab:last-child').classList.add('active');
                document.getElementById('adminTab').classList.add('active');
            } else {
                document.querySelector('.tab:first-child').classList.add('active');
                document.getElementById('codeTab').classList.add('active');
            }

            document.getElementById('message').style.display = 'none';
        }

        async function loginAsAdmin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Admin uses 'token', not 'authToken'
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userRole', 'admin');
                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => window.location.href = '/', 1000);
                } else {
                    showMessage(data.error || 'Invalid credentials', 'error');
                }
            } catch (error) {
                showMessage('Connection error', 'error');
            }
        }

        async function loginWithCode() {
            const code = document.getElementById('accessCode').value.toUpperCase();

            if (code.length !== 6) {
                showMessage('Please enter a 6-digit code', 'error');
                return;
            }

            try {
                const response = await fetch('/api/code/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userType', 'viewer');
                    localStorage.setItem('accessType', data.accessType);
                    if (data.gameId) {
                        localStorage.setItem('restrictedGameId', data.gameId);
                    }
                    showMessage('Access granted! Redirecting...', 'success');
                    setTimeout(() => window.location.href = '/', 1000);
                } else {
                    showMessage(data.error || 'Invalid code', 'error');
                }
            } catch (error) {
                showMessage('Connection error', 'error');
            }
        }

        function showMessage(text, type) {
            const message = document.getElementById('message');
            message.textContent = text;
            message.className = 'message ' + type;
            message.style.display = 'block';
        }
    </script>
</body>
</html>`;

// Helper to generate access code
function generateAccessCode() {
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

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

// Server
Bun.serve({
    port: port,
    async fetch(req) {
        const url = new URL(req.url);
        let filePath = url.pathname;
        const method = req.method;

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
        if (filePath === '/api/admin/login' && method === 'POST') {
            try {
                const { username, password } = await req.json();
                const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

                if (!user || !bcrypt.compareSync(password, user.password_hash)) {
                    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                db.prepare('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

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
                return new Response(JSON.stringify({ error: 'Login failed' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Code verification
        if (filePath === '/api/code/verify' && method === 'POST') {
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

                db.prepare('UPDATE access_codes SET usage_count = usage_count + 1 WHERE id = ?').run(accessCode.id);

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
                    accessType: accessCode.type,
                    gameId: accessCode.game_id
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'Verification failed' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Verify token
        if (filePath === '/api/verify' && method === 'POST') {
            const authHeader = req.headers.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return new Response(JSON.stringify({ valid: false }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, JWT_SECRET);
                return new Response(JSON.stringify({
                    valid: true,
                    user: decoded
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch {
                return new Response(JSON.stringify({ valid: false }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Get all access codes (admin only)
        if (filePath === '/api/codes' && method === 'GET') {
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
                    SELECT c.*, g.game_name
                    FROM access_codes c
                    LEFT JOIN games g ON c.game_id = g.game_id
                    ORDER BY c.created_at DESC
                `).all();

                return new Response(JSON.stringify(codes), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                return new Response(JSON.stringify({ error: 'Failed to get codes' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Create new access code (admin only)
        if (filePath === '/api/codes' && method === 'POST') {
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

                const body = await req.json();
                let code = generateAccessCode();

                // Ensure unique
                while (db.prepare('SELECT id FROM access_codes WHERE code = ?').get(code)) {
                    code = generateAccessCode();
                }

                const result = db.prepare(
                    'INSERT INTO access_codes (code, type, description, game_id, is_active) VALUES (?, ?, ?, ?, 1)'
                ).run(code, body.type || 'season', body.description || '', body.gameId || null);

                return new Response(JSON.stringify({
                    success: true,
                    code: code,
                    id: result.lastInsertRowid
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                return new Response(JSON.stringify({ error: 'Failed to create code' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Delete access code (admin only)
        if (filePath.startsWith('/api/codes/') && method === 'DELETE') {
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

                const codeId = filePath.split('/').pop();
                const result = db.prepare('DELETE FROM access_codes WHERE id = ?').run(codeId);

                if (result.changes === 0) {
                    return new Response(JSON.stringify({ error: 'Code not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                return new Response(JSON.stringify({ error: 'Failed to delete code' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // API: Get available games
        if (filePath === '/api/games' && method === 'GET') {
            try {
                const games = db.prepare('SELECT game_id, game_name, game_date FROM games ORDER BY game_date DESC').all();
                return new Response(JSON.stringify(games), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'Failed to get games' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Original API endpoints (database save, debug log)
        if (filePath === '/api/save-database' && method === 'POST') {
            try {
                const arrayBuffer = await req.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const dbPath = join('./floorball_data.sqlite');
                await writeFile(dbPath, uint8Array);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ success: false, error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        if (filePath === '/api/debug-log' && method === 'POST') {
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
                return new Response(JSON.stringify({ success: false, error: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Serve login page
        if (filePath === '/login') {
            return new Response(loginPageHTML, {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // Token management page for admin
        if (filePath === '/tokens.html') {
            const tokenPageHTML = await Bun.file('./tokens.html').text();
            return new Response(tokenPageHTML, {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // Default to index.html for root
        if (filePath === '/') {
            filePath = '/index.html';
        }

        // Check if requesting protected content
        const protectedPaths = ['/index.html', '/'];
        const isProtected = protectedPaths.some(path => filePath === path || filePath === '/index.html');

        // For protected content, check auth first (but do it client-side)
        // We'll inject the check into the HTML below

        // Serve static files
        const file = Bun.file('.' + filePath);
        const fileExists = await file.exists();

        if (!fileExists) {
            return new Response('File not found', { status: 404 });
        }

        // If it's index.html, inject auth check
        if (filePath === '/index.html') {
            let content = await file.text();

            // Inject minimal auth check and restriction logic
            const authCheckScript = `
<script>
// Auth check - redirect if not logged in
(function() {
    // Check for either admin token or access token
    const adminToken = localStorage.getItem('token');
    const accessToken = localStorage.getItem('authToken');
    const token = adminToken || accessToken;

    // If no token at all, redirect to login
    if (!token) {
        window.location.replace('/login');
        return;
    }

    // Verify token is still valid
    fetch('/api/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(data => {
        if (!data.valid) {
            localStorage.clear();
            window.location.replace('/login');
        } else {
            // Store auth info for app use
            window.authInfo = {
                user: data.user,
                isAdmin: data.user.type === 'admin',
                isViewer: data.user.type === 'viewer',
                restrictedGameId: data.user.gameId
            };

            // Function to add admin menu items
            const setupAdminMenu = () => {
                // Add token management and logout for admin
                if (data.user.type === 'admin') {
                    // Try multiple times to ensure elements are loaded
                    let attempts = 0;
                    const addAdminMenuItems = () => {
                        attempts++;
                        console.log('Attempting to add admin menu items, attempt:', attempts);

                        // Find all dropdown menus
                        const dropdownMenus = document.querySelectorAll('.dropdown-menu');
                        console.log('Found dropdown menus:', dropdownMenus.length);

                        if (dropdownMenus.length === 0 && attempts < 20) {
                            // Try again if no menus found yet
                            setTimeout(addAdminMenuItems, 500);
                            return;
                        }

                        dropdownMenus.forEach((menu, index) => {
                            console.log('Processing menu', index, menu);

                            // Check if we already added the items
                            if (menu.querySelector('.admin-token-item')) {
                                console.log('Admin items already added to menu', index);
                                return;
                            }

                            // Add separator
                            const separator = document.createElement('div');
                            separator.style.cssText = 'height: 1px; background: #e1e8ed; margin: 8px 0;';
                            menu.appendChild(separator);

                            // Add Access Tokens button
                            const tokenButton = document.createElement('button');
                            tokenButton.className = 'menu-item tab-button admin-token-item';
                            tokenButton.setAttribute('data-tab', 'tokens');
                            tokenButton.textContent = 'Access Tokens';
                            tokenButton.style.cssText = 'width: 100%; text-align: left; padding: 10px 15px; background: none; border: none; cursor: pointer; font-size: 14px;';
                            tokenButton.onmouseenter = function() { this.style.backgroundColor = '#f0f0f0'; };
                            tokenButton.onmouseleave = function() { this.style.backgroundColor = 'transparent'; };
                            tokenButton.onclick = (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Close dropdown menu
                                menu.parentElement.classList.remove('active');
                                // Open tokens page
                                window.open('/tokens.html', '_blank');
                            };
                            menu.appendChild(tokenButton);

                            // Add Logout button
                            const logoutButton = document.createElement('button');
                            logoutButton.className = 'menu-item tab-button admin-logout-item';
                            logoutButton.setAttribute('data-tab', 'logout');
                            logoutButton.textContent = 'Logout';
                            logoutButton.style.cssText = 'width: 100%; text-align: left; padding: 10px 15px; background: none; border: none; cursor: pointer; font-size: 14px; color: #dc3545;';
                            logoutButton.onmouseenter = function() { this.style.backgroundColor = '#fee'; };
                            logoutButton.onmouseleave = function() { this.style.backgroundColor = 'transparent'; };
                            logoutButton.onclick = (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm('Are you sure you want to logout?')) {
                                    localStorage.clear();
                                    window.location.href = '/login';
                                }
                            };
                            menu.appendChild(logoutButton);

                            console.log('Added admin items to menu', index);
                        });

                        // Ensure hamburger menus stay visible for admin
                        document.querySelectorAll('.hamburger').forEach(el => {
                            el.style.display = '';
                        });
                    };

                    // Start trying to add menu items after a short delay
                    setTimeout(addAdminMenuItems, 1000);
                } else {
                    // For viewers, add simple logout button where burger menu would be
                    setTimeout(() => {
                        // Find header-controls divs where hamburger menu normally appears
                        const headerControls = document.querySelectorAll('.header-controls');
                        headerControls.forEach(controls => {
                            if (!controls.querySelector('.viewer-logout')) {
                                const logoutBtn = document.createElement('button');
                                logoutBtn.className = 'viewer-logout';
                                logoutBtn.textContent = 'Logout';
                                logoutBtn.style.cssText = 'padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 10px;';
                                logoutBtn.onclick = () => {
                                    if (confirm('Are you sure you want to logout?')) {
                                        localStorage.clear();
                                        window.location.href = '/login';
                                    }
                                };
                                controls.appendChild(logoutBtn);
                            }
                        });
                    }, 500);

                    // Hide hamburger menu for viewers
                    setTimeout(() => {
                        document.querySelectorAll('.hamburger-menu').forEach(el => {
                            el.style.display = 'none';
                        });

                        // Hide tabs in dropdown menus
                        document.querySelectorAll('[data-tab="import"], [data-tab="corrections"]').forEach(el => {
                            el.style.display = 'none';
                        });
                    }, 500);
                }

                // Handle viewer restrictions
                if (data.user.type === 'viewer') {
                    // If on import or corrections tab, switch to dashboard
                    const activeTab = document.querySelector('.tab-content.active');
                    if (activeTab && (activeTab.id === 'import-tab' || activeTab.id === 'corrections-tab')) {
                        // Click dashboard tab
                        const dashboardTabBtn = document.querySelector('[data-tab="dashboard"]');
                        if (dashboardTabBtn) dashboardTabBtn.click();
                    }

                    // For single game viewers: lock game selection
                    if (data.user.gameId) {
                        // Wait a bit for game selector to load
                        const checkGameSelector = setInterval(() => {
                            const gameSelect = document.getElementById('selected-game');
                            if (gameSelect && gameSelect.options.length > 0) {
                                clearInterval(checkGameSelector);

                                // Find and select the restricted game
                                for (let i = 0; i < gameSelect.options.length; i++) {
                                    if (gameSelect.options[i].value == data.user.gameId) {
                                        gameSelect.value = data.user.gameId;
                                        gameSelect.disabled = true;

                                        // Add notice
                                        const notice = document.createElement('div');
                                        notice.style.cssText = 'color: #856404; background: #fff3cd; padding: 8px; border-radius: 4px; margin-top: 10px; font-size: 12px;';
                                        notice.textContent = 'You have access to this game only';
                                        gameSelect.parentElement.appendChild(notice);

                                        // Trigger change event to load the game
                                        gameSelect.dispatchEvent(new Event('change'));
                                        break;
                                    }
                                }
                            }
                        }, 100);

                        // Stop checking after 5 seconds
                        setTimeout(() => clearInterval(checkGameSelector), 5000);
                    }
                }
            };

            // Call setupAdminMenu when DOM is ready OR already loaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setupAdminMenu);
            } else {
                // DOM already loaded, call immediately
                setupAdminMenu();
            }
        }
    })
    .catch(() => {
        localStorage.clear();
        window.location.href = '/login';
    });
})();
</script>`;

            content = content.replace('<body>', '<body>' + authCheckScript);

            return new Response(content, {
                headers: {
                    'Content-Type': 'text/html',
                    ...corsHeaders
                }
            });
        }

        // Serve other static files normally
        return new Response(file, {
            headers: {
                'Content-Type': getContentType(filePath),
                ...corsHeaders
            }
        });
    },
    error() {
        return new Response('Internal Server Error', { status: 500 });
    }
});

// Show startup info
console.log(`\n${'='.repeat(50)}`);
console.log('FLOORBALL DASHBOARD WITH AUTHENTICATION');
console.log('='.repeat(50));
console.log(`\nServer: http://localhost:${port}`);
console.log(`Login: http://localhost:${port}/login`);
console.log('\nCredentials:');
console.log('  Admin: admin / changeme123');
console.log('  Viewer (season): TEST01');
console.log('  Viewer (single game): GAME01');
console.log('\n' + '='.repeat(50));
console.log('Press Ctrl+C to stop\n');