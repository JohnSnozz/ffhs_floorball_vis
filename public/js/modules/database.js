/**
 * Database Management Module
 * Handles SQLite database operations for shot data
 */
class DatabaseManager {
    constructor() {
        this.db = null;
        this.SQL = null;
    }

    async initialize() {
        try {
            this.SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });

            // Try to load existing database file
            await this.loadExistingDatabase();
            return true;
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    async loadExistingDatabase() {
        try {
            // Try to fetch existing database file
            const response = await fetch('./assets/shots_database.sqlite');
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                this.db = new this.SQL.Database(uint8Array);
                console.log('Loaded existing database file');
            } else {
                // Create new database if file doesn't exist
                this.db = new this.SQL.Database();
                this.createTables();
                console.log('Created new database');
            }
        } catch (error) {
            // Fallback to new database
            console.log('Could not load existing database, creating new one:', error.message);
            this.db = new this.SQL.Database();
            this.createTables();
        }
    }

    createTables() {
        // Create games table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create shots table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS shots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL,
                date TEXT,
                team1 TEXT,
                team2 TEXT,
                time TEXT,
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
                player_team1 INTEGER,
                player_team2 INTEGER,
                FOREIGN KEY (game_id) REFERENCES games (id)
            );
        `);
    }

    insertGame(name, date) {
        try {
            const result = this.db.exec(`
                INSERT INTO games (name, date)
                VALUES (?, ?)
                RETURNING id
            `, [name, date]);

            if (result.length > 0 && result[0].values.length > 0) {
                return result[0].values[0][0];
            } else {
                // Fallback: get the last inserted ID
                const lastIdResult = this.db.exec("SELECT last_insert_rowid() as id");
                return lastIdResult[0].values[0][0];
            }
        } catch (error) {
            console.error('Error inserting game:', error);
            throw error;
        }
    }

    insertShot(gameId, shotData) {
        try {
            this.db.run(`
                INSERT INTO shots (
                    game_id, date, team1, team2, time, shooting_team, result, type,
                    xg, xgot, shooter, passer, t1lw, t1c, t1rw, t1ld, t1rd, t1g, t1x,
                    t2lw, t2c, t2rw, t2ld, t2rd, t2g, t2x, pp, sh, distance, angle,
                    player_team1, player_team2
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                gameId,
                shotData.date || '',
                shotData.team1 || '',
                shotData.team2 || '',
                shotData.time || '',
                shotData.shooting_team || '',
                shotData.result || '',
                shotData.type || '',
                parseFloat(shotData.xg) || 0,
                parseFloat(shotData.xgot) || 0,
                shotData.shooter || '',
                shotData.passer || '',
                shotData.t1lw || '',
                shotData.t1c || '',
                shotData.t1rw || '',
                shotData.t1ld || '',
                shotData.t1rd || '',
                shotData.t1g || '',
                shotData.t1x || '',
                shotData.t2lw || '',
                shotData.t2c || '',
                shotData.t2rw || '',
                shotData.t2ld || '',
                shotData.t2rd || '',
                shotData.t2g || '',
                shotData.t2x || '',
                parseInt(shotData.pp) || 0,
                parseInt(shotData.sh) || 0,
                parseFloat(shotData.distance) || 0,
                parseFloat(shotData.angle) || 0,
                parseInt(shotData.player_team1) || 0,
                parseInt(shotData.player_team2) || 0
            ]);
            return true;
        } catch (error) {
            console.error('Error inserting shot:', error);
            return false;
        }
    }

    async saveDatabase() {
        try {
            const data = this.db.export();

            const response = await fetch('/api/save-database', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
                body: data
            });

            const result = await response.json();

            if (result.success) {
                return true;
            } else {
                console.error('Server save error:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Database save error:', error);
            return false;
        }
    }

    exportDatabase() {
        try {
            const data = this.db.export();
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'shots_database.sqlite';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            console.error('Export error:', error);
            return false;
        }
    }

    getGameCount() {
        try {
            const result = this.db.exec("SELECT COUNT(*) as count FROM games");
            return result[0] ? result[0].values[0][0] : 0;
        } catch (error) {
            return 0;
        }
    }

    getShotCount() {
        try {
            const result = this.db.exec("SELECT COUNT(*) as count FROM shots");
            return result[0] ? result[0].values[0][0] : 0;
        } catch (error) {
            return 0;
        }
    }

    getAllGames() {
        try {
            const result = this.db.exec("SELECT * FROM games ORDER BY created_at DESC");
            return result[0] ? result[0].values : [];
        } catch (error) {
            console.error('Error getting games:', error);
            return [];
        }
    }

    checkGameExists(gameName, gameDate) {
        try {
            const result = this.db.exec(
                "SELECT id FROM games WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND date = ?",
                [gameName, gameDate]
            );
            return result[0] && result[0].values.length > 0 ? result[0].values[0][0] : null;
        } catch (error) {
            console.error('Error checking game existence:', error);
            return null;
        }
    }

    getAllShotsForGame(gameId) {
        try {
            const result = this.db.exec("SELECT * FROM shots WHERE game_id = ?", [gameId]);
            if (!result[0]) return [];

            const columns = result[0].columns;
            const values = result[0].values;

            return values.map(row => {
                const shot = {};
                columns.forEach((col, index) => {
                    shot[col] = row[index];
                });
                return shot;
            });
        } catch (error) {
            console.error('Error getting shots for game:', error);
            return [];
        }
    }

    getAllShots() {
        try {
            const result = this.db.exec("SELECT * FROM shots");
            if (!result[0]) return [];

            const columns = result[0].columns;
            const values = result[0].values;

            return values.map(row => {
                const shot = {};
                columns.forEach((col, index) => {
                    shot[col] = row[index];
                });
                return shot;
            });
        } catch (error) {
            console.error('Error getting all shots:', error);
            return [];
        }
    }

    insertShotsInBatch(gameId, shotDataArray) {
        let insertedCount = 0;
        let skippedCount = 0;

        for (const shotData of shotDataArray) {
            if (this.insertShot(gameId, shotData)) {
                insertedCount++;
            } else {
                skippedCount++;
            }
        }

        return { inserted: insertedCount, skipped: skippedCount };
    }
}