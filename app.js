// Debug logging function
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

class FloorballApp {
    constructor() {
        console.log('FloorballApp constructor called');
        debugLog('FloorballApp constructor called');
        this.db = null;
        this.currentData = null;
        this.currentGameData = null; // Store current game shots for filtering
        this.initializeApp().catch(error => {
            console.error('App initialization failed:', error);
            debugLog('App initialization failed', { error: error.message });
        });
    }

    async initializeApp() {
        try {
            console.log('Starting app initialization...');
            await debugLog('Starting app initialization');
            
            await this.initializeDatabase();
            console.log('Database initialized');
            await debugLog('Database initialized');
            
            this.setupEventListeners();
            console.log('Event listeners set up');
            await debugLog('Event listeners set up');
            
            this.setupTabs();
            console.log('Tabs set up');
            await debugLog('Tabs set up');
            
            await this.loadGamesList();
            console.log('Floorball app initialized successfully');
            await debugLog('Floorball app initialized successfully');
            
            // Check initial database state
            this.checkDatabaseState();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            await debugLog('Failed to initialize app', { error: error.message });
            this.showStatus('Failed to initialize application', 'error');
        }
    }

    async initializeDatabase() {
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
            await this.migrateDatabase();
            this.createOrUpdateViews();
            await this.saveDatabaseToFile(); // Save after migration
            return;
        }
        
        // Create new database if no existing file
        this.db = new SQL.Database();
        console.log('New database created');
        
        // Create games table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS games (
                game_id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_name TEXT NOT NULL,
                game_date TEXT NOT NULL,
                team1 TEXT NOT NULL,
                team2 TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create shots table with proper foreign key
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
            )
        `);

        console.log('Database tables created successfully');

        this.createOrUpdateViews();
    }

    async migrateDatabase() {
        console.log('Checking database schema for migrations...');
        await debugLog('Migration: Checking database schema');

        try {
            const tableInfo = this.db.exec("PRAGMA table_info(shots)");
            const columns = tableInfo[0].values.map(row => row[1]);

            console.log('Existing columns:', columns);
            await debugLog('Migration: Existing columns', { columns, count: columns.length });

            const requiredColumns = ['x_m', 'y_m', 'x_graph', 'y_graph'];
            const missingColumns = requiredColumns.filter(col => !columns.includes(col));

            if (missingColumns.length > 0) {
                console.log('Missing columns detected, adding:', missingColumns);
                await debugLog('Migration: Adding missing columns', { missingColumns });

                missingColumns.forEach(colName => {
                    this.db.run(`ALTER TABLE shots ADD COLUMN ${colName} REAL`);
                    console.log(`Added column: ${colName}`);
                });

                await debugLog('Migration: Columns added successfully');

                console.log('Calculating coordinates for existing shots...');
                const shots = this.db.exec("SELECT shot_id, distance, angle FROM shots");

                if (shots.length > 0) {
                    shots[0].values.forEach(row => {
                        const [shotId, distance, angle] = row;
                        const coords = this.calculateCoordinates(distance, angle);

                        this.db.run(`
                            UPDATE shots
                            SET x_m = ?, y_m = ?, x_graph = ?, y_graph = ?
                            WHERE shot_id = ?
                        `, [coords.x_m, coords.y_m, coords.x_graph, coords.y_graph, shotId]);
                    });
                    console.log(`Updated coordinates for ${shots[0].values.length} shots`);
                    await debugLog('Migration: Updated coordinates', { shotCount: shots[0].values.length });
                }
            } else {
                console.log('Database schema is up to date');
                await debugLog('Migration: Schema is up to date', { columnCount: columns.length });
            }

            // Verify final schema
            const finalTableInfo = this.db.exec("PRAGMA table_info(shots)");
            const finalColumns = finalTableInfo[0].values.map(row => row[1]);
            console.log('Final column count:', finalColumns.length);
            await debugLog('Migration: Complete', { finalColumnCount: finalColumns.length, finalColumns });

            // Recalculate all coordinates with the corrected formula
            console.log('Recalculating coordinates for all existing shots...');
            const allShots = this.db.exec("SELECT shot_id, distance, angle FROM shots");

            if (allShots.length > 0 && allShots[0].values.length > 0) {
                allShots[0].values.forEach(row => {
                    const [shotId, distance, angle] = row;
                    const coords = this.calculateCoordinates(distance, angle);

                    this.db.run(`
                        UPDATE shots
                        SET x_m = ?, y_m = ?, x_graph = ?, y_graph = ?
                        WHERE shot_id = ?
                    `, [coords.x_m, coords.y_m, coords.x_graph, coords.y_graph, shotId]);
                });
                console.log(`Recalculated coordinates for ${allShots[0].values.length} shots`);
                await debugLog('Migration: Recalculated all coordinates', { shotCount: allShots[0].values.length });
            }

        } catch (error) {
            console.error('Migration error:', error);
            await debugLog('Migration: ERROR', { error: error.message, stack: error.stack });
        }
    }

    calculateCoordinates(distance, angle) {
        const dist = parseFloat(distance) || 0;
        const ang = parseFloat(angle) || 0;

        const angleRad = ang * (Math.PI / 180);

        const y_m = Math.sin(angleRad) * dist + 3.5;
        const x_m_old = 10 - Math.cos(angleRad) * dist;
        const x_m = 20 - x_m_old; // Flip on vertical line at 10m
        const x_graph = x_m * 30;
        const y_graph = y_m * 30;

        return { x_m, y_m, x_graph, y_graph };
    }

    createOrUpdateViews() {
        try {
            this.db.run(`DROP VIEW IF EXISTS shots_view`);
        } catch (error) {
            console.log('No existing view to drop');
        }

        this.db.run(`
            CREATE VIEW shots_view AS
            SELECT
                shot_id,
                game_id,
                date,
                team1,
                team2,
                shooting_team,
                result,
                type,
                xg,
                xgot,
                shooter,
                passer,
                t1lw,
                t1c,
                t1rw,
                t1ld,
                t1rd,
                t1g,
                t1x,
                pp,
                sh,
                distance,
                angle,
                x_m,
                y_m,
                x_graph,
                y_graph
            FROM shots
        `);

        console.log('Database views created/updated successfully');
    }

    async saveDatabaseToFile() {
        try {
            const dbArray = this.db.export();
            console.log('Database size:', dbArray.length, 'bytes');
            await debugLog('Saving database to project folder', { size: dbArray.length });
            
            // Save directly to server (no download popup)
            await this.uploadDatabaseToServer(dbArray);
            
        } catch (error) {
            console.error('Error saving database file:', error);
            await debugLog('Error saving database file', { error: error.message });
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
                console.log('Database saved to project folder successfully');
                await debugLog('Database saved to project folder successfully');
                this.showStatus('Database saved successfully to project folder', 'success');
            } else {
                console.error('Failed to save database to server');
                await debugLog('Failed to save database to server');
                this.showStatus('Failed to save database to project folder', 'error');
            }
        } catch (error) {
            console.error('Error uploading database to server:', error);
            await debugLog('Error uploading database to server', { error: error.message });
            this.showStatus('Error saving database to project folder', 'error');
        }
    }

    checkDatabaseState() {
        try {
            console.log('=== Database State Check ===');
            
            // Check games table
            const games = this.db.exec("SELECT * FROM games");
            console.log('Games in database:', games.length > 0 ? games[0].values : 'No games');
            
            // Check shots table
            const shots = this.db.exec("SELECT COUNT(*) as total FROM shots");
            console.log('Total shots in database:', shots.length > 0 ? shots[0].values[0][0] : 'No shots');
            
            // Check database file size
            const dbArray = this.db.export();
            console.log('Database size:', dbArray.length, 'bytes');
            
            console.log('=== End Database State ===');
        } catch (error) {
            console.error('Error checking database state:', error);
        }
    }

    // SQL.js loaded via CDN in HTML, so this method is not needed
    async loadSqlJs() {
        console.log('SQL.js should already be loaded from CDN');
        await debugLog('loadSqlJs called - SQL.js should be from CDN');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // File upload
        const csvFileInput = document.getElementById('csv-file');
        if (csvFileInput) {
            console.log('CSV file input found, adding event listener');
            csvFileInput.addEventListener('change', (e) => {
                console.log('File selection changed:', e.target.files);
                this.handleFileSelect(e);
            });
        } else {
            console.error('CSV file input not found');
        }

        // Import button
        const importBtn = document.getElementById('import-btn');
        if (importBtn) {
            console.log('Import button found, adding event listener');
            importBtn.addEventListener('click', () => {
                console.log('Import button clicked');
                this.importData();
            });
        } else {
            console.error('Import button not found');
        }

        // Game selector
        const gameSelector = document.getElementById('selected-game');
        if (gameSelector) {
            console.log('Game selector found, adding event listener');
            gameSelector.addEventListener('change', (e) => {
                console.log('Game selection changed:', e.target.value);
                this.loadGameData(e.target.value);
            });
        } else {
            console.error('Game selector not found');
        }


        // Toggle controls for visualization layers
        const toggleShotDots = document.getElementById('toggle-shot-dots');
        if (toggleShotDots) {
            toggleShotDots.addEventListener('click', () => {
                toggleShotDots.classList.toggle('active');
                const isActive = toggleShotDots.classList.contains('active');
                console.log('Toggle shot dots:', isActive);
                this.toggleShotDots(isActive);
            });
        }

        const toggleHeatmap = document.getElementById('toggle-heatmap');
        if (toggleHeatmap) {
            toggleHeatmap.addEventListener('click', () => {
                toggleHeatmap.classList.toggle('active');
                const isActive = toggleHeatmap.classList.contains('active');
                console.log('Toggle heatmap:', isActive);
                this.toggleHeatmap(isActive);
            });
        }

        // Setup filter toggle buttons
        this.setupFilterToggleButtons();
    }

    setupFilterToggleButtons() {
        // Setup all toggle buttons (result and type filters)
        const allButtons = document.querySelectorAll('.toggle-button-grid .toggle-button');
        allButtons.forEach(button => {
            button.addEventListener('click', () => {
                button.classList.toggle('active');
                this.applyFilters();
            });
        });

        // Setup shooter select dropdown
        const shooterSelect = document.getElementById('filter-shooter');
        if (shooterSelect) {
            shooterSelect.addEventListener('change', () => {
                this.applyFilters();
            });
        }
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // Remove active classes
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active classes
                button.classList.add('active');
                document.getElementById(`${targetTab}-tab`).classList.add('active');

                // If switching to dashboard tab, ensure all games are loaded if nothing is selected
                if (targetTab === 'dashboard') {
                    const gameSelect = document.getElementById('selected-game');
                    if (gameSelect && gameSelect.value === 'all') {
                        // Trigger loading all games
                        this.loadGameData('all');
                    }
                }
            });
        });
    }

    handleFileSelect(event) {
        console.log('=== FILE SELECTION DEBUG ===');
        debugLog('FILE SELECTION - handleFileSelect called', {
            target: event.target ? 'exists' : 'missing',
            filesCount: event.target?.files?.length || 0
        });
        
        const file = event.target.files[0];
        
        if (!file) {
            console.log('No file selected - returning');
            debugLog('FILE SELECTION - No file selected');
            return;
        }

        const fileDetails = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        };
        
        console.log('File details:', fileDetails);
        debugLog('FILE SELECTION - File selected', fileDetails);
        
        document.getElementById('file-name').textContent = file.name;
        console.log('File name set in UI:', file.name);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                debugLog('FILE SELECTION - FileReader onload triggered');
                this.currentData = this.parseCSV(e.target.result);
                debugLog('FILE SELECTION - CSV parsed', { rowCount: this.currentData.data.length });

                this.validateCSVStructure(this.currentData);
                debugLog('FILE SELECTION - CSV validation passed');

                // Auto-populate game name from filename
                // Expected format: Team1_Team2_shots.csv
                let gameName = '';
                const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove file extension
                const parts = fileName.split('_');

                if (parts.length >= 2) {
                    // Format as "Team1 - Team2"
                    const team1 = parts[0];
                    const team2 = parts[1];
                    gameName = `${team1} - ${team2}`;
                    document.getElementById('game-name').value = gameName;
                    console.log('Auto-populated game name:', gameName);
                }

                // Auto-populate date from first CSV row
                if (this.currentData.data.length > 0 && this.currentData.data[0]['Date']) {
                    const csvDate = this.currentData.data[0]['Date'];
                    document.getElementById('game-date').value = csvDate;
                    console.log('Auto-populated game date:', csvDate);
                }

                this.showCSVPreview(this.currentData);
                document.getElementById('import-btn').disabled = false;
                this.showStatus('CSV file loaded successfully. Game name and date auto-populated. Ready to import.', 'success');
                debugLog('FILE SELECTION - Ready for import with auto-populated fields', {
                    gameName: gameName,
                    gameDate: this.currentData.data[0]['Date'] || 'not found'
                });
            } catch (error) {
                debugLog('FILE SELECTION - Error reading CSV', { error: error.message });
                this.showStatus(`Error reading CSV: ${error.message}`, 'error');
                document.getElementById('import-btn').disabled = true;
            }
        };
        debugLog('FILE SELECTION - Starting file read');
        reader.readAsText(file);
    }

    parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }

        return { headers, data };
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    validateCSVStructure(csvData) {
        const requiredHeaders = [
            'Date', 'Team 1', 'Team 2', 'Time', 'Shooting Team', 
            'Result', 'Type', 'xG', 'xGOT', 'Distance', 'Angle'
        ];

        const missingHeaders = requiredHeaders.filter(header => 
            !csvData.headers.includes(header)
        );

        if (missingHeaders.length > 0) {
            throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
        }

        if (csvData.data.length === 0) {
            throw new Error('CSV file contains no data rows');
        }
    }

    showCSVPreview(csvData) {
        const previewDiv = document.getElementById('csv-preview');
        const maxRows = 10;
        const displayData = csvData.data.slice(0, maxRows);

        let html = '<table class="preview-table"><thead><tr>';
        csvData.headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += '</tr></thead><tbody>';

        displayData.forEach(row => {
            html += '<tr>';
            csvData.headers.forEach(header => {
                html += `<td>${row[header] || ''}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        
        if (csvData.data.length > maxRows) {
            html += `<p style="margin-top: 10px; font-style: italic;">Showing ${maxRows} of ${csvData.data.length} rows</p>`;
        }

        previewDiv.innerHTML = html;
    }

    generateShotHash(shotData) {
        const normalize = (value) => {
            if (value === null || value === undefined || value === '') return '';

            const strValue = value.toString().replace(/"/g, '').trim();

            if (strValue === '') return '';

            if (/^-?\d+\.?\d*$/.test(strValue)) {
                return parseFloat(strValue).toString();
            }

            return strValue;
        };

        const parts = [
            normalize(shotData['Date'] || shotData.date),
            normalize(shotData['Team 1'] || shotData.team1),
            normalize(shotData['Team 2'] || shotData.team2),
            normalize(shotData['Time'] || shotData.time),
            normalize(shotData['Shooting Team'] || shotData.shooting_team),
            normalize(shotData['Result'] || shotData.result),
            normalize(shotData['Type'] || shotData.type),
            normalize(shotData['xG'] || shotData.xg),
            normalize(shotData['xGOT'] || shotData.xgot),
            normalize(shotData['Shooter'] || shotData.shooter),
            normalize(shotData['Passer'] || shotData.passer),
            normalize(shotData['Distance'] || shotData.distance),
            normalize(shotData['Angle'] || shotData.angle),
            normalize(shotData['PP'] || shotData.pp),
            normalize(shotData['SH'] || shotData.sh)
        ];

        return parts.join('|').toLowerCase().replace(/\s+/g, '');
    }

    async importData() {
        const gameName = document.getElementById('game-name').value.trim();
        const gameDate = document.getElementById('game-date').value;

        if (!gameName || !gameDate) {
            this.showStatus('Please enter game name and date', 'error');
            return;
        }

        if (!this.currentData) {
            this.showStatus('Please select a CSV file first', 'error');
            return;
        }

        try {
            console.log('Starting import process with duplicate detection...');

            const firstRow = this.currentData.data[0];
            const team1 = firstRow['Team 1'];
            const team2 = firstRow['Team 2'];

            console.log('Loading ALL existing shots from database for duplicate check...');
            let allExistingShots = [];
            const allShotsResult = this.db.exec(`SELECT * FROM shots`);
            if (allShotsResult.length > 0) {
                const columns = allShotsResult[0].columns;
                allExistingShots = allShotsResult[0].values.map(row => {
                    const shot = {};
                    columns.forEach((col, index) => {
                        shot[col] = row[index];
                    });
                    return shot;
                });
            }
            console.log(`Found ${allExistingShots.length} total shots in database for duplicate checking`);

            const existingShotHashes = new Set(allExistingShots.map(shot => this.generateShotHash(shot)));
            console.log(`Generated ${existingShotHashes.size} unique hashes from all existing shots`);

            if (allExistingShots.length > 0) {
                console.log('===== HASH DEBUG =====');
                console.log('Sample DB shot raw data:', allExistingShots[0]);
                console.log('Sample DB shot hash:', this.generateShotHash(allExistingShots[0]));
                console.log('Sample CSV shot raw data:', this.currentData.data[0]);
                console.log('Sample CSV shot hash:', this.generateShotHash(this.currentData.data[0]));
                console.log('Hashes match?', this.generateShotHash(allExistingShots[0]) === this.generateShotHash(this.currentData.data[0]));
                console.log('===== END HASH DEBUG =====');
            }

            const existingGameResult = this.db.exec(`
                SELECT game_id FROM games
                WHERE LOWER(TRIM(game_name)) = LOWER(TRIM(?))
                AND game_date = ?
            `, [gameName, gameDate]);

            let gameId;
            let isNewGame = false;

            if (existingGameResult.length > 0 && existingGameResult[0].values.length > 0) {
                gameId = existingGameResult[0].values[0][0];
                console.log(`Found existing game with ID: ${gameId}`);
            } else {
                this.db.run(`
                    INSERT INTO games (game_name, game_date, team1, team2)
                    VALUES (?, ?, ?, ?)
                `, [gameName, gameDate, team1, team2]);

                const gameResult = this.db.exec("SELECT last_insert_rowid()");
                gameId = gameResult[0].values[0][0];
                isNewGame = true;
                console.log(`Created new game with ID: ${gameId}`);
            }

            let uniqueCount = 0;
            let duplicateCount = 0;

            console.log('===== STARTING DUPLICATE CHECK =====');
            console.log('Total CSV rows to check:', this.currentData.data.length);
            console.log('Total existing hashes:', existingShotHashes.size);

            this.currentData.data.forEach((row, index) => {
                const shotHash = this.generateShotHash(row);

                if (index === 0) {
                    console.log('First CSV shot hash:', shotHash);
                    console.log('First CSV shot data:', row);
                    console.log('Checking if hash exists in Set:', existingShotHashes.has(shotHash));
                    console.log('First 3 existing hashes:', Array.from(existingShotHashes).slice(0, 3));
                }

                if (existingShotHashes.has(shotHash)) {
                    duplicateCount++;
                    console.log(`DUPLICATE FOUND #${duplicateCount} - Skipping shot ${index + 1}`);
                    if (duplicateCount <= 3) {
                        console.log('  Duplicate details:', {
                            time: row['Time'],
                            shooter: row['Shooter'],
                            distance: row['Distance'],
                            hash: shotHash
                        });
                    }
                } else {
                    try {
                        const distance = parseFloat(row['Distance']) || 0;
                        const angle = parseFloat(row['Angle']) || 0;
                        const coords = this.calculateCoordinates(distance, angle);

                        if (index === 0) {
                            console.log('First shot INSERT attempt - coords:', coords);
                            debugLog('First shot INSERT attempt', {
                                distance,
                                angle,
                                coords,
                                gameId,
                                shooter: row['Shooter']
                            });
                        }

                        this.db.run(`
                            INSERT INTO shots (
                                game_id, date, team1, team2, time, shooting_team, result, type,
                                xg, xgot, shooter, passer, t1lw, t1c, t1rw, t1ld, t1rd, t1g, t1x,
                                t2lw, t2c, t2rw, t2ld, t2rd, t2g, t2x, pp, sh, distance, angle,
                                x_m, y_m, x_graph, y_graph,
                                player_team1, player_team2
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                     ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            gameId,
                            row['Date'],
                            row['Team 1'],
                            row['Team 2'],
                            parseInt(row['Time']) || 0,
                            row['Shooting Team'],
                            row['Result'],
                            row['Type'],
                            parseFloat(row['xG']) || 0,
                            parseFloat(row['xGOT']) || 0,
                            row['Shooter'],
                            row['Passer'],
                            row['T1LW'],
                            row['T1C'],
                            row['T1RW'],
                            row['T1LD'],
                            row['T1RD'],
                            row['T1G'],
                            row['T1X'],
                            row['T2LW'],
                            row['T2C'],
                            row['T2RW'],
                            row['T2LD'],
                            row['T2RD'],
                            row['T2G'],
                            row['T2X'],
                            parseInt(row['PP']) || 0,
                            parseInt(row['SH']) || 0,
                            distance,
                            angle,
                            coords.x_m,
                            coords.y_m,
                            coords.x_graph,
                            coords.y_graph,
                            parseInt(row['Player Team 1']) || 0,
                            parseInt(row['Player Team 2']) || 0
                        ]);
                        uniqueCount++;

                        if (index === 0) {
                            console.log('First shot INSERT succeeded');
                            debugLog('First shot INSERT succeeded');
                        }
                    } catch (shotError) {
                        console.error(`Error inserting shot ${index}:`, shotError);
                        debugLog(`Error inserting shot ${index}`, {
                            error: shotError.message,
                            stack: shotError.stack
                        });
                    }
                }
            });

            console.log('===== IMPORT COMPLETE =====');
            console.log(`Unique shots inserted: ${uniqueCount}`);
            console.log(`Duplicate shots skipped: ${duplicateCount}`);
            console.log(`Total CSV rows processed: ${this.currentData.data.length}`);
            console.log('===========================');

            if (uniqueCount === 0 && duplicateCount > 0) {
                if (isNewGame) {
                    this.db.run(`DELETE FROM games WHERE game_id = ?`, [gameId]);
                    console.log('Deleted empty game - all shots were duplicates');
                }
                this.showStatus(`Import aborted: All ${duplicateCount} shots already exist in database!`, 'error');
                alert(`WARNUNG: Alle ${duplicateCount} Schüsse existieren bereits in der Datenbank!\n\nDiese Datei wurde bereits importiert.`);
            } else {
                let message = isNewGame
                    ? `Created new game and imported ${uniqueCount} shots`
                    : `Added ${uniqueCount} new shots to existing game`;

                if (duplicateCount > 0) {
                    message += ` (${duplicateCount} duplicates skipped)`;
                    alert(`Import erfolgreich!\n\n${uniqueCount} neue Schüsse importiert\n${duplicateCount} Duplikate übersprungen`);
                }

                this.showStatus(message, 'success');
            }

            document.getElementById('game-name').value = '';
            document.getElementById('game-date').value = '';
            document.getElementById('csv-file').value = '';
            document.getElementById('file-name').textContent = '';
            document.getElementById('csv-preview').innerHTML = '';
            document.getElementById('import-btn').disabled = true;
            this.currentData = null;

            this.checkDatabaseState();
            await this.saveDatabaseToFile();
            await this.loadGamesList();

        } catch (error) {
            console.error('Import error:', error);
            this.showStatus(`Import failed: ${error.message}`, 'error');
        }
    }

    async loadGamesList() {
        try {
            const games = this.db.exec("SELECT game_id, game_name, game_date, team1, team2 FROM games ORDER BY game_date DESC");
            const gameSelect = document.getElementById('selected-game');

            gameSelect.innerHTML = '<option value="all" selected>All Games</option>';

            if (games.length > 0) {
                games[0].values.forEach(game => {
                    const [gameId, gameName, gameDate, team1, team2] = game;
                    const option = document.createElement('option');
                    option.value = gameId;
                    option.textContent = `${gameName} (${gameDate}) - ${team1} vs ${team2}`;
                    gameSelect.appendChild(option);
                });
            }

            // Automatically load all games when list is refreshed
            this.loadGameData('all');
        } catch (error) {
            console.error('Error loading games:', error);
        }
    }

    async loadGameData(gameId) {
        if (!gameId) {
            this.clearCharts();
            this.currentGameData = null;
            this.currentGameId = null;
            return;
        }

        try {
            let shots;

            if (gameId === 'all') {
                console.log('Loading data for ALL games');
                shots = this.db.exec(`
                    SELECT * FROM shots ORDER BY game_id, time
                `);
                console.log(`Found ${shots.length > 0 ? shots[0].values.length : 0} total shots across all games`);
            } else {
                console.log(`Loading data for game ID: ${gameId}`);
                shots = this.db.exec(`
                    SELECT * FROM shots WHERE game_id = ? ORDER BY time
                `, [gameId]);
                console.log(`Found ${shots.length > 0 ? shots[0].values.length : 0} shots for game ${gameId}`);
            }

            if (shots.length > 0 && shots[0].values.length > 0) {
                const columns = shots[0].columns;
                const data = shots[0].values.map(row => {
                    const obj = {};
                    columns.forEach((col, index) => {
                        obj[col] = row[index];
                    });
                    return obj;
                });

                console.log('Sample shot data:', data[0]);
                this.currentGameData = data;
                this.currentGameId = gameId;
                this.populateFilters(data);
                await this.createCharts(data);
            } else {
                console.log('No shots found for this game');
                this.currentGameData = null;
                this.currentGameId = null;
                this.clearCharts();
            }
        } catch (error) {
            console.error('Error loading game data:', error);
            this.showStatus(`Error loading game data: ${error.message}`, 'error');
        }
    }

    populateFilters(data) {
        // Get unique shooters
        const shooters = [...new Set(data.map(d => d.shooter).filter(s => s && s.trim() !== ''))].sort();
        const shooterSelect = document.getElementById('filter-shooter');
        shooterSelect.innerHTML = '<option value="" selected>All Shooters</option>';
        shooters.forEach(shooter => {
            const option = document.createElement('option');
            option.value = shooter;
            option.textContent = shooter;
            shooterSelect.appendChild(option);
        });
    }

    applyFilters() {
        if (!this.currentGameData) {
            return;
        }

        const shooterSelect = document.getElementById('filter-shooter');

        // Get selected values from toggle buttons
        const selectedResults = Array.from(document.querySelectorAll('.result-filter.active'))
            .map(btn => btn.getAttribute('data-value'));

        const selectedTypes = Array.from(document.querySelectorAll('.type-filter.active'))
            .map(btn => btn.getAttribute('data-value'));

        const selectedShooters = Array.from(shooterSelect.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        let filteredData = this.currentGameData;

        // Apply shooter filter
        if (selectedShooters.length > 0) {
            filteredData = filteredData.filter(d => selectedShooters.includes(d.shooter));
        }

        // Apply result filter (only if at least one is selected)
        if (selectedResults.length > 0) {
            filteredData = filteredData.filter(d => selectedResults.includes(d.result));
        }

        // Apply type filter with turnover logic
        if (selectedTypes.length > 0) {
            const isTurnoverActive = selectedTypes.includes('Turnover');
            const isDirectActive = selectedTypes.includes('Direct');
            const isOneTimerActive = selectedTypes.includes('One-timer');
            const isReboundActive = selectedTypes.includes('Rebound');

            const allowedTypes = [];

            // If only Turnover is selected, show all turnover shots
            if (isTurnoverActive && !isDirectActive && !isOneTimerActive && !isReboundActive) {
                allowedTypes.push('Turnover | Direct');
                allowedTypes.push('Turnover | One-timer');
            }

            if (isDirectActive) {
                allowedTypes.push('Direct');
                if (isTurnoverActive) {
                    allowedTypes.push('Turnover | Direct');
                }
            }

            if (isOneTimerActive) {
                allowedTypes.push('One-timer');
                if (isTurnoverActive) {
                    allowedTypes.push('Turnover | One-timer');
                }
            }

            if (isReboundActive) {
                allowedTypes.push('Rebound');
            }

            if (allowedTypes.length > 0) {
                filteredData = filteredData.filter(d => allowedTypes.includes(d.type));
            }
        }

        console.log(`Filtered data: ${filteredData.length} of ${this.currentGameData.length} shots`);
        this.createCharts(filteredData);

        // Update histogram overlays if player is selected
        if (selectedShooters.length === 1) {
            this.updateXGHistogramsWithPlayer(selectedShooters[0]);
        } else {
            // Clear player overlay if multiple or no shooters selected
            this.clearPlayerOverlay();
        }
    }


    async createCharts(data) {
        await this.createShotMap(data);
    }

    createShotResultsChart(data) {
        const container = d3.select('#shot-results-chart');
        container.selectAll('*').remove();

        const results = d3.rollup(data, v => v.length, d => d.result);
        const chartData = Array.from(results, ([key, value]) => ({result: key, count: value}));

        const margin = {top: 20, right: 20, bottom: 40, left: 40};
        const width = 400 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(chartData.map(d => d.result))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count)])
            .range([height, 0]);

        g.selectAll('.bar')
            .data(chartData)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.result))
            .attr('width', x.bandwidth())
            .attr('y', d => y(d.count))
            .attr('height', d => height - y(d.count));

        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y));
    }

    createTeamShotsChart(data) {
        const container = d3.select('#team-shots-chart');
        container.selectAll('*').remove();

        const teams = d3.rollup(data, v => v.length, d => d.shooting_team);
        const chartData = Array.from(teams, ([key, value]) => ({team: key, shots: value}));

        const margin = {top: 20, right: 20, bottom: 40, left: 40};
        const width = 400 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(chartData.map(d => d.team))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.shots)])
            .range([height, 0]);

        g.selectAll('.bar')
            .data(chartData)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.team))
            .attr('width', x.bandwidth())
            .attr('y', d => y(d.shots))
            .attr('height', d => height - y(d.shots));

        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y));
    }

    createXGTimelineChart(data) {
        const container = d3.select('#xg-timeline-chart');
        container.selectAll('*').remove();

        const timelineData = data.map(d => ({
            time: +d.time,
            xg: +d.xg,
            team: d.shooting_team
        })).filter(d => d.xg > 0).sort((a, b) => a.time - b.time);

        const margin = {top: 20, right: 20, bottom: 40, left: 40};
        const width = 400 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain(d3.extent(timelineData, d => d.time))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(timelineData, d => d.xg)])
            .range([height, 0]);

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        g.selectAll('.dot')
            .data(timelineData)
            .enter().append('circle')
            .attr('class', 'dot')
            .attr('cx', d => x(d.time))
            .attr('cy', d => y(d.xg))
            .attr('r', 4)
            .style('fill', d => color(d.team));

        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y));
    }

    createShotTypesChart(data) {
        const container = d3.select('#shot-types-chart');
        container.selectAll('*').remove();

        const types = d3.rollup(data, v => v.length, d => d.type);
        const chartData = Array.from(types, ([key, value]) => ({type: key, count: value}));

        const margin = {top: 20, right: 20, bottom: 40, left: 40};
        const width = 400 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(chartData.map(d => d.type))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count)])
            .range([height, 0]);

        g.selectAll('.bar')
            .data(chartData)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.type))
            .attr('width', x.bandwidth())
            .attr('y', d => y(d.count))
            .attr('height', d => height - y(d.count));

        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y));
    }

    async createShotMap(data) {
        console.log('Creating shot map...');
        await debugLog('Creating shot map', { dataLength: data.length });

        const container = d3.select('#shot-map-chart');
        container.selectAll('*').remove();

        // Filter out Possession shots
        const filteredData = data.filter(shot => {
            const result = shot.result || '';
            return !result.toLowerCase().includes('possession');
        });

        console.log(`Filtered shots: ${filteredData.length} (excluded ${data.length - filteredData.length} possession shots)`);
        await debugLog('Shot map filter', {
            total: data.length,
            filtered: filteredData.length,
            excluded: data.length - filteredData.length
        });

        // Use the field image dimensions
        // The field.png image and our x_graph/y_graph coordinates should match
        const fieldWidth = 600;  // Width of field.png
        const fieldHeight = 1200; // Height of field.png

        const margin = {top: 20, right: 250, bottom: 40, left: 20};

        const svg = container
            .append('svg')
            .attr('width', fieldWidth + margin.left + margin.right)
            .attr('height', fieldHeight + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Store SVG reference for toggling layers
        this.shotMapSvg = svg;
        this.shotMapG = g;

        // Define a clipping path for the field area
        svg.append('defs')
            .append('clipPath')
            .attr('id', 'field-clip')
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', fieldWidth)
            .attr('height', fieldHeight);

        // Add field background image
        g.append('image')
            .attr('href', 'public/images/field.png')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', fieldWidth)
            .attr('height', fieldHeight)
            .style('opacity', 0.9);

        // Filter shots that have valid coordinates and add visual coordinates
        const shotsWithCoords = filteredData.filter(shot => {
            const x = parseFloat(shot.x_graph);
            const y = parseFloat(shot.y_graph);
            return !isNaN(x) && !isNaN(y) && x >= 0 && y >= 0;
        }).map(shot => {
            // Determine if we need to flip coordinates based on shooting team
            const team1 = shot.team1;
            const shootingTeam = shot.shooting_team;
            const isTeam1 = shootingTeam === team1;

            let visualX, visualY;

            if (isTeam1) {
                // Team 1 shoots as-is
                visualX = parseFloat(shot.x_graph);
                visualY = parseFloat(shot.y_graph);
            } else {
                // Team 2 shoots flipped
                visualX = 600 - parseFloat(shot.x_graph);
                visualY = 1200 - parseFloat(shot.y_graph);
            }

            return {
                ...shot,
                visualX: visualX,
                visualY: visualY,
                isTeam1: isTeam1
            };
        });

        console.log(`Shots with valid coordinates: ${shotsWithCoords.length}`);
        await debugLog('Shots with coordinates', {
            count: shotsWithCoords.length,
            sampleShot: shotsWithCoords[0] ? {
                team1: shotsWithCoords[0].team1,
                shooting_team: shotsWithCoords[0].shooting_team,
                x_graph: shotsWithCoords[0].x_graph,
                y_graph: shotsWithCoords[0].y_graph,
                visualX: shotsWithCoords[0].visualX,
                visualY: shotsWithCoords[0].visualY,
                isTeam1: shotsWithCoords[0].isTeam1
            } : null
        });

        if (shotsWithCoords.length === 0) {
            g.append('text')
                .attr('x', fieldWidth / 2)
                .attr('y', fieldHeight / 2)
                .attr('text-anchor', 'middle')
                .style('fill', '#666')
                .style('font-size', '16px')
                .text('No shot location data available');
            return;
        }

        // Create hexbin heatmap layer with clipping to prevent overflow
        const heatmapGroup = g.append('g')
            .attr('class', 'heatmap-layer')
            .attr('clip-path', 'url(#field-clip)');
        if (shotsWithCoords.length > 0) {
            this.createHexbinHeatmap(heatmapGroup, shotsWithCoords, fieldWidth, fieldHeight);
        }

        // Create shot dots layer (hidden by default)
        const dotsGroup = g.append('g')
            .attr('class', 'dots-layer')
            .style('display', 'none'); // Hidden by default
        this.dotsLayer = dotsGroup;
        this.heatmapLayer = heatmapGroup;

        // Color scale based on result (updated for dark theme)
        const colorScale = d3.scaleOrdinal()
            .domain(['Goal', 'Saved', 'Missed', 'Blocked'])
            .range(['#10B981', '#00D9FF', '#F59E0B', '#EF4444']);

        // Create tooltip
        const tooltip = d3.select('body').select('.tooltip').empty()
            ? d3.select('body').append('div').attr('class', 'tooltip').style('opacity', 0)
            : d3.select('body').select('.tooltip');

        // Create scale for point size based on xG (0 to 1)
        const radiusScale = d3.scaleSqrt()
            .domain([0, 1])
            .range([3, 10]); // Minimum 3px, maximum 10px radius

        // Draw shot dots
        dotsGroup.selectAll('.shot-dot')
            .data(shotsWithCoords)
            .enter().append('circle')
            .attr('class', 'shot-dot')
            .attr('cx', d => d.visualX)
            .attr('cy', d => d.visualY)
            .attr('r', d => {
                const xg = parseFloat(d.xg) || 0;
                return radiusScale(Math.min(1, Math.max(0, xg))); // Clamp between 0 and 1
            })
            .style('fill', d => colorScale(d.result))
            .style('stroke', '#fff')
            .style('stroke-width', 1.5)
            .style('opacity', 0.8)
            .on('mouseover', function(event, d) {
                const xg = parseFloat(d.xg) || 0;
                const baseRadius = radiusScale(Math.min(1, Math.max(0, xg)));

                d3.select(this)
                    .style('opacity', 1)
                    .attr('r', baseRadius + 2); // Increase by 2px on hover

                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);

                tooltip.html(`
                    <strong>${d.result}</strong><br/>
                    Shooter: ${d.shooter || 'Unknown'}<br/>
                    Distance: ${parseFloat(d.distance).toFixed(1)}m<br/>
                    Angle: ${parseFloat(d.angle).toFixed(1)}°<br/>
                    xG: ${parseFloat(d.xg).toFixed(2)}
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(event, d) {
                const xg = parseFloat(d.xg) || 0;
                const baseRadius = radiusScale(Math.min(1, Math.max(0, xg)));

                d3.select(this)
                    .style('opacity', 0.8)
                    .attr('r', baseRadius); // Return to original size

                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        // Add legends
        this.addSimpleShotMapLegend(svg, fieldWidth, fieldHeight, margin, colorScale);
        this.addHeatmapLegend(svg, fieldWidth, fieldHeight, margin);

        // Hide shot legend by default (since dots are hidden by default)
        svg.select('.shot-map-legend').style('display', 'none');

        // Add xG histograms for both teams
        this.createXGHistograms(svg, filteredData, fieldWidth, fieldHeight, margin);

        console.log('Shot map created with dots and heatmap');
        await debugLog('Shot map complete', { dotsDrawn: shotsWithCoords.length });
    }

    async createScatterShotMap(g, shotData, width, height) {
        console.log('Creating scatter plot shot map');
        await debugLog('Creating scatter plot shot map', { shotCount: shotData.length });
        
        // Create simple scatter plot as fallback
        const colorScale = d3.scaleOrdinal()
            .domain(['Goal', 'Saved', 'Missed', 'Blocked'])
            .range(['#28a745', '#007bff', '#ffc107', '#dc3545']);
        
        g.selectAll('.shot-dot')
            .data(shotData)
            .enter().append('circle')
            .attr('class', 'shot-dot')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 4)
            .style('fill', d => colorScale(d.result))
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .style('opacity', 0.7)
            .on('mouseover', function(event, d) {
                d3.select(this).style('opacity', 1).attr('r', 6);
            })
            .on('mouseout', function(event, d) {
                d3.select(this).style('opacity', 0.7).attr('r', 4);
            });
        
        // Add simple legend
        const legend = g.append('g')
            .attr('class', 'scatter-legend')
            .attr('transform', `translate(${width - 120}, 20)`);
        
        const legendData = ['Goal', 'Saved', 'Missed', 'Blocked'];
        
        legend.selectAll('.legend-item')
            .data(legendData)
            .enter().append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`)
            .each(function(d) {
                const item = d3.select(this);
                item.append('circle')
                    .attr('r', 4)
                    .style('fill', colorScale(d));
                item.append('text')
                    .attr('x', 10)
                    .attr('y', 4)
                    .text(d)
                    .style('font-size', '12px');
            });
    }

    addFieldBackground(g, width, height) {
        // Add the field background image
        g.append('image')
            .attr('href', 'public/images/field.png')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .style('opacity', 0.8);
    }

    drawFloorballCourtOverlay(g, width, height, scale) {
        // Minimal overlay elements since we have the background image
        // Only add essential markers that might not be clear in the background
    }

    drawFloorballCourt(g, width, height, scale) {
        // Court outline (40m x 20m)
        g.append('rect')
            .attr('class', 'court-boundary')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .style('fill', '#e8f5e8');

        // Center line
        g.append('line')
            .attr('class', 'court-boundary')
            .attr('x1', width / 2)
            .attr('y1', 0)
            .attr('x2', width / 2)
            .attr('y2', height);

        // Center circle (1m radius)
        g.append('circle')
            .attr('class', 'center-circle')
            .attr('cx', width / 2)
            .attr('cy', height / 2)
            .attr('r', 1 * scale);

        // Goal areas (4m x 5m)
        const goalAreaWidth = 4 * scale;
        const goalAreaHeight = 5 * scale;
        const goalAreaY = (height - goalAreaHeight) / 2;

        // Left goal area
        g.append('rect')
            .attr('class', 'goal-area')
            .attr('x', 0)
            .attr('y', goalAreaY)
            .attr('width', goalAreaWidth)
            .attr('height', goalAreaHeight)
            .style('fill', 'none');

        // Right goal area
        g.append('rect')
            .attr('class', 'goal-area')
            .attr('x', width - goalAreaWidth)
            .attr('y', goalAreaY)
            .attr('width', goalAreaWidth)
            .attr('height', goalAreaHeight)
            .style('fill', 'none');

        // Goals (1.6m wide, 3.5m from baseline)
        const goalWidth = 1.6 * scale;
        const goalY = (height - goalWidth) / 2;
        const goalFromBaseline = 3.5 * scale;

        // Left goal (3.5m from left baseline)
        g.append('rect')
            .attr('class', 'court-boundary')
            .attr('x', goalFromBaseline - 2)
            .attr('y', goalY)
            .attr('width', 4)
            .attr('height', goalWidth)
            .style('fill', '#333');

        // Right goal (3.5m from right baseline)
        g.append('rect')
            .attr('class', 'court-boundary')
            .attr('x', width - goalFromBaseline - 2)
            .attr('y', goalY)
            .attr('width', 4)
            .attr('height', goalWidth)
            .style('fill', '#333');

        // Goal lines (marking the goal position)
        g.append('line')
            .attr('class', 'court-boundary')
            .attr('x1', goalFromBaseline)
            .attr('y1', goalY)
            .attr('x2', goalFromBaseline)
            .attr('y2', goalY + goalWidth)
            .style('stroke-width', '3px');

        g.append('line')
            .attr('class', 'court-boundary')
            .attr('x1', width - goalFromBaseline)
            .attr('y1', goalY)
            .attr('x2', width - goalFromBaseline)
            .attr('y2', goalY + goalWidth)
            .style('stroke-width', '3px');
    }

    prepareShotMapData(data, width, height, scale) {
        // Get team names to determine which goal each team attacks
        const team1 = data[0]?.team1;
        const team2 = data[0]?.team2;
        
        // Convert floorball shot data to x,y coordinates
        return data.map(shot => {
            // Use distance and angle to calculate position
            const distance = parseFloat(shot.distance) || 0;
            const angle = parseFloat(shot.angle) || 0;
            
            // Convert polar coordinates to cartesian
            // Angle 0° = straight at goal, positive angles = clockwise from goal center
            const angleRad = (angle * Math.PI) / 180;
            
            // Determine which goal is being attacked based on shooting team
            // In vertical orientation: goals are at top and bottom
            const goalFromBaseline = 3.5 * scale; // Goal is 3.5m from baseline
            let goalX, goalY;
            
            // Assume team1 attacks top goal, team2 attacks bottom goal
            if (shot.shooting_team === team1) {
                // Team1 attacks top goal
                goalX = width / 2;  // Center horizontally
                goalY = goalFromBaseline; // 3.5m from top
            } else {
                // Team2 attacks bottom goal  
                goalX = width / 2;  // Center horizontally
                goalY = height - goalFromBaseline; // 3.5m from bottom
                // Flip angle for bottom goal attacks (180° rotation)
                const angleRad = ((angle + 180) * Math.PI) / 180;
            }
            
            // Calculate shot origin position
            // For vertical orientation, we need to adjust the coordinate system
            const x = goalX + (distance * scale * Math.sin(angleRad));
            const y = goalY - (distance * scale * Math.cos(angleRad));
            
            // Ensure coordinates are within court bounds
            const clampedX = Math.max(0, Math.min(width, x));
            const clampedY = Math.max(0, Math.min(height, y));
            
            return {
                x: clampedX,
                y: clampedY,
                result: shot.result,
                type: shot.type,
                xg: parseFloat(shot.xg) || 0,
                distance: distance,
                angle: angle,
                shooter: shot.shooter,
                team: shot.shooting_team,
                goalX: goalX, // Store goal position for reference
                goalY: goalY,
                attackingGoal: shot.shooting_team === team1 ? 'top' : 'bottom'
            };
        }).filter(shot => shot.distance > 0); // Only include shots with distance data
    }

    addSimpleShotMapLegend(svg, width, height, margin, colorScale) {
        const legend = svg.append('g')
            .attr('class', 'shot-map-legend')
            .attr('transform', `translate(${margin.left + 20}, ${height + margin.top + 10})`);

        const legendData = [
            { result: 'Goal', label: 'Goal' },
            { result: 'Saved', label: 'Saved' },
            { result: 'Missed', label: 'Missed' },
            { result: 'Blocked', label: 'Blocked' }
        ];

        const legendItems = legend.selectAll('.legend-item')
            .data(legendData)
            .enter().append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(${i * 120}, 0)`);

        legendItems.append('circle')
            .attr('r', 5)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('fill', d => colorScale(d.result))
            .style('stroke', '#fff')
            .style('stroke-width', 1.5);

        legendItems.append('text')
            .attr('x', 12)
            .attr('y', 4)
            .text(d => d.label)
            .style('font-size', '14px')
            .style('fill', '#333');
    }

    createHexbinHeatmap(group, shotsWithCoords, width, height) {
        const heatmapLog = [];
        heatmapLog.push(`[${new Date().toISOString()}] Starting createHexbinHeatmap`);
        heatmapLog.push(`d3 available: ${typeof d3 !== 'undefined'}`);
        heatmapLog.push(`d3.hexbin available: ${typeof d3.hexbin !== 'undefined'}`);
        heatmapLog.push(`Shots provided: ${shotsWithCoords.length}`);
        heatmapLog.push(`Width: ${width}, Height: ${height}`);

        // Always log the attempt
        console.log('createHexbinHeatmap called with', shotsWithCoords.length, 'shots');
        console.log('d3.hexbin available:', typeof d3.hexbin);

        if (!d3.hexbin) {
            const errorMsg = 'd3-hexbin not available, using fallback grid heatmap';
            console.warn(errorMsg);
            heatmapLog.push(`WARNING: ${errorMsg}`);
            debugLog('Heatmap Warning - Using fallback', { logs: heatmapLog });

            // Fallback: Create a simple grid-based heatmap
            this.createGridHeatmap(group, shotsWithCoords, width, height);
            return;
        }

        try {
            // Create hexbin generator with larger zones for better aggregation
            const hexbin = d3.hexbin()
                .x(d => d.visualX)
                .y(d => d.visualY)
                .radius(28) // Larger zones to aggregate more shots when data is sparse
                .extent([[0, 0], [width, height]]);

            heatmapLog.push('Hexbin generator created successfully');

            // Calculate success rate for each hexbin
            const hexData = hexbin(shotsWithCoords).map(bin => {
                const goals = bin.filter(d => d.result === 'Goal').length;
                const total = bin.length;
                const successRate = total > 0 ? goals / total : 0;
                return {
                    ...bin,
                    goals: goals,
                    total: total,
                    successRate: successRate
                };
            });
            heatmapLog.push(`Hexbin data created: ${hexData.length} hexagons`);

            // Filter out hexagons with very few shots for cleaner visualization
            // Note: After mapping, we should use d.total not d.length
            const filteredHexData = hexData.filter(d => d.total >= 1);
            heatmapLog.push(`Filtered hexagon data: ${filteredHexData.length} hexagons`);

            // Get league average for comparison (optional)
            const leagueAverage = shotsWithCoords.filter(d => d.result === 'Goal').length / shotsWithCoords.length;
            heatmapLog.push(`League average success rate: ${(leagueAverage * 100).toFixed(1)}%`);

            // Create custom color scale for dark theme
            // Using theme colors: purple -> cyan -> green for bad -> average -> good
            const colorScale = d3.scaleLinear()
                .domain([0, leagueAverage * 0.8, leagueAverage, leagueAverage * 1.2, 0.6])
                .range(['#7C3AED', '#00D9FF', '#00D9FF', '#10B981', '#10B981'])
                .clamp(true);
            heatmapLog.push('Color scale created');

            // Size scale based on number of shots (use area, not radius)
            const sizeScale = d3.scalePow()
                .exponent(0.8)
                .domain([0, d3.max(filteredHexData, d => d.total)])
                .range([0.3, 1.2]); // Scale factor for hexagon size
            heatmapLog.push(`Size scale created with max: ${d3.max(filteredHexData, d => d.total)} shots`);

            // Create tooltip
            const tooltip = d3.select('body').select('.heatmap-tooltip').empty()
                ? d3.select('body').append('div').attr('class', 'heatmap-tooltip tooltip').style('opacity', 0)
                : d3.select('body').select('.heatmap-tooltip');
            heatmapLog.push('Tooltip created');

            // Draw hexagons with variable size based on shot frequency
            const hexagons = group.selectAll('.hexagon')
                .data(filteredHexData)
                .enter().append('g')
                .attr('class', 'hexagon-group')
                .attr('transform', d => `translate(${d.x},${d.y})`);
            heatmapLog.push(`Created ${hexagons.size()} hexagon groups`);

            hexagons.append('path')
                .attr('class', 'hexagon')
                .attr('d', hexbin.hexagon())
                .attr('transform', d => {
                    const scale = sizeScale(d.total);
                    return `scale(${scale})`;
                })
                .style('fill', d => colorScale(d.successRate))
                .style('stroke', '#fff')
                .style('stroke-width', 1)
                .style('opacity', 0.85)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .style('opacity', 1)
                    .style('stroke-width', 2);

                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);

                const percentage = (d.successRate * 100).toFixed(1);
                const aboveAverage = d.successRate > leagueAverage;
                const diff = ((d.successRate - leagueAverage) * 100).toFixed(1);

                tooltip.html(`
                    <strong>Zone Statistics</strong><br/>
                    Shots: ${d.total}<br/>
                    Goals: ${d.goals}<br/>
                    Success Rate: ${percentage}%<br/>
                    ${aboveAverage ? '↑' : '↓'} ${Math.abs(diff)}% vs average
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .style('opacity', 0.85)
                    .style('stroke-width', 1);

                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

            // Add text labels for high-volume zones (optional)
            hexagons.filter(d => d.total >= 5) // Only label zones with 5+ shots
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.3em')
                .style('font-size', '11px')
                .style('font-weight', 'bold')
                .style('fill', '#fff')
                .style('pointer-events', 'none')
                .text(d => `${(d.successRate * 100).toFixed(0)}%`);

            heatmapLog.push('Heatmap creation completed successfully');
            debugLog('Heatmap Success', { logs: heatmapLog });

        } catch (error) {
            heatmapLog.push(`ERROR: ${error.message}`);
            heatmapLog.push(`Stack: ${error.stack}`);
            console.error('Error creating hexbin heatmap:', error);
            debugLog('Heatmap Error', {
                logs: heatmapLog,
                error: error.message,
                stack: error.stack
            });
        }
    }

    createGridHeatmap(group, shotsWithCoords, width, height) {
        console.log('Creating fallback grid heatmap');

        // Create a simple grid-based heatmap
        const cellSize = 40; // Size of each grid cell
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);

        // Create grid cells
        const grid = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * cellSize;
                const y = row * cellSize;

                // Find shots in this cell
                const shotsInCell = shotsWithCoords.filter(shot =>
                    shot.visualX >= x && shot.visualX < x + cellSize &&
                    shot.visualY >= y && shot.visualY < y + cellSize
                );

                if (shotsInCell.length > 0) {
                    const goals = shotsInCell.filter(s => s.result === 'Goal').length;
                    const successRate = goals / shotsInCell.length;

                    grid.push({
                        x: x + cellSize / 2,
                        y: y + cellSize / 2,
                        total: shotsInCell.length,
                        goals: goals,
                        successRate: successRate
                    });
                }
            }
        }

        // Color scale for dark theme
        const colorScale = d3.scaleLinear()
            .domain([0, 0.3, 0.6])
            .range(['#7C3AED', '#00D9FF', '#10B981'])
            .clamp(true);

        // Draw grid cells
        group.selectAll('.grid-cell')
            .data(grid)
            .enter().append('rect')
            .attr('class', 'grid-cell')
            .attr('x', d => d.x - cellSize / 2)
            .attr('y', d => d.y - cellSize / 2)
            .attr('width', cellSize)
            .attr('height', cellSize)
            .style('fill', d => colorScale(d.successRate))
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .style('opacity', d => Math.min(0.8, 0.2 + (d.total * 0.1)))
            .append('title')
            .text(d => `Shots: ${d.total}, Goals: ${d.goals}, Success: ${(d.successRate * 100).toFixed(1)}%`);

        console.log('Grid heatmap created with', grid.length, 'cells');
    }

    toggleShotDots(show) {
        if (this.dotsLayer) {
            this.dotsLayer.style('display', show ? 'block' : 'none');
        }
        // Toggle shot legend visibility
        if (this.shotMapSvg) {
            this.shotMapSvg.select('.shot-map-legend').style('display', show ? 'block' : 'none');
        }
    }

    toggleHeatmap(show) {
        if (this.heatmapLayer) {
            this.heatmapLayer.style('display', show ? 'block' : 'none');
        }
        // Toggle heatmap legends visibility
        if (this.shotMapSvg) {
            this.shotMapSvg.select('.heatmap-legend').style('display', show ? 'block' : 'none');
            this.shotMapSvg.select('.size-legend').style('display', show ? 'block' : 'none');
        }
    }

    addHeatmapLegend(svg, width, height, margin) {
        // Position legend horizontally in the top goal zone (first 90 pixels)
        const legendGroup = svg.append('g')
            .attr('class', 'heatmap-legend')
            .attr('transform', `translate(${margin.left + 150}, ${margin.top + 30})`);

        // Legend title
        legendGroup.append('text')
            .attr('x', 0)
            .attr('y', -10)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .text('Success Rate');

        // Color gradient definition (horizontal)
        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'heatmap-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%')
            .attr('y1', '0%')
            .attr('y2', '0%');

        const colorStops = [
            { offset: '0%', color: '#7C3AED' },    // Purple (poor)
            { offset: '50%', color: '#00D9FF' },   // Cyan (average)
            { offset: '100%', color: '#10B981' }   // Green (excellent)
        ];

        colorStops.forEach(stop => {
            gradient.append('stop')
                .attr('offset', stop.offset)
                .attr('stop-color', stop.color);
        });

        // Legend rectangle (horizontal)
        legendGroup.append('rect')
            .attr('width', 200)
            .attr('height', 15)
            .style('fill', 'url(#heatmap-gradient)');

        // Legend scale labels (horizontal)
        const scaleLabels = [
            { value: '0%', x: 0 },
            { value: '30%', x: 100 },
            { value: '60%+', x: 200 }
        ];

        scaleLabels.forEach(label => {
            legendGroup.append('text')
                .attr('x', label.x)
                .attr('y', 28)
                .style('font-size', '10px')
                .style('fill', '#A0A0A8')
                .style('text-anchor', label.x === 0 ? 'start' : (label.x === 200 ? 'end' : 'middle'))
                .text(label.value);
        });

        // Size legend - positioned horizontally in the bottom goal zone (last 90 pixels)
        const sizeLegendGroup = svg.append('g')
            .attr('class', 'size-legend')
            .attr('transform', `translate(${margin.left + 150}, ${margin.top + height - 60})`);

        sizeLegendGroup.append('text')
            .attr('x', 0)
            .attr('y', -10)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .text('Shot Frequency');

        // Example hexagons for size (horizontal layout)
        const hexbin = d3.hexbin().radius(10);
        const sizeExamples = [
            { shots: 1, scale: 0.5 },
            { shots: 5, scale: 0.8 },
            { shots: 10, scale: 1.2 }
        ];

        sizeExamples.forEach((example, i) => {
            sizeLegendGroup.append('path')
                .attr('d', hexbin.hexagon(10 * example.scale))
                .attr('transform', `translate(${i * 70 + 15}, 10)`)
                .style('fill', '#00D9FF')
                .style('stroke', '#fff')
                .style('stroke-width', 1)
                .style('opacity', 0.5);

            sizeLegendGroup.append('text')
                .attr('x', i * 70 + 15)
                .attr('y', 30)
                .style('font-size', '10px')
                .style('fill', '#A0A0A8')
                .style('text-anchor', 'middle')
                .text(`${example.shots}+`);
        });
    }

    updateXGHistogramsWithPlayer(playerName) {
        if (!this.currentGameData || !this.team1HistGroup || !this.team2HistGroup) {
            return;
        }

        console.log(`Updating histograms with player overlay: ${playerName}`);

        // Get player's shots
        const playerShots = this.currentGameData.filter(d => d.shooter === playerName);

        if (playerShots.length === 0) {
            console.log(`No shots found for player: ${playerName}`);
            return;
        }

        // Determine which team the player belongs to based on their shooting
        const playerTeam = playerShots[0].shooting_team;

        // Find shots against the player when they were defending
        const shotsAgainstPlayer = this.currentGameData.filter(shot => {
            // Check if the player was on the field for the opposing team
            if (playerTeam === this.team1Name) {
                // Player is from team1, check if they were defending against team2's shots
                return shot.shooting_team === this.team2Name && (
                    shot.t1lw === playerName ||
                    shot.t1c === playerName ||
                    shot.t1rw === playerName ||
                    shot.t1ld === playerName ||
                    shot.t1rd === playerName ||
                    shot.t1g === playerName ||
                    shot.t1x === playerName
                );
            } else {
                // Player is from team2, check if they were defending against team1's shots
                return shot.shooting_team === this.team1Name && (
                    shot.t2lw === playerName ||
                    shot.t2c === playerName ||
                    shot.t2rw === playerName ||
                    shot.t2ld === playerName ||
                    shot.t2rd === playerName ||
                    shot.t2g === playerName ||
                    shot.t2x === playerName
                );
            }
        });

        console.log(`Found ${shotsAgainstPlayer.length} shots against ${playerName} when defending`);

        // Update histograms
        if (playerTeam === this.team1Name) {
            // Player from team1: show their shots on top, shots against them on bottom
            if (this.team1HistGroup) {
                this.addPlayerOverlay(this.team1HistGroup, playerShots, playerName, 'offensive');
            }
            if (this.team2HistGroup && shotsAgainstPlayer.length > 0) {
                this.addPlayerOverlay(this.team2HistGroup, shotsAgainstPlayer, playerName, 'defensive');
            }
        } else if (playerTeam === this.team2Name) {
            // Player from team2: show their shots on bottom, shots against them on top
            if (this.team2HistGroup) {
                this.addPlayerOverlay(this.team2HistGroup, playerShots, playerName, 'offensive');
            }
            if (this.team1HistGroup && shotsAgainstPlayer.length > 0) {
                this.addPlayerOverlay(this.team1HistGroup, shotsAgainstPlayer, playerName, 'defensive');
            }
        }
    }

    addPlayerOverlay(histGroup, playerShots, playerName, mode = 'offensive') {
        // Remove any existing player overlay
        histGroup.selectAll('.player-overlay').remove();

        // Get stored histogram data
        const histData = histGroup.datum();
        if (!histData) return;

        const { xScale, yScale, height, colorScale } = histData;

        // Filter out invalid xG values (adjusted to 0.6 max)
        const validPlayerShots = playerShots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        if (validPlayerShots.length === 0) return;

        // Create player bins with stacked data
        const binWidth = 0.05;
        const thresholds = d3.range(0, 0.6 + binWidth, binWidth);
        const resultTypes = ['Goal', 'Saved', 'Missed', 'Blocked'];

        const playerBinnedData = thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = validPlayerShots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });

            let y0 = 0;
            const stacks = resultTypes.map(result => {
                const count = binShots.filter(d => d.result === result).length;
                const stack = {
                    result: result,
                    count: count,
                    y0: y0,
                    y1: y0 + count
                };
                y0 += count;
                return stack;
            });

            return {
                x0: threshold,
                x1: thresholds[i + 1],
                total: binShots.length,
                stacks: stacks
            };
        });

        // Create player overlay group
        const playerOverlay = histGroup.append('g')
            .attr('class', 'player-overlay');

        // Draw player stacked bars with outline
        playerBinnedData.forEach(bin => {
            if (bin.total === 0) return;

            const binGroup = playerOverlay.append('g')
                .attr('transform', `translate(${xScale(bin.x0)}, 0)`);

            // Draw outline rectangle first
            binGroup.append('rect')
                .attr('class', 'player-outline')
                .attr('x', 0)
                .attr('y', yScale(bin.total))
                .attr('width', Math.max(0, xScale(bin.x1) - xScale(bin.x0) - 1))
                .attr('height', yScale(0) - yScale(bin.total))
                .style('fill', 'none')
                .style('stroke', mode === 'offensive' ? '#E06B47' : '#444A87')
                .style('stroke-width', 2);

            // Draw stack segments
            binGroup.selectAll('.player-stack')
                .data(bin.stacks.filter(s => s.count > 0))
                .enter().append('rect')
                .attr('class', 'player-stack')
                .attr('x', 1)
                .attr('width', Math.max(0, xScale(bin.x1) - xScale(bin.x0) - 3))
                .attr('y', d => yScale(d.y1))
                .attr('height', d => yScale(d.y0) - yScale(d.y1))
                .style('fill', d => colorScale(d.result))
                .style('opacity', 1)
                .style('stroke', '#fff')
                .style('stroke-width', 0.5);
        });

        // Add player average line
        const playerXgValues = validPlayerShots.map(d => parseFloat(d.xg));
        const playerAvgXG = d3.mean(playerXgValues);
        if (playerAvgXG) {
            const lineColor = mode === 'offensive' ? '#E06B47' : '#444A87';

            playerOverlay.append('line')
                .attr('class', 'player-average-line')
                .attr('x1', xScale(playerAvgXG))
                .attr('x2', xScale(playerAvgXG))
                .attr('y1', 0)
                .attr('y2', height)
                .style('stroke', lineColor)
                .style('stroke-width', 3)
                .style('stroke-dasharray', '3,3');

            const labelText = mode === 'offensive'
                ? `${playerName}: ${playerAvgXG.toFixed(3)}`
                : `vs ${playerName}: ${playerAvgXG.toFixed(3)}`;

            playerOverlay.append('text')
                .attr('x', xScale(playerAvgXG))
                .attr('y', -15)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', lineColor)
                .style('font-weight', 'bold')
                .text(labelText);
        }

        // Add player stats text
        const statsText = mode === 'offensive'
            ? `${playerName}: ${validPlayerShots.length} shots`
            : `Shots vs ${playerName}: ${validPlayerShots.length}`;

        playerOverlay.append('text')
            .attr('x', xScale(0.3))
            .attr('y', -25)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#E5E5E7')
            .style('font-weight', 'bold')
            .text(statsText);
    }

    clearPlayerOverlay() {
        if (this.team1HistGroup) {
            this.team1HistGroup.selectAll('.player-overlay').remove();
        }
        if (this.team2HistGroup) {
            this.team2HistGroup.selectAll('.player-overlay').remove();
        }
    }

    createXGHistograms(svg, data, fieldWidth, fieldHeight, margin) {
        console.log('Creating xG histograms');
        console.log('Current game ID:', this.currentGameId);

        // Get unique teams
        const teams = [...new Set(data.map(d => d.team1))].concat([...new Set(data.map(d => d.team2))]);
        const uniqueTeams = [...new Set(teams)].filter(t => t); // Remove nulls/undefined

        if (uniqueTeams.length === 0) {
            console.log('No teams found for histogram');
            return;
        }

        let team1, team2, team1Shots, team2Shots;

        if (this.currentGameId === 'all') {
            // For "All Games" view, show all shots in both histograms
            team1 = 'All Shots';
            team2 = 'All Shots';
            team1Shots = data;
            team2Shots = data;
        } else {
            // For individual games, separate by team
            team1 = uniqueTeams[0];
            team2 = uniqueTeams.length > 1 ? uniqueTeams[1] : team1;
            team1Shots = data.filter(d => d.shooting_team === team1);
            team2Shots = data.filter(d => d.shooting_team === team2);
        }

        // Position for histograms (right side of field)
        const histogramX = fieldWidth + margin.left + 20;
        const histogramWidth = 200;
        const histogramHeight = ((fieldHeight - 100) / 2) / 3;

        // Create histogram for Team 1 (upper half)
        const team1HistGroup = svg.append('g')
            .attr('class', 'xg-histogram-team1')
            .attr('transform', `translate(${histogramX}, ${margin.top + 20})`);

        this.drawXGHistogram(team1HistGroup, team1Shots, histogramWidth, histogramHeight, team1, 'team1');

        // Create histogram for Team 2 (lower half)
        const team2HistGroup = svg.append('g')
            .attr('class', 'xg-histogram-team2')
            .attr('transform', `translate(${histogramX}, ${margin.top + (fieldHeight / 2) + 100})`);

        this.drawXGHistogram(team2HistGroup, team2Shots, histogramWidth, histogramHeight, team2, 'team2');

        // Store references for updating with player overlay
        this.team1HistGroup = team1HistGroup;
        this.team2HistGroup = team2HistGroup;
        this.team1Name = team1;
        this.team2Name = team2;
        this.histogramWidth = histogramWidth;
        this.histogramHeight = histogramHeight;
    }

    drawXGHistogram(group, shots, width, height, teamName, teamClass) {
        // Filter out invalid xG values (xG goes up to 0.6)
        const validShots = shots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        if (validShots.length === 0) {
            group.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .style('fill', '#999')
                .text('No xG data available');
            return;
        }

        // Title
        group.append('text')
            .attr('x', width / 2)
            .attr('y', -5)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .text('xG Distribution');

        // Create bins and calculate stacked data
        const binWidth = 0.05;
        const thresholds = d3.range(0, 0.6 + binWidth, binWidth);
        const resultTypes = ['Goal', 'Saved', 'Missed', 'Blocked'];

        // Color scale for result types (updated for dark theme)
        const colorScale = d3.scaleOrdinal()
            .domain(resultTypes)
            .range(['#10B981', '#00D9FF', '#F59E0B', '#EF4444']);

        // Bin the data and calculate stacks
        const binnedData = thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = validShots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });

            const resultCounts = {};
            let y0 = 0;

            const stacks = resultTypes.map(result => {
                const count = binShots.filter(d => d.result === result).length;
                resultCounts[result] = count;
                const stack = {
                    result: result,
                    count: count,
                    y0: y0,
                    y1: y0 + count
                };
                y0 += count;
                return stack;
            });

            return {
                x0: threshold,
                x1: thresholds[i + 1],
                total: binShots.length,
                shots: binShots,
                stacks: stacks,
                resultCounts: resultCounts
            };
        });

        // Scales
        const x = d3.scaleLinear()
            .domain([0, 0.6])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(binnedData, d => d.total)])
            .nice()
            .range([height, 0]);

        // Draw stacked bars
        const barGroup = group.append('g').attr('class', 'histogram-bars');

        binnedData.forEach(bin => {
            const binGroup = barGroup.append('g')
                .attr('class', 'bin-group')
                .attr('transform', `translate(${x(bin.x0)}, 0)`);

            // Draw each stack segment
            binGroup.selectAll('.stack-segment')
                .data(bin.stacks.filter(s => s.count > 0))
                .enter().append('rect')
                .attr('class', d => `stack-segment result-${d.result.toLowerCase()}`)
                .attr('x', 0)
                .attr('width', Math.max(0, x(bin.x1) - x(bin.x0) - 1))
                .attr('y', d => y(d.y1))
                .attr('height', d => y(d.y0) - y(d.y1))
                .style('fill', d => colorScale(d.result))
                .style('opacity', 0.8)
                .style('stroke', '#fff')
                .style('stroke-width', 0.5)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    binGroup.selectAll('.stack-segment')
                        .style('opacity', 0.95);
                })
                .on('mouseout', function() {
                    binGroup.selectAll('.stack-segment')
                        .style('opacity', 0.8);
                })
                .append('title')
                .text(d => {
                    const tooltip = `xG: ${bin.x0.toFixed(2)}-${bin.x1.toFixed(2)}\n` +
                        `Total: ${bin.total} shots\n` +
                        `Goals: ${bin.resultCounts['Goal'] || 0}\n` +
                        `Saved: ${bin.resultCounts['Saved'] || 0}\n` +
                        `Missed: ${bin.resultCounts['Missed'] || 0}\n` +
                        `Blocked: ${bin.resultCounts['Blocked'] || 0}`;
                    return tooltip;
                });
        });

        // Add x-axis
        group.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickValues([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
                .tickFormat(d => d.toFixed(1)));

        // Add y-axis
        group.append('g')
            .call(d3.axisLeft(y).ticks(5));

        // Add axis labels
        group.append('text')
            .attr('transform', `translate(${width / 2}, ${height + 35})`)
            .style('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#A0A0A8')
            .text('xG Value');

        group.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -30)
            .attr('x', -height / 2)
            .style('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#A0A0A8')
            .text('Number of Shots');

        // Add average line
        const xgValues = validShots.map(d => parseFloat(d.xg));
        const avgXG = d3.mean(xgValues);
        if (avgXG) {
            group.append('line')
                .attr('class', 'average-line')
                .attr('x1', x(avgXG))
                .attr('x2', x(avgXG))
                .attr('y1', 0)
                .attr('y2', height)
                .style('stroke', '#A0A0A8')
                .style('stroke-width', 2)
                .style('stroke-dasharray', '5,5');

            group.append('text')
                .attr('x', x(avgXG))
                .attr('y', -2)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', '#A0A0A8')
                .text(`Avg: ${avgXG.toFixed(3)}`);
        }

        // Add result type legend (horizontal below the chart)
        const legendGroup = group.append('g')
            .attr('class', 'result-legend')
            .attr('transform', `translate(0, ${height + 45})`);

        resultTypes.forEach((result, i) => {
            const legendItem = legendGroup.append('g')
                .attr('transform', `translate(${i * 45}, 0)`);

            legendItem.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 10)
                .attr('height', 10)
                .style('fill', colorScale(result))
                .style('opacity', 0.8);

            legendItem.append('text')
                .attr('x', 12)
                .attr('y', 8)
                .style('font-size', '9px')
                .style('fill', '#A0A0A8')
                .text(result);
        });

        // Store data for player overlay
        group.datum({
            teamName: teamName,
            binnedData: binnedData,
            xScale: x,
            yScale: y,
            height: height,
            totalShots: validShots,
            colorScale: colorScale
        });
    }

    addShotMapLegend(svg, width, height, margin, colorScale) {
        const legendWidth = 200;
        const legendHeight = 20;
        const legendX = width + margin.left - legendWidth;
        const legendY = height + margin.top + 20;

        const legend = svg.append('g')
            .attr('class', 'shot-map-legend')
            .attr('transform', `translate(${legendX}, ${legendY})`);

        // Create gradient
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'legend-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%')
            .attr('y1', '0%')
            .attr('y2', '0%');

        gradient.selectAll('stop')
            .data(d3.range(0, 1.1, 0.1))
            .enter().append('stop')
            .attr('offset', d => `${d * 100}%`)
            .attr('stop-color', d => colorScale(d));

        // Legend rectangle
        legend.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#legend-gradient)')
            .style('stroke', '#333');

        // Legend labels
        legend.append('text')
            .attr('x', 0)
            .attr('y', legendHeight + 15)
            .text('0%')
            .style('text-anchor', 'start');

        legend.append('text')
            .attr('x', legendWidth / 2)
            .attr('y', legendHeight + 15)
            .text('Success Rate')
            .style('text-anchor', 'middle');

        legend.append('text')
            .attr('x', legendWidth)
            .attr('y', legendHeight + 15)
            .text('100%')
            .style('text-anchor', 'end');
    }

    clearCharts() {
        ['#shot-map-chart'].forEach(selector => {
            d3.select(selector).selectAll('*').remove();
            d3.select(selector).append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('justify-content', 'center')
                .style('height', '500px')
                .style('color', '#666')
                .text('Loading shot map...');
        });
    }

    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('import-status');
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status-message';
        }, 5000);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM LOADED - STARTING APP ===');

    // Check if required libraries are loaded
    console.log('D3 available:', typeof d3 !== 'undefined');
    console.log('D3.hexbin available:', typeof d3.hexbin !== 'undefined');
    console.log('SQL.js available:', typeof window.initSqlJs !== 'undefined');

    // Detailed d3-hexbin check
    if (typeof d3 !== 'undefined' && typeof d3.hexbin === 'undefined') {
        console.error('WARNING: d3-hexbin is NOT loaded! Heatmap will not work.');
        console.log('Attempting to verify d3-hexbin script tag...');
        const hexbinScript = document.querySelector('script[src*="d3-hexbin"]');
        if (hexbinScript) {
            console.log('d3-hexbin script tag found:', hexbinScript.src);
            console.log('Script loading may have failed or is still pending.');
        } else {
            console.log('No d3-hexbin script tag found in document!');
        }
    }

    debugLog('DOM LOADED - Library check', {
        d3Available: typeof d3 !== 'undefined',
        hexbinAvailable: typeof d3.hexbin !== 'undefined',
        d3Version: typeof d3 !== 'undefined' ? d3.version : 'not loaded',
        sqlJsAvailable: typeof window.initSqlJs !== 'undefined'
    });
    
    try {
        const app = new FloorballApp();
        console.log('FloorballApp created successfully:', app);
        debugLog('FloorballApp created successfully');
        window.floorballApp = app; // Make it globally accessible for debugging
    } catch (error) {
        console.error('Failed to create FloorballApp:', error);
        debugLog('Failed to create FloorballApp', { error: error.message, stack: error.stack });
    }
});