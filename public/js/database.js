// Database management module for Floorball Visualization App
class DatabaseManager {
    constructor() {
        this.db = null;
    }

    async initialize() {
        console.log('Loading SQL.js...');
        await debugLog('Loading SQL.js...');

        // SQL.js should be loaded from CDN in HTML
        if (typeof window.initSqlJs === 'undefined') {
            console.error('SQL.js not loaded from CDN');
            await debugLog('SQL.js not loaded from CDN');
            throw new Error('SQL.js not available');
        }

        const SQL = await window.initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });

        console.log('SQL.js loaded successfully');

        // Try to load existing database file first
        let loadedExisting = false;
        try {
            console.log('Checking for existing database file...');
            const response = await fetch('./floorball_data.sqlite');
            if (response.ok) {
                console.log('Loading existing database file...');
                const dbBuffer = await response.arrayBuffer();
                this.db = new SQL.Database(new Uint8Array(dbBuffer));
                console.log('Existing database file loaded successfully');

                // Verify tables exist
                const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
                console.log('Existing tables:', tables);
                loadedExisting = true;
            }
        } catch (error) {
            console.log('No existing database file found, creating new one...');
        }

        if (loadedExisting) {
            console.log('Database loaded from file, migrating if needed...');
            await this.migrateDatabase();
            this.createOrUpdateViews();
            return;
        }

        console.log('Creating new database...');
        this.db = new SQL.Database();

        // Create games table with extended fields
        this.db.run(`
            CREATE TABLE IF NOT EXISTS games (
                game_id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_name TEXT NOT NULL,
                game_date TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                team1 TEXT,
                team2 TEXT,
                UNIQUE(game_name, game_date)
            );
        `);

        // Create shots table matching existing database schema
        this.db.run(`
            CREATE TABLE IF NOT EXISTS shots (
                shot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL,
                date TEXT,
                team1 TEXT,
                team2 TEXT,
                time INTEGER,
                shooting_team TEXT,
                result TEXT,
                type TEXT,
                xg REAL,
                xgot REAL,
                shooter TEXT,
                passer TEXT,
                t1lw TEXT,
                t1c TEXT,
                t1rw TEXT,
                t1ld TEXT,
                t1rd TEXT,
                t1g TEXT,
                t1x TEXT,
                t2lw TEXT,
                t2c TEXT,
                t2rw TEXT,
                t2ld TEXT,
                t2rd TEXT,
                t2g TEXT,
                t2x TEXT,
                pp INTEGER,
                sh INTEGER,
                distance REAL,
                angle REAL,
                x_m REAL,
                y_m REAL,
                x_graph REAL,
                y_graph REAL,
                player_team1 INTEGER,
                player_team2 INTEGER,
                FOREIGN KEY (game_id) REFERENCES games (game_id) ON DELETE CASCADE
            );
        `);

        // Create index for performance
        this.db.run('CREATE INDEX IF NOT EXISTS idx_shots_game_id ON shots(game_id);');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_games_name_date ON games(game_name, game_date);');

        // Create shot_corrections table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS shot_corrections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shot_id INTEGER NOT NULL UNIQUE,
                corrected_shooter TEXT,
                corrected_assisted_by TEXT,
                corrected_shot_type TEXT,
                corrected_shot_result TEXT,
                corrected_defender TEXT,
                corrected_is_direct BOOLEAN,
                corrected_is_one_timer BOOLEAN,
                corrected_is_rebound BOOLEAN,
                is_turnover BOOLEAN,
                corrected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shot_id) REFERENCES shots(shot_id) ON DELETE CASCADE
            );
        `);

        // Create game_aliases table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS game_aliases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL UNIQUE,
                alias TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
            );
        `);

        this.createOrUpdateViews();

        console.log('Database initialized successfully');
        await this.saveDatabaseToFile();
    }

    async migrateDatabase() {
        try {
            console.log('Checking for database migrations...');

            // Check if shots table exists and has all columns
            const tableInfo = this.db.exec("PRAGMA table_info(shots)");
            if (tableInfo.length > 0) {
                const columns = tableInfo[0].values.map(col => col[1]); // Column names are in index 1
                const requiredColumns = ['x_m', 'y_m', 'x_graph', 'y_graph'];

                const missingColumns = requiredColumns.filter(col => !columns.includes(col));

                if (missingColumns.length > 0) {
                    console.log('Missing columns in shots table:', missingColumns);

                    // Create a backup of existing data
                    const shots = this.db.exec("SELECT * FROM shots");
                    const games = this.db.exec("SELECT * FROM games");

                    // Drop and recreate shots table with all columns
                    this.db.run("DROP TABLE IF EXISTS shots");
                    this.db.run(`
                        CREATE TABLE shots (
                            shot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            game_id INTEGER NOT NULL,
                            date TEXT,
                            team1 TEXT,
                            team2 TEXT,
                            time INTEGER,
                            shooting_team TEXT,
                            result TEXT,
                            type TEXT,
                            xg REAL,
                            xgot REAL,
                            shooter TEXT,
                            passer TEXT,
                            t1lw TEXT,
                            t1c TEXT,
                            t1rw TEXT,
                            t1ld TEXT,
                            t1rd TEXT,
                            t1g TEXT,
                            t1x TEXT,
                            t2lw TEXT,
                            t2c TEXT,
                            t2rw TEXT,
                            t2ld TEXT,
                            t2rd TEXT,
                            t2g TEXT,
                            t2x TEXT,
                            pp INTEGER,
                            sh INTEGER,
                            distance REAL,
                            angle REAL,
                            x_m REAL,
                            y_m REAL,
                            x_graph REAL,
                            y_graph REAL,
                            player_team1 INTEGER,
                            player_team2 INTEGER,
                            FOREIGN KEY (game_id) REFERENCES games (game_id) ON DELETE CASCADE
                        );
                    `);

                    // Restore data if there was any
                    if (shots.length > 0) {
                        // Map old data to new schema with default values for missing columns
                        console.log('Migrating existing shots data...');
                    }
                }
            }

            // Check if games table has team1 and team2 columns
            const gameTableInfo = this.db.exec("PRAGMA table_info(games)");
            const allShots = this.db.exec("SELECT DISTINCT shooting_team FROM shots");

            if (gameTableInfo.length > 0) {
                const gameColumns = gameTableInfo[0].values.map(col => col[1]);
                if (!gameColumns.includes('team1') || !gameColumns.includes('team2')) {
                    console.log('Adding team columns to games table...');
                    this.db.run("ALTER TABLE games ADD COLUMN team1 TEXT");
                    this.db.run("ALTER TABLE games ADD COLUMN team2 TEXT");

                    // Update team values from shots if available
                    if (allShots.length > 0 && allShots[0].values.length > 0) {
                        const teams = [...new Set(allShots[0].values.flat())];
                        if (teams.length >= 2) {
                            const updateQuery = `UPDATE games SET team1 = '${teams[0]}', team2 = '${teams[1]}'`;
                            this.db.run(updateQuery);
                            console.log(`Updated games with teams: ${teams[0]} vs ${teams[1]}`);
                        }
                    }
                }
            }

            // Check for shot_corrections table
            const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            const tableNames = tables.length > 0 ? tables[0].values.map(t => t[0]) : [];

            if (!tableNames.includes('shot_corrections')) {
                console.log('Creating shot_corrections table...');
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS shot_corrections (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        shot_id INTEGER NOT NULL UNIQUE,
                        corrected_shooter TEXT,
                        corrected_assisted_by TEXT,
                        corrected_shot_type TEXT,
                        corrected_shot_result TEXT,
                        corrected_defender TEXT,
                        corrected_is_direct BOOLEAN,
                        corrected_is_one_timer BOOLEAN,
                        corrected_is_rebound BOOLEAN,
                        is_turnover BOOLEAN,
                        corrected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (shot_id) REFERENCES shots(shot_id) ON DELETE CASCADE
                    );
                `);
            } else {
                // Check if is_turnover column exists
                const correctionTableInfo = this.db.exec("PRAGMA table_info(shot_corrections)");
                if (correctionTableInfo.length > 0) {
                    const correctionColumns = correctionTableInfo[0].values.map(col => col[1]);
                    if (!correctionColumns.includes('is_turnover')) {
                        console.log('Adding is_turnover column to shot_corrections...');
                        this.db.run("ALTER TABLE shot_corrections ADD COLUMN is_turnover BOOLEAN DEFAULT 0");
                    }
                }
            }

            // Check for game_aliases table
            if (!tableNames.includes('game_aliases')) {
                console.log('Creating game_aliases table...');
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS game_aliases (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        game_id INTEGER NOT NULL UNIQUE,
                        alias TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
                    );
                `);
            }

            console.log('Database migration completed');
        } catch (error) {
            console.error('Database migration error:', error);
            await debugLog('Database migration error', { error: error.message });
        }
    }

    createOrUpdateViews() {
        try {
            // Drop existing view if it exists
            this.db.run("DROP VIEW IF EXISTS shots_view");

            // Create view that combines shots with corrections - matching existing database
            this.db.run(`
                CREATE VIEW shots_view AS
                SELECT
                    s.shot_id,
                    s.game_id,
                    s.date,
                    s.team1,
                    s.team2,
                    COALESCE(c.shooting_team, s.shooting_team) as shooting_team,
                    COALESCE(c.result, s.result) as result,
                    CASE
                        WHEN c.shot_id IS NOT NULL THEN
                            CASE
                                WHEN c.is_turnover = 1 THEN 'Turnover | ' || COALESCE(c.type, s.type)
                                ELSE COALESCE(c.type, s.type)
                            END
                        ELSE s.type
                    END as type,
                    COALESCE(c.xg, s.xg) as xg,
                    COALESCE(c.xgot, s.xgot) as xgot,
                    COALESCE(c.shooter, s.shooter) as shooter,
                    COALESCE(c.passer, s.passer) as passer,
                    COALESCE(c.t1lw, s.t1lw) as t1lw,
                    COALESCE(c.t1c, s.t1c) as t1c,
                    COALESCE(c.t1rw, s.t1rw) as t1rw,
                    COALESCE(c.t1ld, s.t1ld) as t1ld,
                    COALESCE(c.t1rd, s.t1rd) as t1rd,
                    COALESCE(c.t1g, s.t1g) as t1g,
                    COALESCE(c.t1x, s.t1x) as t1x,
                    COALESCE(c.t2lw, s.t2lw) as t2lw,
                    COALESCE(c.t2c, s.t2c) as t2c,
                    COALESCE(c.t2rw, s.t2rw) as t2rw,
                    COALESCE(c.t2ld, s.t2ld) as t2ld,
                    COALESCE(c.t2rd, s.t2rd) as t2rd,
                    COALESCE(c.t2g, s.t2g) as t2g,
                    COALESCE(c.t2x, s.t2x) as t2x,
                    COALESCE(c.pp, s.pp) as pp,
                    COALESCE(c.sh, s.sh) as sh,
                    COALESCE(c.time, s.time) as time,
                    s.distance,
                    s.angle,
                    s.x_m,
                    s.y_m,
                    s.x_graph,
                    s.y_graph,
                    COALESCE(c.player_team1, s.player_team1) as player_team1,
                    COALESCE(c.player_team2, s.player_team2) as player_team2
                FROM shots s
                LEFT JOIN shot_corrections c ON s.shot_id = c.shot_id;
            `);

            console.log('Database views created/updated successfully');
        } catch (error) {
            console.error('Error creating/updating views:', error);
        }
    }

    async saveDatabaseToFile() {
        try {
            const data = this.db.export();
            const buffer = new Uint8Array(data);

            await this.uploadDatabaseToServer(buffer);

            console.log('Database saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save database:', error);
            await debugLog('Failed to save database', { error: error.message });
            return false;
        }
    }

    async uploadDatabaseToServer(dbArray) {
        try {
            const response = await fetch('/api/save-database', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
                body: dbArray
            });

            if (response.ok) {
                console.log('Database uploaded successfully');
                return true;
            } else {
                throw new Error(`Server responded with ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to upload database:', error);
            await debugLog('Failed to upload database', { error: error.message });
            return false;
        }
    }

    checkDatabaseState() {
        try {
            const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            console.log('Current tables:', tables);

            const gamesCount = this.db.exec("SELECT COUNT(*) FROM games");
            const shotsCount = this.db.exec("SELECT COUNT(*) FROM shots");

            console.log('Games count:', gamesCount[0]?.values[0]?.[0] || 0);
            console.log('Shots count:', shotsCount[0]?.values[0]?.[0] || 0);

            return {
                tables: tables[0]?.values.map(t => t[0]) || [],
                gamesCount: gamesCount[0]?.values[0]?.[0] || 0,
                shotsCount: shotsCount[0]?.values[0]?.[0] || 0
            };
        } catch (error) {
            console.error('Error checking database state:', error);
            return null;
        }
    }

    // Game management methods
    async loadGamesList() {
        try {
            const games = this.db.exec("SELECT game_id, game_name, game_date, team1, team2 FROM games ORDER BY game_date DESC, game_name");
            const aliases = this.db.exec("SELECT game_id, alias FROM game_aliases");

            const aliasMap = {};
            if (aliases.length > 0) {
                aliases[0].values.forEach(([gameId, alias]) => {
                    aliasMap[gameId] = alias;
                });
            }

            return {
                games: games[0]?.values || [],
                aliases: aliasMap
            };
        } catch (error) {
            console.error('Error loading games list:', error);
            await debugLog('Error loading games list', { error: error.message });
            return { games: [], aliases: {} };
        }
    }

    loadGameAlias(gameId) {
        if (!gameId) {
            return null;
        }

        try {
            const result = this.db.exec(`
                SELECT alias
                FROM game_aliases
                WHERE game_id = ?
            `, [gameId]);

            if (result.length > 0 && result[0].values.length > 0) {
                return result[0].values[0][0];
            }
        } catch (error) {
            console.error('Error loading game alias:', error);
        }

        return null;
    }

    async saveGameAlias(gameId, alias) {
        if (!gameId) {
            throw new Error('No game selected');
        }

        try {
            if (alias) {
                const existing = this.db.exec("SELECT id FROM game_aliases WHERE game_id = ?", [gameId]);

                if (existing.length > 0 && existing[0].values.length > 0) {
                    this.db.run("UPDATE game_aliases SET alias = ? WHERE game_id = ?", [alias, gameId]);
                } else {
                    this.db.run("INSERT INTO game_aliases (game_id, alias) VALUES (?, ?)", [gameId, alias]);
                }
            } else {
                this.db.run("DELETE FROM game_aliases WHERE game_id = ?", [gameId]);
            }

            await this.saveDatabaseToFile();
            return true;
        } catch (error) {
            console.error('Error saving game alias:', error);
            await debugLog('Error saving game alias', { error: error.message });
            return false;
        }
    }

    async loadGameData(gameId) {
        if (!gameId) {
            return null;
        }

        try {
            let shots;

            if (gameId === 'all') {
                shots = this.db.exec(`
                    SELECT * FROM shots_view
                    ORDER BY shot_id
                `);
            } else {
                shots = this.db.exec(`
                    SELECT * FROM shots_view
                    WHERE game_id = ?
                    ORDER BY shot_id
                `, [gameId]);
            }

            if (shots.length > 0 && shots[0].values.length > 0) {
                const headers = shots[0].columns;
                return shots[0].values.map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index];
                    });
                    return obj;
                });
            }
        } catch (error) {
            console.error('Error loading game data:', error);
            await debugLog('Error loading game data', { error: error.message });
        }

        return [];
    }

    generateShotHash(shotData) {
        // Create a unique hash from shot data for duplicate detection
        const keyFields = ['time', 'shooting_team', 'shooter', 'distance', 'angle', 'xg'];
        const hashString = keyFields.map(field => {
            let value = shotData[field];
            if (value === null || value === undefined) return '';
            const strValue = String(value);
            // Normalize numeric values to avoid floating point differences
            if (/^-?\d+\.?\d*$/.test(strValue)) {
                return parseFloat(strValue).toFixed(2);
            }
            return strValue;
        }).join('|');

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < hashString.length; i++) {
            const char = hashString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        return `${hash}_${hashString.substring(0, 50)}`;
    }

    async importShots(gameId, shotsData) {
        let uniqueCount = 0;
        let duplicateCount = 0;
        const duplicates = [];

        // Get existing shot hashes for this game
        const existingShotsResult = this.db.exec(`
            SELECT time, shooting_team, shooter, distance, angle, xg
            FROM shots WHERE game_id = ?
        `, [gameId]);

        const existingShotHashes = new Set();
        if (existingShotsResult.length > 0) {
            existingShotsResult[0].values.forEach(row => {
                const shotData = {
                    time: row[0],
                    shooting_team: row[1],
                    shooter: row[2],
                    distance: row[3],
                    angle: row[4],
                    xg: row[5]
                };
                existingShotHashes.add(this.generateShotHash(shotData));
            });
        }

        // Import shots
        shotsData.forEach((row, index) => {
            const shotHash = this.generateShotHash(row);

            if (existingShotHashes.has(shotHash)) {
                duplicateCount++;
                if (duplicateCount <= 3) {
                    duplicates.push({
                        row: index + 1,
                        data: row
                    });
                }
            } else {
                // Insert the shot
                const columns = Object.keys(row).filter(key => key !== 'Date');
                const placeholders = columns.map(() => '?').join(', ');
                const values = columns.map(col => row[col]);

                const insertQuery = `
                    INSERT INTO shots (game_id, ${columns.join(', ')})
                    VALUES (?, ${placeholders})
                `;

                this.db.run(insertQuery, [gameId, ...values]);
                uniqueCount++;
                existingShotHashes.add(shotHash);
            }
        });

        await this.saveDatabaseToFile();

        return {
            uniqueCount,
            duplicateCount,
            duplicates
        };
    }

    async createOrGetGame(gameName, gameDate) {
        // Check if game already exists
        const existingGameResult = this.db.exec(
            "SELECT game_id FROM games WHERE LOWER(TRIM(game_name)) = LOWER(TRIM(?)) AND game_date = ?",
            [gameName, gameDate]
        );

        if (existingGameResult.length > 0 && existingGameResult[0].values.length > 0) {
            return {
                gameId: existingGameResult[0].values[0][0],
                isNewGame: false
            };
        }

        // Create new game
        this.db.run(
            "INSERT INTO games (game_name, game_date) VALUES (?, ?)",
            [gameName, gameDate]
        );

        const newGameResult = this.db.exec("SELECT last_insert_rowid()");
        return {
            gameId: newGameResult[0].values[0][0],
            isNewGame: true
        };
    }

    // Corrections methods
    async loadCorrectionsGamesList() {
        try {
            const games = this.db.exec(`
                SELECT game_id, game_name, game_date, team1, team2
                FROM games
                ORDER BY game_date DESC, game_name
            `);

            return games[0]?.values || [];
        } catch (error) {
            console.error('Error loading corrections games list:', error);
            await debugLog('Error loading corrections games list', { error: error.message });
            return [];
        }
    }

    async loadCorrectionsForGame(gameId) {
        if (!gameId) {
            return null;
        }

        try {
            // Load game info
            const gameResult = this.db.exec(`
                SELECT game_name, game_date, team1, team2
                FROM games WHERE game_id = ?
            `, [gameId]);

            if (gameResult.length === 0 || gameResult[0].values.length === 0) {
                return null;
            }

            const [gameName, gameDate, team1, team2] = gameResult[0].values[0];

            // Load shots
            const shotsResult = this.db.exec(`
                SELECT * FROM shots
                WHERE game_id = ?
                ORDER BY shot_id
            `, [gameId]);

            // Load corrections
            const correctionsResult = this.db.exec(`
                SELECT sc.*
                FROM shot_corrections sc
                JOIN shots s ON sc.shot_id = s.shot_id
                WHERE s.game_id = ?
            `, [gameId]);

            const corrections = {};
            if (correctionsResult.length > 0) {
                const correctionHeaders = correctionsResult[0].columns;
                correctionsResult[0].values.forEach(row => {
                    const correctionObj = {};
                    correctionHeaders.forEach((header, index) => {
                        correctionObj[header] = row[index];
                    });
                    corrections[correctionObj.shot_id] = correctionObj;
                });
            }

            const shots = [];
            if (shotsResult.length > 0 && shotsResult[0].values.length > 0) {
                const headers = shotsResult[0].columns;
                shotsResult[0].values.forEach(row => {
                    const shotObj = {};
                    headers.forEach((header, index) => {
                        shotObj[header] = row[index];
                    });
                    shots.push(shotObj);
                });
            }

            return {
                gameName,
                gameDate,
                team1,
                team2,
                shots,
                corrections
            };
        } catch (error) {
            console.error('Error loading corrections for game:', error);
            await debugLog('Error loading corrections for game', { error: error.message });
            return null;
        }
    }

    async saveCorrection(shotId, correctionData) {
        try {
            // Check if correction already exists
            const existingCorrection = this.db.exec(
                "SELECT id FROM shot_corrections WHERE shot_id = ?",
                [shotId]
            );

            if (existingCorrection.length > 0 && existingCorrection[0].values.length > 0) {
                // Update existing correction
                const updateFields = [];
                const updateValues = [];

                Object.keys(correctionData).forEach(key => {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(correctionData[key]);
                });

                if (updateFields.length > 0) {
                    updateValues.push(shotId);
                    const updateQuery = `
                        UPDATE shot_corrections
                        SET ${updateFields.join(', ')}, corrected_at = CURRENT_TIMESTAMP
                        WHERE shot_id = ?
                    `;
                    this.db.run(updateQuery, updateValues);
                }
            } else {
                // Insert new correction
                const fields = ['shot_id', ...Object.keys(correctionData)];
                const placeholders = fields.map(() => '?').join(', ');
                const values = [shotId, ...Object.values(correctionData)];

                const insertQuery = `
                    INSERT INTO shot_corrections (${fields.join(', ')})
                    VALUES (${placeholders})
                `;
                this.db.run(insertQuery, values);
            }

            await this.saveDatabaseToFile();
            return true;
        } catch (error) {
            console.error('Error saving correction:', error);
            await debugLog('Error saving correction', { error: error.message });
            return false;
        }
    }

    async deleteCorrection(shotId) {
        try {
            this.db.run("DELETE FROM shot_corrections WHERE shot_id = ?", [shotId]);
            await this.saveDatabaseToFile();
            return true;
        } catch (error) {
            console.error('Error deleting correction:', error);
            await debugLog('Error deleting correction', { error: error.message });
            return false;
        }
    }

    getAllPlayers() {
        try {
            const result = this.db.exec(`
                SELECT DISTINCT shooter as player FROM corrected_shots
                WHERE shooter IS NOT NULL AND shooter != ''
                UNION
                SELECT DISTINCT final_assisted_by as player FROM corrected_shots
                WHERE final_assisted_by IS NOT NULL AND final_assisted_by != ''
                UNION
                SELECT DISTINCT defender as player FROM corrected_shots
                WHERE defender IS NOT NULL AND defender != ''
                ORDER BY player
            `);

            if (result.length > 0 && result[0].values.length > 0) {
                return result[0].values.map(row => row[0]);
            }
        } catch (error) {
            console.error('Error getting all players:', error);
        }

        return [];
    }

    // Helper method to execute raw queries (for complex operations)
    exec(query, params = []) {
        return this.db.exec(query, params);
    }

    run(query, params = []) {
        return this.db.run(query, params);
    }
}

// Export as global for use in app.js
window.DatabaseManager = DatabaseManager;

// Debug logging function (shared with app.js)
async function debugLog(message, data = null) {
    try {
        await fetch('/api/debug-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                data: data ? JSON.stringify(data) : null
            })
        });
    } catch (error) {
        console.error('Debug log failed:', error);
    }
}

window.debugLog = debugLog;