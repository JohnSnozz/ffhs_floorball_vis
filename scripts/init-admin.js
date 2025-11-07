#!/usr/bin/env bun

import Database from 'bun:sqlite';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';

console.log('Floorball Dashboard - Admin Setup');
console.log('==================================\n');

// Initialize database
const db = new Database('./floorball_data.sqlite');

// Create admin tables if they don't exist
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

// Function to generate access code
function generateAccessCode(length = 6) {
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

async function main() {
    // Check for existing admin
    const existingAdmin = db.prepare('SELECT id, username FROM admin_users WHERE username = ?').get('admin');

    if (existingAdmin) {
        console.log('Admin account already exists!');
        console.log(`Username: ${existingAdmin.username}`);

        const prompt = await Bun.prompt('Do you want to reset the admin password? (y/n)');

        if (prompt?.toLowerCase() === 'y') {
            const newPassword = await Bun.prompt('Enter new admin password (min 8 characters):');

            if (!newPassword || newPassword.length < 8) {
                console.log('Password must be at least 8 characters long!');
                process.exit(1);
            }

            const passwordHash = await bcrypt.hash(newPassword, 12);
            db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(passwordHash, existingAdmin.id);

            console.log('\n✅ Admin password updated successfully!');
        }
    } else {
        console.log('Creating new admin account...\n');

        const username = await Bun.prompt('Enter admin username (default: admin):') || 'admin';
        const password = await Bun.prompt('Enter admin password (min 8 characters):');

        if (!password || password.length < 8) {
            console.log('Password must be at least 8 characters long!');
            process.exit(1);
        }

        const passwordHash = await bcrypt.hash(password, 12);

        try {
            db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
            console.log(`\n✅ Admin account created successfully!`);
            console.log(`Username: ${username}`);
        } catch (error) {
            console.error('Error creating admin account:', error);
            process.exit(1);
        }
    }

    // Generate sample access codes
    const prompt = await Bun.prompt('\nDo you want to generate sample access codes? (y/n)');

    if (prompt?.toLowerCase() === 'y') {
        // Get existing games
        const games = db.prepare('SELECT id, name FROM games').all();

        // Generate season access code
        const seasonCode = generateAccessCode();
        db.prepare(`
            INSERT INTO access_codes (code, type, description)
            VALUES (?, 'season', 'Full season access')
        `).run(seasonCode);

        console.log(`\n📋 Season Access Code: ${seasonCode}`);

        // Generate game-specific codes if games exist
        if (games.length > 0) {
            console.log('\nGame-specific codes:');
            games.forEach(game => {
                const gameCode = generateAccessCode();
                db.prepare(`
                    INSERT INTO access_codes (code, game_id, type, description)
                    VALUES (?, ?, 'game', ?)
                `).run(gameCode, game.id, `Access to ${game.name}`);

                console.log(`📋 ${game.name}: ${gameCode}`);
            });
        }
    }

    // Create .env file if it doesn't exist
    try {
        readFileSync('.env');
        console.log('\n✅ .env file already exists');
    } catch {
        const crypto = await import('crypto');
        const jwtSecret = crypto.randomBytes(64).toString('hex');
        const envContent = `JWT_SECRET=${jwtSecret}\nPORT=3000\n`;

        await Bun.write('.env', envContent);
        console.log('\n✅ Created .env file with JWT secret');
    }

    console.log('\n================================');
    console.log('Setup complete!');
    console.log('\nTo start the server with authentication:');
    console.log('  bun run server-auth.js');
    console.log('\nThen navigate to:');
    console.log('  http://localhost:3000/login.html');
    console.log('================================\n');
}

main().catch(console.error).finally(() => {
    db.close();
    process.exit(0);
});