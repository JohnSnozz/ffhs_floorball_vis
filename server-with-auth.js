// Server with authentication - protects the existing dashboard
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
    console.log('Generated new JWT secret');
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
        expires_at DATETIME,
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
    db.prepare('INSERT INTO access_codes (code, type, description) VALUES (?, ?, ?)').run('GAME01', 'game', 'Test Game Access');
    console.log('Created sample access codes: TEST01, GAME01');
}

// Simple login page HTML
const loginPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Floorball Dashboard - Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .login-box {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 400px;
        }
        h2 { margin-bottom: 30px; color: #333; text-align: center; }
        .tabs {
            display: flex;
            margin-bottom: 30px;
            border-bottom: 2px solid #eee;
        }
        .tab {
            flex: 1;
            padding: 12px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 15px;
            color: #666;
        }
        .tab.active {
            color: #667eea;
            border-bottom: 2px solid #667eea;
            margin-bottom: -2px;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .form-group { margin-bottom: 20px; }
        label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: 500;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 16px;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            width: 100%;
            padding: 14px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        }
        button:hover { background: #5a67d8; }
        .message {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            display: none;
        }
        .message.error {
            background: #fee;
            color: #c33;
            border: 1px solid #fcc;
            display: block;
        }
        .message.success {
            background: #efe;
            color: #3a3;
            border: 1px solid #cfc;
            display: block;
        }
    </style>
</head>
<body>
    <div class="login-box">
        <h2>Floorball Dashboard</h2>

        <div class="tabs">
            <button class="tab active" onclick="showTab('code')">Access Code</button>
            <button class="tab" onclick="showTab('admin')">Admin Login</button>
        </div>

        <div id="message" class="message"></div>

        <!-- Code Tab -->
        <div id="codeTab" class="tab-content active">
            <div class="form-group">
                <label>Enter 6-Digit Access Code</label>
                <input type="text" id="accessCode" maxlength="6" placeholder="ABC123"
                       style="text-transform: uppercase; text-align: center; letter-spacing: 2px; font-family: monospace; font-size: 20px;"
                       onkeypress="if(event.key==='Enter') loginWithCode()">
            </div>
            <button onclick="loginWithCode()">Access Dashboard</button>
        </div>

        <!-- Admin Tab -->
        <div id="adminTab" class="tab-content">
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="username" placeholder="admin" onkeypress="if(event.key==='Enter') loginAsAdmin()">
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password" placeholder="password" onkeypress="if(event.key==='Enter') loginAsAdmin()">
            </div>
            <button onclick="loginAsAdmin()">Login as Admin</button>
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
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userType', 'admin');
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

        // API: Verify token (for protected pages)
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

        // Default to index.html for root BUT require auth
        if (filePath === '/') {
            // Check for auth token in cookie or we'll handle it client-side
            filePath = '/index.html';
        }

        // Serve static files
        const file = Bun.file('.' + filePath);
        const fileExists = await file.exists();

        if (!fileExists) {
            return new Response('File not found', { status: 404 });
        }

        // If it's index.html, inject auth check script
        if (filePath === '/index.html') {
            let content = await file.text();

            // Inject auth check script right after <body>
            const authCheckScript = `
<script>
// Auth check
(function() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Verify token is still valid
    fetch('/api/verify', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(r => r.json())
    .then(data => {
        if (!data.valid) {
            localStorage.clear();
            window.location.href = '/login';
        } else {
            // Set user info for the app
            window.authUser = data.user;

            // Add logout button to header if it exists
            setTimeout(() => {
                const header = document.querySelector('.dashboard-header');
                if (header && !document.getElementById('auth-controls')) {
                    const authControls = document.createElement('div');
                    authControls.id = 'auth-controls';
                    authControls.style.cssText = 'position: absolute; right: 60px; top: 50%; transform: translateY(-50%);';
                    authControls.innerHTML = \`
                        <span style="margin-right: 15px; color: #666;">
                            \${data.user.type === 'admin' ? 'Admin: ' + data.user.username : 'Viewer: ' + data.user.code}
                        </span>
                        <button onclick="localStorage.clear(); window.location.href='/login'"
                                style="padding: 6px 14px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Logout
                        </button>
                    \`;
                    header.appendChild(authControls);
                }

                // Hide admin features for viewers
                if (data.user.type === 'viewer') {
                    document.body.classList.add('viewer-mode');
                    // Hide import and corrections tabs
                    const style = document.createElement('style');
                    style.textContent = \`
                        body.viewer-mode .tab-button[data-tab="import"],
                        body.viewer-mode .tab-button[data-tab="corrections"],
                        body.viewer-mode #import-tab,
                        body.viewer-mode #corrections-tab {
                            display: none !important;
                        }
                    \`;
                    document.head.appendChild(style);

                    // If restricted to single game, set that
                    if (data.user.gameId) {
                        window.restrictedGameId = data.user.gameId;
                        // Wait for app to load then force game selection
                        window.addEventListener('load', () => {
                            setTimeout(() => {
                                const gameSelect = document.getElementById('selected-game');
                                if (gameSelect && window.restrictedGameId) {
                                    gameSelect.value = window.restrictedGameId;
                                    gameSelect.disabled = true;
                                    // Trigger change event
                                    gameSelect.dispatchEvent(new Event('change'));
                                }
                            }, 1000);
                        });
                    }
                }
            }, 100);
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

console.log(`\n${'='.repeat(50)}`);
console.log('FLOORBALL DASHBOARD SERVER WITH AUTH');
console.log('='.repeat(50));
console.log(`\nServer running at: http://localhost:${port}`);
console.log(`Login page: http://localhost:${port}/login`);
console.log('\nDefault credentials:');
console.log('  Admin: admin / changeme123');
console.log('  Viewer codes: TEST01, GAME01');
console.log('\nPress Ctrl+C to stop the server\n`);