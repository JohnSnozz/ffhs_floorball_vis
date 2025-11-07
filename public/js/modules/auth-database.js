// Authentication Database Module
class AuthDatabase {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    // Initialize authentication tables
    async initializeAuthTables() {
        const db = this.dbManager.db;

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

        // Session tokens table
        db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT NOT NULL UNIQUE,
                user_type TEXT NOT NULL CHECK(user_type IN ('admin', 'viewer')),
                user_id INTEGER,
                access_code_id INTEGER,
                game_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (access_code_id) REFERENCES access_codes(id) ON DELETE CASCADE
            )
        `);

        // Access logs table for tracking
        db.run(`
            CREATE TABLE IF NOT EXISTS access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                access_type TEXT NOT NULL CHECK(access_type IN ('admin', 'code')),
                identifier TEXT NOT NULL,
                success INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    // Generate a random hex code
    generateAccessCode(length = 6) {
        const chars = '0123456789ABCDEF';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    // Create access code for a game
    async createGameAccessCode(gameId, description = null) {
        const db = this.dbManager.db;
        const code = this.generateAccessCode();

        db.run(`
            INSERT INTO access_codes (code, game_id, type, description)
            VALUES (?, ?, 'game', ?)
        `, [code, gameId, description]);

        return code;
    }

    // Create access code for all season data
    async createSeasonAccessCode(description = null) {
        const db = this.dbManager.db;
        const code = this.generateAccessCode();

        db.run(`
            INSERT INTO access_codes (code, game_id, type, description)
            VALUES (?, NULL, 'season', ?)
        `, [code, description]);

        return code;
    }

    // Verify access code
    async verifyAccessCode(code) {
        const db = this.dbManager.db;
        const result = db.exec(`
            SELECT id, code, game_id, type, is_active, expires_at, usage_count, max_usage
            FROM access_codes
            WHERE UPPER(code) = UPPER(?) AND is_active = 1
        `, [code]);

        if (result.length === 0 || result[0].values.length === 0) {
            return null;
        }

        const row = result[0];
        const accessCode = {
            id: row.values[0][0],
            code: row.values[0][1],
            game_id: row.values[0][2],
            type: row.values[0][3],
            is_active: row.values[0][4],
            expires_at: row.values[0][5],
            usage_count: row.values[0][6],
            max_usage: row.values[0][7]
        };

        // Check expiration
        if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
            return null;
        }

        // Check max usage
        if (accessCode.max_usage && accessCode.usage_count >= accessCode.max_usage) {
            return null;
        }

        // Increment usage count
        db.run(`
            UPDATE access_codes
            SET usage_count = usage_count + 1
            WHERE id = ?
        `, [accessCode.id]);

        return accessCode;
    }

    // Create session token
    generateSessionToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Create session for admin
    async createAdminSession(userId) {
        const db = this.dbManager.db;
        const token = this.generateSessionToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

        db.run(`
            INSERT INTO sessions (token, user_type, user_id, expires_at)
            VALUES (?, 'admin', ?, ?)
        `, [token, userId, expiresAt.toISOString()]);

        return token;
    }

    // Create session for viewer (code-based access)
    async createViewerSession(accessCodeId, gameId = null) {
        const db = this.dbManager.db;
        const token = this.generateSessionToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8); // 8 hour expiration for viewers

        db.run(`
            INSERT INTO sessions (token, user_type, access_code_id, game_id, expires_at)
            VALUES (?, 'viewer', ?, ?, ?)
        `, [token, accessCodeId, gameId, expiresAt.toISOString()]);

        return token;
    }

    // Verify session
    async verifySession(token) {
        const db = this.dbManager.db;
        const result = db.exec(`
            SELECT id, user_type, user_id, access_code_id, game_id, expires_at
            FROM sessions
            WHERE token = ? AND expires_at > datetime('now')
        `, [token]);

        if (result.length === 0 || result[0].values.length === 0) {
            return null;
        }

        const row = result[0];
        const session = {
            id: row.values[0][0],
            user_type: row.values[0][1],
            user_id: row.values[0][2],
            access_code_id: row.values[0][3],
            game_id: row.values[0][4],
            expires_at: row.values[0][5]
        };

        // Update last activity
        db.run(`
            UPDATE sessions
            SET last_activity = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [session.id]);

        return session;
    }

    // Get all access codes for admin management
    async getAllAccessCodes() {
        const db = this.dbManager.db;
        const result = db.exec(`
            SELECT
                ac.id,
                ac.code,
                ac.game_id,
                ac.type,
                ac.description,
                ac.created_at,
                ac.expires_at,
                ac.usage_count,
                ac.max_usage,
                ac.is_active,
                g.name as game_name
            FROM access_codes ac
            LEFT JOIN games g ON ac.game_id = g.id
            ORDER BY ac.created_at DESC
        `);

        if (result.length === 0) {
            return [];
        }

        return result[0].values.map(row => ({
            id: row[0],
            code: row[1],
            game_id: row[2],
            type: row[3],
            description: row[4],
            created_at: row[5],
            expires_at: row[6],
            usage_count: row[7],
            max_usage: row[8],
            is_active: row[9],
            game_name: row[10]
        }));
    }

    // Update access code
    async updateAccessCode(codeId, updates) {
        const db = this.dbManager.db;
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
            db.run(`
                UPDATE access_codes
                SET ${setClause.join(', ')}
                WHERE id = ?
            `, values);
        }
    }

    // Delete access code
    async deleteAccessCode(codeId) {
        const db = this.dbManager.db;
        db.run(`DELETE FROM access_codes WHERE id = ?`, [codeId]);
    }

    // Log access attempt
    async logAccessAttempt(type, identifier, success, ipAddress = null, userAgent = null) {
        const db = this.dbManager.db;
        db.run(`
            INSERT INTO access_logs (access_type, identifier, success, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        `, [type, identifier, success ? 1 : 0, ipAddress, userAgent]);
    }

    // Clean expired sessions
    async cleanExpiredSessions() {
        const db = this.dbManager.db;
        db.run(`DELETE FROM sessions WHERE expires_at <= datetime('now')`);
    }
}

window.AuthDatabase = AuthDatabase;