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
            await this.loadCorrectionsGamesList();
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

        this.db.run(`
            CREATE TABLE IF NOT EXISTS shot_corrections (
                shot_id INTEGER PRIMARY KEY,
                time INTEGER,
                shooting_team TEXT,
                result TEXT,
                type TEXT,
                is_turnover INTEGER DEFAULT 0,
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
                player_team1 INTEGER,
                player_team2 INTEGER,
                FOREIGN KEY (shot_id) REFERENCES shots (shot_id) ON DELETE CASCADE
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS game_aliases (
                game_id INTEGER PRIMARY KEY,
                alias TEXT NOT NULL,
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

            const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            const tableNames = tables.length > 0 ? tables[0].values.map(row => row[0]) : [];

            if (!tableNames.includes('shot_corrections')) {
                console.log('Creating shot_corrections table...');
                await debugLog('Migration: Creating shot_corrections table');

                this.db.run(`
                    CREATE TABLE IF NOT EXISTS shot_corrections (
                        shot_id INTEGER PRIMARY KEY,
                        time INTEGER,
                        shooting_team TEXT,
                        result TEXT,
                        type TEXT,
                        is_turnover INTEGER DEFAULT 0,
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
                        player_team1 INTEGER,
                        player_team2 INTEGER,
                        FOREIGN KEY (shot_id) REFERENCES shots (shot_id) ON DELETE CASCADE
                    )
                `);

                console.log('shot_corrections table created');
                await debugLog('Migration: shot_corrections table created successfully');
            } else {
                const correctionTableInfo = this.db.exec("PRAGMA table_info(shot_corrections)");
                const correctionColumns = correctionTableInfo[0].values.map(row => row[1]);

                if (!correctionColumns.includes('is_turnover')) {
                    console.log('Adding is_turnover column to shot_corrections...');
                    this.db.run(`ALTER TABLE shot_corrections ADD COLUMN is_turnover INTEGER DEFAULT 0`);
                    console.log('is_turnover column added');
                    await debugLog('Migration: Added is_turnover column to shot_corrections');
                }
            }

            if (!tableNames.includes('game_aliases')) {
                console.log('Creating game_aliases table...');
                await debugLog('Migration: Creating game_aliases table');

                this.db.run(`
                    CREATE TABLE IF NOT EXISTS game_aliases (
                        game_id INTEGER PRIMARY KEY,
                        alias TEXT NOT NULL,
                        FOREIGN KEY (game_id) REFERENCES games (game_id) ON DELETE CASCADE
                    )
                `);

                console.log('game_aliases table created');
                await debugLog('Migration: game_aliases table created successfully');
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
            LEFT JOIN shot_corrections c ON s.shot_id = c.shot_id
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

        // Corrections game selector
        const correctionsGameSelect = document.getElementById('corrections-game-select');
        if (correctionsGameSelect) {
            correctionsGameSelect.addEventListener('change', (e) => {
                this.loadCorrectionsForGame(e.target.value);
                this.loadGameAlias(e.target.value);
            });
        }

        // Game alias save button
        const saveAliasBtn = document.getElementById('save-alias-btn');
        if (saveAliasBtn) {
            saveAliasBtn.addEventListener('click', () => {
                this.saveGameAlias();
            });
        }
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

        // Setup shooter search filter
        const shooterSearch = document.getElementById('shooter-search');
        if (shooterSearch) {
            shooterSearch.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const options = shooterSelect.querySelectorAll('option');

                options.forEach(option => {
                    if (option.value === '') {
                        option.style.display = '';
                        return;
                    }

                    const playerName = option.textContent.toLowerCase();
                    if (playerName.includes(searchTerm)) {
                        option.style.display = '';
                    } else {
                        option.style.display = 'none';
                    }
                });
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
            await this.loadCorrectionsGamesList();

        } catch (error) {
            console.error('Import error:', error);
            this.showStatus(`Import failed: ${error.message}`, 'error');
        }
    }

    async loadGamesList() {
        try {
            const games = this.db.exec("SELECT game_id, game_name, game_date, team1, team2 FROM games ORDER BY game_date DESC");
            const aliases = this.db.exec("SELECT game_id, alias FROM game_aliases");

            const aliasMap = {};
            if (aliases.length > 0) {
                aliases[0].values.forEach(([gameId, alias]) => {
                    aliasMap[gameId] = alias;
                });
            }

            const gameSelect = document.getElementById('selected-game');
            gameSelect.innerHTML = '<option value="all" selected>All Games</option>';

            const correctionsGameSelect = document.getElementById('corrections-game-select');
            if (correctionsGameSelect) {
                correctionsGameSelect.innerHTML = '<option value="">Choose a game...</option>';
            }

            if (games.length > 0) {
                games[0].values.forEach(game => {
                    const [gameId, gameName, gameDate, team1, team2] = game;
                    const displayName = aliasMap[gameId] || `${gameName} (${gameDate}) - ${team1} vs ${team2}`;

                    const option = document.createElement('option');
                    option.value = gameId;
                    option.textContent = displayName;
                    gameSelect.appendChild(option);

                    if (correctionsGameSelect) {
                        const corrOption = document.createElement('option');
                        corrOption.value = gameId;
                        corrOption.textContent = displayName;
                        correctionsGameSelect.appendChild(corrOption);
                    }
                });
            }

            this.loadGameData('all');
        } catch (error) {
            console.error('Error loading games:', error);
        }
    }

    loadGameAlias(gameId) {
        const aliasInput = document.getElementById('game-alias-input');
        const saveBtn = document.getElementById('save-alias-btn');

        if (!gameId) {
            aliasInput.value = '';
            aliasInput.disabled = true;
            saveBtn.disabled = true;
            return;
        }

        aliasInput.disabled = false;
        saveBtn.disabled = false;

        try {
            const result = this.db.exec("SELECT alias FROM game_aliases WHERE game_id = ?", [gameId]);
            if (result.length > 0 && result[0].values.length > 0) {
                aliasInput.value = result[0].values[0][0];
            } else {
                aliasInput.value = '';
            }
        } catch (error) {
            console.error('Error loading game alias:', error);
            aliasInput.value = '';
        }
    }

    async saveGameAlias() {
        const gameId = document.getElementById('corrections-game-select').value;
        const alias = document.getElementById('game-alias-input').value.trim();

        if (!gameId) {
            alert('Please select a game first');
            return;
        }

        try {
            if (alias) {
                const existing = this.db.exec("SELECT game_id FROM game_aliases WHERE game_id = ?", [gameId]);

                if (existing.length > 0 && existing[0].values.length > 0) {
                    this.db.run("UPDATE game_aliases SET alias = ? WHERE game_id = ?", [alias, gameId]);
                } else {
                    this.db.run("INSERT INTO game_aliases (game_id, alias) VALUES (?, ?)", [gameId, alias]);
                }
            } else {
                this.db.run("DELETE FROM game_aliases WHERE game_id = ?", [gameId]);
            }

            await this.saveDatabaseToFile();
            await this.loadGamesList();

            alert('Game alias saved successfully!');
        } catch (error) {
            console.error('Error saving game alias:', error);
            alert('Error saving game alias: ' + error.message);
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
                // Apply current filters instead of directly creating charts with unfiltered data
                this.applyFilters();
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
        const shooters = [...new Set(data.map(d => d.shooter).filter(s => s && s.trim() !== ''))];

        // Sort by jersey number (extract number after #)
        shooters.sort((a, b) => {
            const numA = parseInt(a.match(/#(\d+)/)?.[1] || '999');
            const numB = parseInt(b.match(/#(\d+)/)?.[1] || '999');
            return numA - numB;
        });

        const shooterSelect = document.getElementById('filter-shooter');

        // Save current selection before rebuilding dropdown
        const previouslySelected = Array.from(shooterSelect.selectedOptions).map(opt => opt.value);

        shooterSelect.innerHTML = '<option value="">All Shooters</option>';
        shooters.forEach(shooter => {
            const option = document.createElement('option');
            option.value = shooter;
            option.textContent = shooter;
            // Restore selection if this shooter was previously selected and still exists in new data
            if (previouslySelected.includes(shooter)) {
                option.selected = true;
            }
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

        // Store selected shooter for special histogram/map handling
        this.selectedShooter = selectedShooters.length === 1 ? selectedShooters[0] : null;

        // First, apply filters WITHOUT shooter filter for team background data
        let teamFilteredData = this.currentGameData;

        // Apply result filter to team data
        if (selectedResults.length > 0) {
            teamFilteredData = teamFilteredData.filter(d => selectedResults.includes(d.result));
        }

        // Apply type filter to team data
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
                teamFilteredData = teamFilteredData.filter(d => allowedTypes.includes(d.type));
            }
        }

        // Store the filtered team data for histogram background
        this.currentTeamFilteredData = teamFilteredData;

        // Now apply shooter filter for the main display
        let filteredData = teamFilteredData;
        if (selectedShooters.length > 0) {
            filteredData = filteredData.filter(d => selectedShooters.includes(d.shooter));
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
        console.log('=== createCharts called ===');
        console.log('Data passed to createCharts:', data.length, 'shots');
        console.log('currentGameData contains:', this.currentGameData?.length, 'shots');
        console.log('selectedShooter:', this.selectedShooter);

        // Check teams in currentGameData
        if (this.currentGameData) {
            const teams = new Set(this.currentGameData.map(d => d.shooting_team));
            console.log('Teams in currentGameData:', Array.from(teams));
        }

        // Calculate "on field" data if shooter is selected
        let onFieldData = null;
        if (this.selectedShooter) {
            // IMPORTANT: Use currentTeamFilteredData (result/type filters applied, but not shooter filter)
            // This ensures result/type filters apply to the lower hexagon map
            const team1Name = this.currentGameData[0]?.team1;
            const team2Name = this.currentGameData[0]?.team2;

            // Use filtered data (result/type filters) but not shooter-filtered
            const dataForOnField = this.currentTeamFilteredData || this.currentGameData;

            // For opponent shots, we need ALL shots from the game, not just the selected shooter's shots
            onFieldData = dataForOnField.filter(d => {
                const playerName = this.selectedShooter;
                // For opponent shots: shooting team is NOT team1
                const isOpponentShot = d.shooting_team && d.shooting_team !== team1Name;
                const playerOnField = d.t1lw === playerName ||
                                     d.t1c === playerName ||
                                     d.t1rw === playerName ||
                                     d.t1ld === playerName ||
                                     d.t1rd === playerName ||
                                     d.t1g === playerName ||
                                     d.t1x === playerName;

                return isOpponentShot && playerOnField;
            });

            console.log(`On-field filtering for ${this.selectedShooter}:`);
            console.log(`- Total shots in currentGameData: ${this.currentGameData.length}`);

            // Check what teams are in currentGameData
            const allShootingTeams = new Set(this.currentGameData.map(d => d.shooting_team));
            console.log(`- All shooting teams in currentGameData:`, Array.from(allShootingTeams));

            const opponentShots = this.currentGameData.filter(d => d.shooting_team !== team1Name);
            console.log(`- Total opponent shots (shooting_team != ${team1Name}): ${opponentShots.length}`);
            console.log(`- Opponent shots when ${this.selectedShooter} on field: ${onFieldData.length}`);

            // Detailed verification for debugging
            if (this.selectedShooter === '#27 Griezitis') {
                // Run direct SQL queries to check the actual database
                console.log('=== DIRECT DATABASE CHECK ===');

                // Query 1: Total shots in database
                const totalShots = this.db.exec(`SELECT COUNT(*) as count FROM shots`);
                console.log('Total shots in database:', totalShots[0]?.values[0][0]);

                // Query 2: Shots by team
                const shotsByTeam = this.db.exec(`
                    SELECT shooting_team, COUNT(*) as count
                    FROM shots
                    GROUP BY shooting_team
                `);
                console.log('Shots by team:');
                shotsByTeam[0]?.values.forEach(row => {
                    console.log(`  ${row[0]}: ${row[1]} shots`);
                });

                // Query 3: Griezitis on field for opponent shots (matching your SQL)
                const griezitisOpponentShots = this.db.exec(`
                    SELECT COUNT(*) as count
                    FROM shots
                    WHERE team2 = shooting_team
                    AND (t1lw LIKE '%#27 Griezitis%'
                        OR t1c LIKE '%#27 Griezitis%'
                        OR t1rw LIKE '%#27 Griezitis%'
                        OR t1ld LIKE '%#27 Griezitis%'
                        OR t1rd LIKE '%#27 Griezitis%'
                        OR t1g LIKE '%#27 Griezitis%'
                        OR t1x LIKE '%#27 Griezitis%')
                `);
                console.log('Griezitis on field for opponent shots (SQL):', griezitisOpponentShots[0]?.values[0][0]);

                // Query 4: Griezitis on field for Team 1 shots
                const griezitisTeamShots = this.db.exec(`
                    SELECT COUNT(*) as count
                    FROM shots
                    WHERE team1 = shooting_team
                    AND (t1lw LIKE '%#27 Griezitis%'
                        OR t1c LIKE '%#27 Griezitis%'
                        OR t1rw LIKE '%#27 Griezitis%'
                        OR t1ld LIKE '%#27 Griezitis%'
                        OR t1rd LIKE '%#27 Griezitis%'
                        OR t1g LIKE '%#27 Griezitis%'
                        OR t1x LIKE '%#27 Griezitis%')
                `);
                console.log('Griezitis on field for Team 1 shots (SQL):', griezitisTeamShots[0]?.values[0][0]);

                // Query 5: Check team structure
                const teamStructure = this.db.exec(`
                    SELECT DISTINCT team1, team2, shooting_team
                    FROM shots
                    LIMIT 5
                `);
                console.log('Sample team structures:');
                teamStructure[0]?.values.forEach(row => {
                    console.log(`  team1="${row[0]}", team2="${row[1]}", shooting="${row[2]}"`);
                });

                // Now check the JavaScript data
                console.log('=== JAVASCRIPT DATA CHECK ===');
                const sample = this.currentGameData[0];
                console.log('Sample shot:', {
                    team1: sample.team1,
                    team2: sample.team2,
                    shooting_team: sample.shooting_team
                });

                // Check how many shots have team2 defined
                const shotsWithTeam2 = this.currentGameData.filter(d => d.team2).length;
                console.log(`Shots with team2 defined: ${shotsWithTeam2} of ${this.currentGameData.length}`);

                // Get all unique shooting teams
                const shootingTeams = new Set(this.currentGameData.map(d => d.shooting_team));
                console.log('All shooting teams:', Array.from(shootingTeams));

                const totalOpponentShots = this.currentGameData.filter(d => d.shooting_team !== team1Name).length;
                const playerPositions = ['t1lw', 't1c', 't1rw', 't1ld', 't1rd', 't1g', 't1x'];

                // Count OPPONENT shots where Griezitis appears in each position
                const opponentShotsPerPosition = {};
                playerPositions.forEach(pos => {
                    const count = this.currentGameData.filter(d =>
                        d.shooting_team !== team1Name && d[pos] === '#27 Griezitis'
                    ).length;
                    if (count > 0) opponentShotsPerPosition[pos] = count;
                });

                // Check for duplicate counting - is he in multiple positions for same shot?
                const shotsWithMultiplePositions = onFieldData.filter(shot => {
                    let count = 0;
                    playerPositions.forEach(pos => {
                        if (shot[pos] === '#27 Griezitis') count++;
                    });
                    return count > 1;
                });

                console.log(`VERIFICATION for #27 Griezitis:`);
                console.log(`- Team 1 name: ${team1Name}`);
                console.log(`- Team 2 name: ${team2Name}`);
                console.log(`- Total shots in dataset: ${this.currentGameData.length}`);

                // Check different filtering approaches
                const method1 = this.currentGameData.filter(d =>
                    d.team2 === d.shooting_team &&
                    (d.t1lw === '#27 Griezitis' || d.t1c === '#27 Griezitis' ||
                     d.t1rw === '#27 Griezitis' || d.t1ld === '#27 Griezitis' ||
                     d.t1rd === '#27 Griezitis' || d.t1g === '#27 Griezitis' ||
                     d.t1x === '#27 Griezitis')
                ).length;

                const method2 = this.currentGameData.filter(d =>
                    d.shooting_team !== d.team1 &&
                    (d.t1lw === '#27 Griezitis' || d.t1c === '#27 Griezitis' ||
                     d.t1rw === '#27 Griezitis' || d.t1ld === '#27 Griezitis' ||
                     d.t1rd === '#27 Griezitis' || d.t1g === '#27 Griezitis' ||
                     d.t1x === '#27 Griezitis')
                ).length;

                // Check what teams exist in the data
                const uniqueTeamCombos = new Set();
                this.currentGameData.forEach(d => {
                    uniqueTeamCombos.add(`team1=${d.team1}, team2=${d.team2}, shooting=${d.shooting_team}`);
                });

                console.log(`- Method 1 (team2 = shooting_team): ${method1}`);
                console.log(`- Method 2 (shooting_team != team1): ${method2}`);
                console.log(`- Current filter result: ${onFieldData.length}`);
                console.log(`- Unique team combinations (first 5):`);
                Array.from(uniqueTeamCombos).slice(0, 5).forEach(combo => console.log(`    ${combo}`));
                console.log(`- Opponent shots by position where Griezitis appears:`, opponentShotsPerPosition);
                console.log(`- Shots where Griezitis in MULTIPLE positions: ${shotsWithMultiplePositions.length}`);

                // SQL equivalent check
                const sqlLikeCount = this.currentGameData.filter(d =>
                    d.shooting_team !== team1Name &&
                    (d.t1lw === '#27 Griezitis' || d.t1c === '#27 Griezitis' ||
                     d.t1rw === '#27 Griezitis' || d.t1ld === '#27 Griezitis' ||
                     d.t1rd === '#27 Griezitis' || d.t1g === '#27 Griezitis' ||
                     d.t1x === '#27 Griezitis')
                ).length;
                console.log(`- Count using SQL-like logic: ${sqlLikeCount}`);
                console.log(`- Count from filter (onFieldData): ${onFieldData.length}`);

                // Show actual team names to verify
                const teams = new Set(this.currentGameData.map(d => d.shooting_team));
                console.log(`- All teams in dataset:`, Array.from(teams));
            }
        }
        await this.createShotMap(data, onFieldData);
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

    async createShotMap(data, onFieldData = null) {
        console.log('Creating shot map...');
        await debugLog('Creating shot map', { dataLength: data.length, hasOnFieldData: !!onFieldData });

        // Initialize comprehensive hexbin tracking system
        if (!window.hexbinTracking) {
            window.hexbinTracking = {
                allShooters: null,
                selectedShooter: null,
                comparisons: []
            };
        }

        // Store hexbin debug data globally for comparison
        if (!window.hexbinDebugData) {
            window.hexbinDebugData = {};
        }

        const container = d3.select('#shot-map-chart');
        container.selectAll('*').remove();

        // Filter out Possession shots from main data
        const filteredData = data.filter(shot => {
            const result = shot.result || '';
            return !result.toLowerCase().includes('possession');
        });

        // Filter out Possession shots from onField data if it exists
        const filteredOnFieldData = onFieldData ? onFieldData.filter(shot => {
            const result = shot.result || '';
            return !result.toLowerCase().includes('possession');
        }) : null;

        console.log(`Filtered shots: ${filteredData.length} (excluded ${data.length - filteredData.length} possession shots)`);
        if (filteredOnFieldData) {
            console.log(`Filtered on-field shots: ${filteredOnFieldData.length}`);
        }
        await debugLog('Shot map filter', {
            total: data.length,
            filtered: filteredData.length,
            excluded: data.length - filteredData.length,
            onFieldTotal: onFieldData ? onFieldData.length : 0
        });

        // Calculate grid cell dimensions based on dashboard-main area
        const dashboardMain = document.querySelector('.dashboard-main');
        const dashboardRect = dashboardMain.getBoundingClientRect();
        const cellWidth = dashboardRect.width / 15;
        const cellHeight = dashboardRect.height / 10;

        // Map should span 8 cells vertically (A1 to H1), width calculated for 1:2 aspect ratio
        // Original field dimensions: 600x1200 (1:2 aspect ratio)
        // Increase by 1/7 to fill 8 cells properly (was 7, now 8)
        const fieldHeight = (cellHeight * 8) * (8/7); // 8 rows tall, increased by 1/7
        const fieldWidth = fieldHeight / 2; // Maintain 1:2 aspect ratio (half the height)

        // Total SVG width includes field + legend space
        const legendWidth = cellWidth * 2; // 2 columns for legend
        const totalSVGWidth = dashboardRect.width;
        const totalSVGHeight = dashboardRect.height;

        const margin = {top: 10, right: 10, bottom: 10, left: 10};

        const svg = container
            .append('svg')
            .attr('width', totalSVGWidth)
            .attr('height', totalSVGHeight)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0');

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

        // Calculate scale factor for coordinates (original field: 600x1200)
        const scaleX = fieldWidth / 600;
        const scaleY = fieldHeight / 1200;

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
                // Team 1 shoots as-is, scaled to new dimensions
                visualX = parseFloat(shot.x_graph) * scaleX;
                visualY = parseFloat(shot.y_graph) * scaleY;
            } else {
                // Team 2 shoots flipped, scaled to new dimensions
                visualX = (600 - parseFloat(shot.x_graph)) * scaleX;
                visualY = (1200 - parseFloat(shot.y_graph)) * scaleY;
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

        // If onFieldData exists, we need to process it and create separate hexbins
        let onFieldShotsWithCoords = null;
        if (filteredOnFieldData) {
            onFieldShotsWithCoords = filteredOnFieldData.filter(shot => {
                const x = parseFloat(shot.x_graph);
                const y = parseFloat(shot.y_graph);
                return !isNaN(x) && !isNaN(y) && x >= 0 && y >= 0;
            }).map(shot => {
                const team1 = shot.team1;
                const shootingTeam = shot.shooting_team;
                const isTeam1 = shootingTeam === team1;

                let visualX, visualY;

                if (isTeam1) {
                    visualX = parseFloat(shot.x_graph) * scaleX;
                    visualY = parseFloat(shot.y_graph) * scaleY;
                } else {
                    visualX = (600 - parseFloat(shot.x_graph)) * scaleX;
                    visualY = (1200 - parseFloat(shot.y_graph)) * scaleY;
                }

                return {
                    ...shot,
                    visualX: visualX,
                    visualY: visualY,
                    isTeam1: isTeam1
                };
            });
            console.log(`On-field shots with coords: ${onFieldShotsWithCoords.length}`);
        }

        // Create hexbin heatmap layer with clipping to prevent overflow
        const heatmapGroup = g.append('g')
            .attr('class', 'heatmap-layer');

        if (onFieldShotsWithCoords) {
            // When shooter is selected: show same hexbins but in split view
            // Upper half: shooter's shots at ORIGINAL positions scaled to half size
            // Lower half: on-field shots at ORIGINAL positions scaled to half size

            // Create TWO separate SVG transforms to show the field twice at half scale
            const upperGroup = heatmapGroup.append('g')
                .attr('class', 'heatmap-upper')
                .attr('clip-path', 'url(#upper-clip-path)');

            const lowerGroup = heatmapGroup.append('g')
                .attr('class', 'heatmap-lower')
                .attr('clip-path', 'url(#lower-clip-path)');

            // Create clipping paths for upper and lower halves
            svg.select('defs').append('clipPath')
                .attr('id', 'upper-clip-path')
                .append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', fieldWidth)
                .attr('height', fieldHeight / 2);

            svg.select('defs').append('clipPath')
                .attr('id', 'lower-clip-path')
                .append('rect')
                .attr('x', 0)
                .attr('y', fieldHeight / 2)
                .attr('width', fieldWidth)
                .attr('height', fieldHeight / 2);

            console.log(`Creating split hexbins:`);
            console.log(`- Upper (shooter's shots): ${shotsWithCoords.length}`);
            console.log(`- Lower (on-field shots): ${onFieldShotsWithCoords.length}`);

            if (shotsWithCoords.length > 0) {
                console.log('Drawing shooter hexbins in upper half...');
                // Use original coordinates but display in upper half
                this.createHexbinHeatmap(upperGroup, shotsWithCoords, fieldWidth, fieldHeight);
            }
            if (onFieldShotsWithCoords.length > 0) {
                console.log('Drawing on-field hexbins in lower half...');
                // Use original coordinates but display in lower half
                this.createHexbinHeatmap(lowerGroup, onFieldShotsWithCoords, fieldWidth, fieldHeight);
            }
        } else {
            // Normal mode: show all shots with field clipping
            heatmapGroup.attr('clip-path', 'url(#field-clip)');
            if (shotsWithCoords.length > 0) {
                this.createHexbinHeatmap(heatmapGroup, shotsWithCoords, fieldWidth, fieldHeight);
            }
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
            .attr('transform', `translate(${margin.left + width + 20}, ${margin.top + 250})`);

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
            .attr('transform', (d, i) => `translate(0, ${i * 25})`);

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
            .style('font-size', '12px')
            .style('fill', '#E5E5E7');
    }

    createSplitViewHexbins(group, shotsWithCoords, fieldWidth, fieldHeight, position) {
        // Create hexbins for split view (upper or lower half)
        console.log(`createSplitViewHexbins: ${position} with ${shotsWithCoords.length} shots`);

        if (!d3.hexbin) {
            console.warn('d3-hexbin not available');
            return;
        }

        // For split view, we need to:
        // 1. Remap Y coordinates to compress into half the space
        // 2. Adjust hexbin radius for the compressed space
        // 3. Maintain aspect ratio of hexagons

        const halfHeight = fieldHeight / 2;

        // Remap shot coordinates based on position
        // IMPORTANT: We want to map the ACTUAL range of shots to the full half, not compress the entire field
        const remappedShots = shotsWithCoords.map(shot => {
            let newY;
            if (position === 'upper') {
                // For upper half: scale Y linearly to fit 0 to halfHeight
                // This keeps the relative positions but scales to fill the space
                newY = (shot.visualY / fieldHeight) * halfHeight;
            } else {
                // For lower half: scale Y and shift to lower half
                newY = ((shot.visualY / fieldHeight) * halfHeight) + halfHeight;
            }

            return {
                ...shot,
                remappedY: newY,
                originalY: shot.visualY // Keep original for debugging
            };
        });

        // Log sample coordinates for debugging
        if (remappedShots.length > 0) {
            console.log(`${position} shots coordinate sample:`, {
                first: {
                    x: remappedShots[0].visualX.toFixed(1),
                    originalY: remappedShots[0].originalY.toFixed(1),
                    remappedY: remappedShots[0].remappedY.toFixed(1),
                    shooter: remappedShots[0].shooter
                },
                fieldHeight: fieldHeight,
                halfHeight: halfHeight
            });
        }

        // Create hexbin with adjusted parameters for compressed space
        const scaleFactor = fieldWidth / 600;
        // Use smaller radius for compressed view
        const baseRadius = 20; // Smaller than normal 28
        const hexbin = d3.hexbin()
            .x(d => d.visualX)
            .y(d => d.remappedY)
            .radius(baseRadius * scaleFactor)
            .extent([[0, position === 'upper' ? 0 : halfHeight],
                     [fieldWidth, position === 'upper' ? halfHeight : fieldHeight]]);

        // Generate hexbin data
        const hexData = hexbin(remappedShots).map(bin => {
            const goals = bin.filter(d => d.result === 'Goal').length;
            const total = bin.length;
            const successRate = total > 0 ? goals / total : 0;

            // Calculate xG range for this hexbin
            const xgValues = bin.map(d => parseFloat(d.xg)).filter(xg => !isNaN(xg));
            const avgXG = xgValues.length > 0 ? d3.mean(xgValues) : 0;
            const minXG = xgValues.length > 0 ? d3.min(xgValues) : 0;
            const maxXG = xgValues.length > 0 ? d3.max(xgValues) : 0;

            return {
                ...bin,
                goals: goals,
                total: total,
                successRate: successRate,
                avgXG: avgXG,
                minXG: minXG,
                maxXG: maxXG
            };
        });

        // Filter out empty bins
        const filteredHexData = hexData.filter(d => d.total >= 1);

        // Calculate league average
        const leagueAverage = remappedShots.filter(d => d.result === 'Goal').length / remappedShots.length;

        // Color scale
        const colorScale = d3.scaleLinear()
            .domain([0, leagueAverage * 0.8, leagueAverage, leagueAverage * 1.2, 0.6])
            .range(['#7C3AED', '#00D9FF', '#00D9FF', '#10B981', '#10B981'])
            .clamp(true);

        // Size scale
        const sizeScale = d3.scalePow()
            .exponent(0.8)
            .domain([0, d3.max(filteredHexData, d => d.total) || 1])
            .range([0.4, 1.0]); // Smaller range for split view

        // Tooltip
        const tooltip = d3.select('body').select('.heatmap-tooltip').empty()
            ? d3.select('body').append('div').attr('class', 'heatmap-tooltip tooltip').style('opacity', 0)
            : d3.select('body').select('.heatmap-tooltip');

        // Store hexbin data for debugging - fixed to not break on d.map
        const hexbinDebugKey = `${position}_${this.selectedShooter || 'all'}`;
        window.hexbinDebugData[hexbinDebugKey] = {
            position: position,
            shooter: this.selectedShooter || 'all',
            radius: baseRadius * scaleFactor,
            hexbins: filteredHexData.map(d => ({
                x: d.x,
                y: d.y,
                total: d.total,
                goals: d.goals,
                scale: sizeScale(d.total)
                // Removed the faulty d.map() call
            }))
        };

        console.log(`Stored hexbin debug data for ${hexbinDebugKey}:`, {
            numHexbins: filteredHexData.length,
            radius: baseRadius * scaleFactor,
            firstHexbin: filteredHexData[0] ? {
                x: filteredHexData[0].x.toFixed(1),
                y: filteredHexData[0].y.toFixed(1),
                total: filteredHexData[0].total
            } : null
        });

        // Draw hexagons
        const hexagons = group.selectAll('.hexagon')
            .data(filteredHexData)
            .enter().append('g')
            .attr('class', 'hexagon-group')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        hexagons.append('path')
            .attr('class', 'hexagon')
            .attr('d', hexbin.hexagon())
            .attr('transform', d => `scale(${sizeScale(d.total)})`)
            .attr('data-min-xg', d => d.minXG)
            .attr('data-max-xg', d => d.maxXG)
            .attr('data-avg-xg', d => d.avgXG)
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
                tooltip.html(`
                    <strong>${position === 'upper' ? 'Shooter' : 'On-field'} Zone</strong><br/>
                    Shots: ${d.total}<br/>
                    Goals: ${d.goals}<br/>
                    Success Rate: ${percentage}%
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

        console.log(`Created ${hexagons.size()} hexagons for ${position} half`);

        // Quick debug output
        if (filteredHexData.length > 0) {
            const sample = filteredHexData[0];
            console.log(`${position} HEXBIN DEBUG: First hexbin at (${sample.x.toFixed(1)}, ${sample.y.toFixed(1)}), fieldHeight=${fieldHeight.toFixed(1)}, halfHeight=${halfHeight.toFixed(1)}`);

            const yValues = filteredHexData.map(h => h.y);
            console.log(`${position} Y-RANGE: ${Math.min(...yValues).toFixed(1)} to ${Math.max(...yValues).toFixed(1)}`);
        }

        // After creating hexbins for a selected shooter, compare with all shooters data
        if (this.selectedShooter && window.hexbinDebugData['all_shooters_none']) {
            this.compareHexbinData();
        }
    }

    async compareHexbinData() {
        const allShootersData = window.hexbinDebugData['all_shooters_none'];
        const selectedUpperData = window.hexbinDebugData[`upper_${this.selectedShooter}`];
        const selectedLowerData = window.hexbinDebugData[`lower_${this.selectedShooter}`];

        if (!allShootersData || !selectedUpperData) {
            await debugLog('Hexbin comparison - missing data', {
                hasAllShooters: !!allShootersData,
                hasSelectedUpper: !!selectedUpperData
            });
            return;
        }

        const logData = {
            timestamp: new Date().toISOString(),
            selectedShooter: this.selectedShooter,
            allShootersMode: {
                numHexbins: allShootersData.hexbins.length,
                radius: allShootersData.radius,
                fieldWidth: allShootersData.fieldWidth,
                fieldHeight: allShootersData.fieldHeight,
                hexbins: allShootersData.hexbins.slice(0, 10).map(h => ({
                    x: h.x,
                    y: h.y,
                    total: h.total,
                    goals: h.goals,
                    scale: h.scale
                }))
            },
            selectedUpperMode: {
                numHexbins: selectedUpperData.hexbins.length,
                radius: selectedUpperData.radius,
                position: selectedUpperData.position,
                hexbins: selectedUpperData.hexbins.slice(0, 10).map(h => ({
                    x: h.x,
                    y: h.y,
                    total: h.total,
                    goals: h.goals,
                    scale: h.scale
                }))
            }
        };

        // Add lower data if available
        if (selectedLowerData) {
            logData.selectedLowerMode = {
                numHexbins: selectedLowerData.hexbins.length,
                radius: selectedLowerData.radius,
                position: selectedLowerData.position,
                hexbins: selectedLowerData.hexbins.slice(0, 10).map(h => ({
                    x: h.x,
                    y: h.y,
                    total: h.total,
                    goals: h.goals,
                    scale: h.scale
                }))
            };
        }

        // Calculate Y ranges
        const allYValues = allShootersData.hexbins.map(h => h.y);
        const upperYValues = selectedUpperData.hexbins.map(h => h.y);

        logData.yAxisAnalysis = {
            allShooters: {
                min: Math.min(...allYValues),
                max: Math.max(...allYValues),
                range: Math.max(...allYValues) - Math.min(...allYValues)
            },
            upperHalf: {
                min: Math.min(...upperYValues),
                max: Math.max(...upperYValues),
                range: Math.max(...upperYValues) - Math.min(...upperYValues),
                expectedMax: allShootersData.fieldHeight / 2
            }
        };

        if (selectedLowerData && selectedLowerData.hexbins.length > 0) {
            const lowerYValues = selectedLowerData.hexbins.map(h => h.y);
            logData.yAxisAnalysis.lowerHalf = {
                min: Math.min(...lowerYValues),
                max: Math.max(...lowerYValues),
                range: Math.max(...lowerYValues) - Math.min(...lowerYValues),
                expectedMin: allShootersData.fieldHeight / 2,
                expectedMax: allShootersData.fieldHeight
            };
        }

        // Write to log file
        try {
            const response = await fetch('/api/debug-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'HEXBIN_COMPARISON',
                    data: logData
                })
            });

            if (response.ok) {
                console.log('Hexbin comparison data written to log file');

                // Also write a detailed analysis file
                await this.writeHexbinAnalysisFile(logData);
            }
        } catch (error) {
            console.error('Failed to write hexbin log:', error);
        }
    }

    compareHexbinPositions() {
        if (!window.hexbinTracking.allShooters || !window.hexbinTracking.selectedShooter) {
            console.log('Missing tracking data for comparison');
            return;
        }

        const allShooters = window.hexbinTracking.allShooters;
        const selected = window.hexbinTracking.selectedShooter;

        console.log('=' .repeat(80));
        console.log('HEXBIN POSITION TRACKING BY SHOT ID');
        console.log('=' .repeat(80));

        // Also write to debug log
        debugLog('HEXBIN_POSITION_TRACKING', {
            mode: 'comparison_start',
            allShootersCount: allShooters.hexbins.length,
            selectedCount: selected.hexbins.length
        });

        // Build a map of shot ID to hexbin position for all shooters mode
        const allShootersMap = new Map();
        allShooters.hexbins.forEach(hexbin => {
            if (hexbin.shotIds) {
                hexbin.shotIds.forEach(shot => {
                    allShootersMap.set(shot.id, {
                        hexbinX: hexbin.x,
                        hexbinY: hexbin.y,
                        hexbinScale: hexbin.scale,
                        shotX: shot.visualX,
                        shotY: shot.visualY
                    });
                });
            }
        });

        // Build a map for selected shooter mode
        const selectedMap = new Map();
        selected.hexbins.forEach(hexbin => {
            if (hexbin.shotIds) {
                hexbin.shotIds.forEach(shot => {
                    selectedMap.set(shot.id, {
                        hexbinX: hexbin.x,
                        hexbinY: hexbin.y,
                        hexbinScale: hexbin.scale,
                        shotX: shot.visualX,
                        shotY: shot.visualY
                    });
                });
            }
        });

        // Find common shot IDs
        const commonShotIds = [];
        allShootersMap.forEach((value, key) => {
            if (selectedMap.has(key)) {
                commonShotIds.push(key);
            }
        });

        console.log(`Found ${commonShotIds.length} common shots between modes`);

        // Compare positions for common shots
        const discrepancies = [];
        const comparisonDetails = [];

        commonShotIds.slice(0, 10).forEach(shotId => {
            const allPos = allShootersMap.get(shotId);
            const selPos = selectedMap.get(shotId);

            const deltaX = Math.abs(allPos.hexbinX - selPos.hexbinX);
            const deltaY = Math.abs(allPos.hexbinY - selPos.hexbinY);
            const scaleRatio = allPos.hexbinScale / selPos.hexbinScale;

            const comparison = {
                shotId: shotId.substring(0, 50),
                allShooters: {
                    hexbinX: allPos.hexbinX,
                    hexbinY: allPos.hexbinY,
                    scale: allPos.hexbinScale
                },
                selected: {
                    hexbinX: selPos.hexbinX,
                    hexbinY: selPos.hexbinY,
                    scale: selPos.hexbinScale
                },
                deltaX: deltaX,
                deltaY: deltaY,
                scaleRatio: scaleRatio
            };

            comparisonDetails.push(comparison);

            if (deltaX > 0.1 || deltaY > 0.1) {
                discrepancies.push({
                    shotId: shotId,
                    allShooters: allPos,
                    selected: selPos,
                    deltaX: deltaX,
                    deltaY: deltaY,
                    scaleRatio: scaleRatio
                });
            }

            console.log(`Shot ${shotId.substring(0, 30)}...`);
            console.log(`  All Shooters: Hexbin (${allPos.hexbinX.toFixed(1)}, ${allPos.hexbinY.toFixed(1)}), Scale: ${allPos.hexbinScale.toFixed(2)}`);
            console.log(`  Selected:     Hexbin (${selPos.hexbinX.toFixed(1)}, ${selPos.hexbinY.toFixed(1)}), Scale: ${selPos.hexbinScale.toFixed(2)}`);
            console.log(`  Delta:        X: ${deltaX.toFixed(1)}, Y: ${deltaY.toFixed(1)}, Scale Ratio: ${scaleRatio.toFixed(2)}`);
        });

        // Write comparison details to log
        debugLog('HEXBIN_COMPARISON_DETAILS', {
            totalCommonShots: commonShotIds.length,
            samplesCompared: comparisonDetails.length,
            comparisons: comparisonDetails,
            discrepancyCount: discrepancies.length
        });

        if (discrepancies.length > 0) {
            console.log('\nDISCREPANCIES FOUND:');
            console.log(`${discrepancies.length} shots have different hexbin positions`);

            // Calculate average discrepancy
            const avgDeltaX = discrepancies.reduce((sum, d) => sum + d.deltaX, 0) / discrepancies.length;
            const avgDeltaY = discrepancies.reduce((sum, d) => sum + d.deltaY, 0) / discrepancies.length;
            console.log(`Average position difference: X: ${avgDeltaX.toFixed(1)}, Y: ${avgDeltaY.toFixed(1)}`);
        }

        // Write detailed log to file
        this.writeHexbinTrackingLog({
            allShooters: allShooters,
            selected: selected,
            commonShotIds: commonShotIds.slice(0, 20),
            discrepancies: discrepancies,
            analysis: {
                totalCommonShots: commonShotIds.length,
                totalDiscrepancies: discrepancies.length,
                averageDeltaX: discrepancies.length > 0 ?
                    discrepancies.reduce((sum, d) => sum + d.deltaX, 0) / discrepancies.length : 0,
                averageDeltaY: discrepancies.length > 0 ?
                    discrepancies.reduce((sum, d) => sum + d.deltaY, 0) / discrepancies.length : 0
            }
        });

        console.log('=' .repeat(80));
    }

    async writeHexbinTrackingLog(data) {
        const logContent = {
            timestamp: new Date().toISOString(),
            type: 'HEXBIN_SHOT_TRACKING',
            shooter: this.selectedShooter,
            allShootersMode: {
                numHexbins: data.allShooters.hexbins.length,
                radius: data.allShooters.radius,
                fieldDimensions: `${data.allShooters.fieldWidth} x ${data.allShooters.fieldHeight}`
            },
            selectedMode: {
                numHexbins: data.selected.hexbins.length,
                radius: data.selected.radius,
                fieldDimensions: `${data.selected.fieldWidth} x ${data.selected.fieldHeight}`
            },
            analysis: data.analysis,
            sampleDiscrepancies: data.discrepancies.slice(0, 5).map(d => ({
                shotId: d.shotId.substring(0, 50),
                allShootersPos: `(${d.allShooters.hexbinX.toFixed(1)}, ${d.allShooters.hexbinY.toFixed(1)})`,
                selectedPos: `(${d.selected.hexbinX.toFixed(1)}, ${d.selected.hexbinY.toFixed(1)})`,
                delta: `X: ${d.deltaX.toFixed(1)}, Y: ${d.deltaY.toFixed(1)}`,
                scaleRatio: d.scaleRatio.toFixed(2)
            }))
        };

        try {
            await fetch('/api/debug-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logContent)
            });
            console.log('Hexbin tracking log written to file');
        } catch (error) {
            console.error('Failed to write tracking log:', error);
        }
    }

    async writeHexbinAnalysisFile(logData) {
        const analysis = [];

        analysis.push('='.repeat(80));
        analysis.push('HEXBIN COMPARISON ANALYSIS');
        analysis.push(`Time: ${logData.timestamp}`);
        analysis.push(`Selected Shooter: ${logData.selectedShooter}`);
        analysis.push('='.repeat(80));
        analysis.push('');

        analysis.push('ALL SHOOTERS MODE:');
        analysis.push(`  Field: ${logData.allShootersMode.fieldWidth.toFixed(0)} x ${logData.allShootersMode.fieldHeight.toFixed(0)}`);
        analysis.push(`  Hexbin Radius: ${logData.allShootersMode.radius.toFixed(2)}`);
        analysis.push(`  Total Hexbins: ${logData.allShootersMode.numHexbins}`);
        analysis.push(`  Y-Axis Range: ${logData.yAxisAnalysis.allShooters.min.toFixed(1)} to ${logData.yAxisAnalysis.allShooters.max.toFixed(1)}`);
        analysis.push('');

        analysis.push('SELECTED SHOOTER - UPPER HALF:');
        analysis.push(`  Expected Y Range: 0 to ${logData.yAxisAnalysis.upperHalf.expectedMax.toFixed(1)}`);
        analysis.push(`  Actual Y Range: ${logData.yAxisAnalysis.upperHalf.min.toFixed(1)} to ${logData.yAxisAnalysis.upperHalf.max.toFixed(1)}`);
        analysis.push(`  Hexbin Radius: ${logData.selectedUpperMode.radius.toFixed(2)}`);
        analysis.push(`  Total Hexbins: ${logData.selectedUpperMode.numHexbins}`);
        analysis.push('');

        if (logData.selectedLowerMode) {
            analysis.push('SELECTED SHOOTER - LOWER HALF:');
            analysis.push(`  Expected Y Range: ${logData.yAxisAnalysis.lowerHalf.expectedMin.toFixed(1)} to ${logData.yAxisAnalysis.lowerHalf.expectedMax.toFixed(1)}`);
            analysis.push(`  Actual Y Range: ${logData.yAxisAnalysis.lowerHalf.min.toFixed(1)} to ${logData.yAxisAnalysis.lowerHalf.max.toFixed(1)}`);
            analysis.push(`  Hexbin Radius: ${logData.selectedLowerMode.radius.toFixed(2)}`);
            analysis.push(`  Total Hexbins: ${logData.selectedLowerMode.numHexbins}`);
            analysis.push('');
        }

        analysis.push('FIRST 5 HEXBINS COMPARISON:');
        analysis.push('-'.repeat(40));
        analysis.push('All Shooters Mode:');
        logData.allShootersMode.hexbins.slice(0, 5).forEach((h, i) => {
            analysis.push(`  ${i+1}. Pos: (${h.x.toFixed(1)}, ${h.y.toFixed(1)}), Total: ${h.total}, Scale: ${h.scale.toFixed(2)}`);
        });
        analysis.push('');

        analysis.push('Selected Upper Half:');
        logData.selectedUpperMode.hexbins.slice(0, 5).forEach((h, i) => {
            analysis.push(`  ${i+1}. Pos: (${h.x.toFixed(1)}, ${h.y.toFixed(1)}), Total: ${h.total}, Scale: ${h.scale.toFixed(2)}`);
        });

        if (logData.selectedLowerMode) {
            analysis.push('');
            analysis.push('Selected Lower Half:');
            logData.selectedLowerMode.hexbins.slice(0, 5).forEach((h, i) => {
                analysis.push(`  ${i+1}. Pos: (${h.x.toFixed(1)}, ${h.y.toFixed(1)}), Total: ${h.total}, Scale: ${h.scale.toFixed(2)}`);
            });
        }

        analysis.push('');
        analysis.push('='.repeat(80));

        // Send analysis as a separate log entry
        await fetch('/api/debug-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'HEXBIN_ANALYSIS',
                message: analysis.join('\n')
            })
        });
    }

    createSplitHexbinHeatmap(group, shotsWithCoords, width, height, yOffset) {
        // Special version for split view - shots already have remapped coordinates
        console.log(`createSplitHexbinHeatmap: ${shotsWithCoords.length} shots, yOffset=${yOffset}`);

        if (!d3.hexbin) {
            console.warn('d3-hexbin not available, skipping');
            return;
        }

        try {
            // Create hexbin generator with proper extent for this half
            const scaleFactor = width / 600;
            const hexbin = d3.hexbin()
                .x(d => d.visualX)
                .y(d => d.visualY)
                .radius(20 * scaleFactor)  // Smaller radius for split view
                .extent([[0, yOffset], [width, yOffset + height]]);

            // Calculate success rate for each hexbin and track shot IDs
            const hexData = hexbin(shotsWithCoords).map(bin => {
                const goals = bin.filter(d => d.result === 'Goal').length;
                const total = bin.length;
                const successRate = total > 0 ? goals / total : 0;

                // Calculate average xG for this hexbin
                const xgValues = bin.map(d => parseFloat(d.xg)).filter(xg => !isNaN(xg));
                const avgXG = xgValues.length > 0 ? d3.mean(xgValues) : 0;
                const minXG = xgValues.length > 0 ? d3.min(xgValues) : 0;
                const maxXG = xgValues.length > 0 ? d3.max(xgValues) : 0;

                // Extract shot IDs for tracking
                const shotIds = bin.map(shot => ({
                    id: shot.id || `${shot.shooter}_${shot.x_graph}_${shot.y_graph}`, // Create unique ID
                    shooter: shot.shooter,
                    originalX: shot.x_graph,
                    originalY: shot.y_graph,
                    visualX: shot.visualX,
                    visualY: shot.visualY,
                    xg: parseFloat(shot.xg)
                }));

                return {
                    ...bin,
                    goals: goals,
                    total: total,
                    successRate: successRate,
                    shotIds: shotIds,
                    avgXG: avgXG,
                    minXG: minXG,
                    maxXG: maxXG
                };
            });

            // Filter out hexagons with very few shots
            const filteredHexData = hexData.filter(d => d.total >= 1);

            // Get league average for comparison
            const leagueAverage = shotsWithCoords.filter(d => d.result === 'Goal').length / shotsWithCoords.length;

            // Create color scale
            const colorScale = d3.scaleLinear()
                .domain([0, leagueAverage * 0.8, leagueAverage, leagueAverage * 1.2, 0.6])
                .range(['#7C3AED', '#00D9FF', '#00D9FF', '#10B981', '#10B981'])
                .clamp(true);

            // Size scale based on number of shots
            const sizeScale = d3.scalePow()
                .exponent(0.8)
                .domain([0, d3.max(filteredHexData, d => d.total)])
                .range([0.3, 1.2]);

            // Create tooltip
            const tooltip = d3.select('body').select('.heatmap-tooltip').empty()
                ? d3.select('body').append('div').attr('class', 'heatmap-tooltip tooltip').style('opacity', 0)
                : d3.select('body').select('.heatmap-tooltip');

            // Draw hexagons
            const hexagons = group.selectAll('.hexagon')
                .data(filteredHexData)
                .enter().append('g')
                .attr('class', 'hexagon-group')
                .attr('transform', d => `translate(${d.x},${d.y})`);

            hexagons.append('path')
                .attr('class', 'hexagon')
                .attr('d', hexbin.hexagon())
                .attr('transform', d => {
                    const scale = sizeScale(d.total);
                    return `scale(${scale})`;
                })
                .attr('data-min-xg', d => d.minXG)
                .attr('data-max-xg', d => d.maxXG)
                .attr('data-avg-xg', d => d.avgXG)
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

            console.log(`Created ${hexagons.size()} hexagons in split view`);

        } catch (error) {
            console.error('Error creating split hexbin heatmap:', error);
        }
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
            // Create hexbin generator scaled proportionally to field size
            // Original radius was 28 for 600x1200 field
            const scaleFactor = width / 600;
            const hexbin = d3.hexbin()
                .x(d => d.visualX)
                .y(d => d.visualY)
                .radius(28 * scaleFactor)
                .extent([[0, 0], [width, height]]);

            heatmapLog.push('Hexbin generator created successfully');

            // Calculate success rate for each hexbin and track shot IDs
            const hexData = hexbin(shotsWithCoords).map(bin => {
                const goals = bin.filter(d => d.result === 'Goal').length;
                const total = bin.length;
                const successRate = total > 0 ? goals / total : 0;

                // Calculate average xG for this hexbin
                const xgValues = bin.map(d => parseFloat(d.xg)).filter(xg => !isNaN(xg));
                const avgXG = xgValues.length > 0 ? d3.mean(xgValues) : 0;
                const minXG = xgValues.length > 0 ? d3.min(xgValues) : 0;
                const maxXG = xgValues.length > 0 ? d3.max(xgValues) : 0;

                // Extract shot IDs for tracking
                const shotIds = bin.map(shot => ({
                    id: shot.id || `${shot.shooter}_${shot.x_graph}_${shot.y_graph}`, // Create unique ID
                    shooter: shot.shooter,
                    originalX: shot.x_graph,
                    originalY: shot.y_graph,
                    visualX: shot.visualX,
                    visualY: shot.visualY,
                    xg: parseFloat(shot.xg)
                }));

                return {
                    ...bin,
                    goals: goals,
                    total: total,
                    successRate: successRate,
                    shotIds: shotIds,
                    avgXG: avgXG,
                    minXG: minXG,
                    maxXG: maxXG
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

            // Store comprehensive hexbin tracking data
            const isAllShootersMode = !this.selectedShooter;
            const trackingData = {
                mode: isAllShootersMode ? 'all_shooters' : 'selected_shooter',
                shooter: this.selectedShooter || 'none',
                timestamp: new Date().toISOString(),
                radius: 28 * scaleFactor,
                fieldWidth: width,
                fieldHeight: height,
                hexbins: filteredHexData.map(d => ({
                    x: d.x,
                    y: d.y,
                    total: d.total,
                    goals: d.goals,
                    scale: sizeScale(d.total),
                    shotIds: d.shotIds // Include shot tracking
                }))
            };

            // Store for comparison
            if (isAllShootersMode) {
                window.hexbinTracking.allShooters = trackingData;
            } else {
                window.hexbinTracking.selectedShooter = trackingData;
                // Perform comparison after storing
                this.compareHexbinPositions();
            }

            // Also store in the old debug system for compatibility
            const hexbinDebugKey = `all_shooters_${this.selectedShooter || 'none'}`;
            window.hexbinDebugData[hexbinDebugKey] = {
                mode: 'all_shooters',
                shooter: this.selectedShooter || 'none',
                radius: 28 * scaleFactor,
                fieldWidth: width,
                fieldHeight: height,
                hexbins: filteredHexData.map(d => ({
                    x: d.x,
                    y: d.y,
                    total: d.total,
                    goals: d.goals,
                    scale: sizeScale(d.total)
                }))
            };

            console.log(`Stored hexbin debug data for ${hexbinDebugKey}:`, {
                numHexbins: filteredHexData.length,
                radius: 28 * scaleFactor,
                fieldDimensions: `${width} x ${height}`,
                firstThreeHexbins: filteredHexData.slice(0, 3).map(h => ({
                    x: h.x.toFixed(1),
                    y: h.y.toFixed(1),
                    total: h.total
                }))
            });

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
                .attr('data-min-xg', d => d.minXG)
                .attr('data-max-xg', d => d.maxXG)
                .attr('data-avg-xg', d => d.avgXG)
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

    highlightHexbinsByXGRange(xgMin, xgMax, teamClass) {
        console.log(`Highlighting hexbins with xG range ${xgMin.toFixed(2)}-${xgMax.toFixed(2)} for ${teamClass}`);

        // Select all hexagons on the shot map
        if (!this.shotMapSvg) {
            console.warn('Shot map SVG not found');
            return;
        }
        const hexagons = this.shotMapSvg.selectAll('.hexagon');
        console.log(`Found ${hexagons.size()} hexagons to check`);

        // Iterate through hexagons and apply highlighting
        let highlightCount = 0;
        let fadeCount = 0;

        hexagons.each(function(d) {
            const hexagon = d3.select(this);
            const minXG = parseFloat(hexagon.attr('data-min-xg'));
            const maxXG = parseFloat(hexagon.attr('data-max-xg'));
            const avgXG = parseFloat(hexagon.attr('data-avg-xg'));

            // Check if this hexbin's xG range overlaps with the histogram bin
            const overlaps = !isNaN(minXG) && !isNaN(maxXG) &&
                           ((minXG >= xgMin && minXG < xgMax) ||
                            (maxXG > xgMin && maxXG <= xgMax) ||
                            (minXG <= xgMin && maxXG >= xgMax));

            if (overlaps) {
                // Highlight matching hexbins
                hexagon
                    .style('opacity', 1)
                    .style('stroke', '#FFD700')
                    .style('stroke-width', 2.5)
                    .classed('highlighted', true);
                highlightCount++;
            } else {
                // Fade non-matching hexbins
                hexagon
                    .style('opacity', 0.2)
                    .style('stroke', '#fff')
                    .style('stroke-width', 1)
                    .classed('highlighted', false);
                fadeCount++;
            }
        });

        console.log(`Highlighted ${highlightCount} hexbins, faded ${fadeCount} hexbins`);

        // Also handle split view hexagons if they exist
        const upperHexagons = this.shotMapSvg.selectAll('.upper-split-group .hexagon');
        const lowerHexagons = this.shotMapSvg.selectAll('.lower-split-group .hexagon');

        [upperHexagons, lowerHexagons].forEach(hexGroup => {
            hexGroup.each(function(d) {
                const hexagon = d3.select(this);
                const minXG = parseFloat(hexagon.attr('data-min-xg'));
                const maxXG = parseFloat(hexagon.attr('data-max-xg'));

                const overlaps = !isNaN(minXG) && !isNaN(maxXG) &&
                               ((minXG >= xgMin && minXG < xgMax) ||
                                (maxXG > xgMin && maxXG <= xgMax) ||
                                (minXG <= xgMin && maxXG >= xgMax));

                if (overlaps) {
                    hexagon
                        .style('opacity', 1)
                        .style('stroke', '#FFD700')
                        .style('stroke-width', 2.5)
                        .classed('highlighted', true);
                } else {
                    hexagon
                        .style('opacity', 0.2)
                        .style('stroke', '#fff')
                        .style('stroke-width', 1)
                        .classed('highlighted', false);
                }
            });
        });
    }

    resetHexbinHighlighting() {
        console.log('Resetting hexbin highlighting');

        if (!this.shotMapSvg) {
            console.warn('Shot map SVG not found');
            return;
        }

        // Reset all hexagons to normal state
        this.shotMapSvg.selectAll('.hexagon')
            .style('opacity', 0.85)
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .classed('highlighted', false);

        // Reset split view hexagons if they exist
        this.shotMapSvg.selectAll('.upper-split-group .hexagon, .lower-split-group .hexagon')
            .style('opacity', 0.85)
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .classed('highlighted', false);
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
        // Legend dimensions
        const legendWidth = 120;

        // Position legend perfectly centered horizontally on the shot map
        const legendX = margin.left + (width / 2) - (legendWidth / 2);
        const legendGroup = svg.append('g')
            .attr('class', 'heatmap-legend')
            .attr('transform', `translate(${legendX}, ${margin.top + 20})`);

        // Legend title
        legendGroup.append('text')
            .attr('x', 0)
            .attr('y', -5)
            .style('font-size', '10px')
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

        // Legend rectangle (horizontal) - scaled down
        const legendHeight = 10;
        legendGroup.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#heatmap-gradient)');

        // Legend scale labels (horizontal) - scaled down
        const scaleLabels = [
            { value: '0%', x: 0 },
            { value: '30%', x: legendWidth / 2 },
            { value: '60%+', x: legendWidth }
        ];

        scaleLabels.forEach(label => {
            legendGroup.append('text')
                .attr('x', label.x)
                .attr('y', legendHeight + 12)
                .style('font-size', '8px')
                .style('fill', '#A0A0A8')
                .style('text-anchor', label.x === 0 ? 'start' : (label.x === legendWidth ? 'end' : 'middle'))
                .text(label.value);
        });

        // Shot frequency legend removed per user request
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
        // Clear stored full team data to prevent stale data
        this.team1FullData = null;
        this.team2FullData = null;
    }

    createXGHistograms(svg, data, fieldWidth, fieldHeight, margin) {
        console.log('Creating xG histograms');
        console.log('Current game ID:', this.currentGameId);

        // Get unique shooting teams from the actual data
        const uniqueShootingTeams = [...new Set(data.map(d => d.shooting_team))].filter(t => t);

        console.log('Unique shooting teams:', uniqueShootingTeams);

        if (uniqueShootingTeams.length === 0) {
            console.log('No teams found for histogram');
            return;
        }

        let team1, team2, team1Shots, team2Shots;
        let team1FullShots, team2FullShots; // For background data

        // Check if a single shooter is selected
        if (this.selectedShooter) {
            // Upper histogram/map: shots by the selected shooter (already filtered in data)
            team1 = this.selectedShooter;
            team1Shots = data; // Already filtered to this shooter's shots

            // Get full team data with current filters (but without shooter filter)
            const teamFilteredData = this.currentTeamFilteredData || this.currentGameData;

            // Get the first team name from current game data
            const team1Name = this.currentGameData[0]?.team1;

            // Full team shots for background (white outline) - uses currentGameData which contains
            // only the currently selected game (either "All Games" or a specific game)
            // No result/type filters applied to background - shows full team distribution
            team1FullShots = this.currentGameData.filter(d => d.shooting_team === team1Name);

            // Lower histogram/map: OPPONENT shots when this player is on the field
            team2 = `Opponents (${this.selectedShooter} defending)`;

            team2Shots = teamFilteredData.filter(d => {
                const playerName = this.selectedShooter;
                // Only check OPPONENT shots (shots against your team)
                const isOpponentShot = d.shooting_team && d.shooting_team !== team1Name;
                const playerOnField = d.t1lw === playerName ||
                                     d.t1c === playerName ||
                                     d.t1rw === playerName ||
                                     d.t1ld === playerName ||
                                     d.t1rd === playerName ||
                                     d.t1g === playerName ||
                                     d.t1x === playerName;
                return isOpponentShot && playerOnField;
            });

            // Full opponent shots for background (white outline) - same game as team1FullShots
            team2FullShots = this.currentGameData.filter(d => d.shooting_team && d.shooting_team !== team1Name);

            console.log(`Selected shooter: ${team1}`);
            console.log(`Current game ID: ${this.currentGameId}`);
            console.log(`Shooter's shots: ${team1Shots.length}`);
            console.log(`Team shots (background - white outline): ${team1FullShots.length}`);
            console.log(`Opponent shots when ${team1} defending: ${team2Shots.length}`);
            console.log(`All opponent shots (background - white outline): ${team2FullShots.length}`);
        } else if (this.currentGameId === 'all') {
            // For "All Games" view: Team 1 vs All Opponents combined
            // IMPORTANT: Get team name from unfiltered data to ensure consistent team identification
            // If we use filtered data, the team order might change (e.g., when filtering by "Missed")
            const allTeamsUnfiltered = [...new Set(this.currentGameData.map(d => d.shooting_team))].filter(t => t);
            team1 = allTeamsUnfiltered[0]; // Assuming first team is always your team
            team2 = 'All Opponents';
            team1Shots = data.filter(d => d.shooting_team === team1);
            team2Shots = data.filter(d => d.shooting_team !== team1); // All other teams
        } else {
            // For individual games, separate by the two teams in that game
            team1 = uniqueShootingTeams[0];
            team2 = uniqueShootingTeams.length > 1 ? uniqueShootingTeams[1] : team1;
            team1Shots = data.filter(d => d.shooting_team === team1);
            team2Shots = data.filter(d => d.shooting_team === team2);
        }

        console.log(`Team 1 (${team1}): ${team1Shots.length} shots`);
        console.log(`Team 2 (${team2}): ${team2Shots.length} shots`);

        // Position for histograms (far right side)
        const dashboardMain = document.querySelector('.dashboard-main');
        const dashboardRect = dashboardMain.getBoundingClientRect();
        const cellWidth = dashboardRect.width / 15;
        const cellHeight = dashboardRect.height / 10;

        const histogramX = cellWidth * 4.5; // Position at column 4.5 (moved half cell left from 5)
        const histogramWidth = cellWidth * 3; // Use 3 columns width
        const histogramHeight = cellHeight * 2; // Exactly 2 cells tall

        // Calculate y-scale maximum
        // Only use shared Y-max when no player is selected (for team comparison)
        // When player is selected, each histogram uses its own scale
        let sharedYMax = null;
        if (!this.selectedShooter) {
            // No player selected: use shared Y-axis for volume comparison
            sharedYMax = this.calculateSharedYMax(team1Shots, team2Shots);
            console.log(`Shared Y max for team comparison: ${sharedYMax}`);
        } else {
            // Player selected: each histogram uses its own scale
            console.log(`Player selected - using independent Y scales for each histogram`);
        }

        // Store full team data for background BEFORE drawing (so drawXGHistogram can access it)
        if (this.selectedShooter) {
            this.team1FullData = team1FullShots ? team1FullShots.filter(d => {
                const xg = parseFloat(d.xg);
                return !isNaN(xg) && xg >= 0 && xg <= 0.6;
            }) : null;
            this.team2FullData = team2FullShots ? team2FullShots.filter(d => {
                const xg = parseFloat(d.xg);
                return !isNaN(xg) && xg >= 0 && xg <= 0.6;
            }) : null;
        } else {
            // Clear full data when no shooter selected
            this.team1FullData = null;
            this.team2FullData = null;
        }

        // Create histogram for Team 1 (upper half)
        const team1HistGroup = svg.append('g')
            .attr('class', 'xg-histogram-team1')
            .attr('transform', `translate(${histogramX}, ${margin.top + 20})`);

        this.drawXGHistogram(team1HistGroup, team1Shots, histogramWidth, histogramHeight, team1, 'team1', sharedYMax);

        // Create histogram for Team 2 (lower half) - moved down 1 cell to align x-axis with field bottom
        const team2HistGroup = svg.append('g')
            .attr('class', 'xg-histogram-team2')
            .attr('transform', `translate(${histogramX}, ${margin.top + (fieldHeight / 2) + 100 + cellHeight})`);

        this.drawXGHistogram(team2HistGroup, team2Shots, histogramWidth, histogramHeight, team2, 'team2', sharedYMax);

        // Create spider diagram between histograms
        const spiderWidth = histogramWidth;
        const spiderHeight = histogramHeight * 1.5;
        const spiderY = margin.top + histogramHeight + 40 + (cellHeight / 2) + 30;

        let spiderPlayerData = null;
        let spiderTeamData = null;
        let spiderAllData = null;

        if (this.selectedShooter) {
            const playerName = this.selectedShooter;
            const unfilteredData = this.currentGameData;

            const playerPersonalShots = unfilteredData.filter(d => d.shooter === playerName);

            const teamShotsWhilePlayerOnIce = unfilteredData.filter(d => {
                const playerOnField = d.t1lw === playerName ||
                                     d.t1c === playerName ||
                                     d.t1rw === playerName ||
                                     d.t1ld === playerName ||
                                     d.t1rd === playerName ||
                                     d.t1g === playerName ||
                                     d.t1x === playerName ||
                                     d.t2lw === playerName ||
                                     d.t2c === playerName ||
                                     d.t2rw === playerName ||
                                     d.t2ld === playerName ||
                                     d.t2rd === playerName ||
                                     d.t2g === playerName ||
                                     d.t2x === playerName;
                return playerOnField;
            });

            console.log(`Shots while ${playerName} on ice: ${teamShotsWhilePlayerOnIce.length}`);
            const playerTeamName = playerPersonalShots[0]?.shooting_team || team1Shots[0]?.shooting_team;
            const teamShotsWhileOnIce = teamShotsWhilePlayerOnIce.filter(d => d.shooting_team === playerTeamName).length;
            const oppShotsWhileOnIce = teamShotsWhilePlayerOnIce.filter(d => d.shooting_team !== playerTeamName).length;
            console.log(`  Team shots: ${teamShotsWhileOnIce}, Opponent shots: ${oppShotsWhileOnIce}`);

            spiderPlayerData = { shots: playerPersonalShots, allShots: teamShotsWhilePlayerOnIce };
            spiderTeamData = { shots: team1FullShots, allShots: [...team1FullShots, ...team2FullShots] };
            spiderAllData = teamShotsWhilePlayerOnIce;
        } else if (this.currentGameId === 'all') {
            const unfilteredData = this.currentGameData;
            const allTeamsUnfiltered = [...new Set(unfilteredData.map(d => d.shooting_team))].filter(t => t);
            const team1Unfiltered = allTeamsUnfiltered[0];
            const team1ShotsUnfiltered = unfilteredData.filter(d => d.shooting_team === team1Unfiltered);
            const team2ShotsUnfiltered = unfilteredData.filter(d => d.shooting_team !== team1Unfiltered);

            spiderPlayerData = team1ShotsUnfiltered;
            spiderTeamData = null;
            spiderAllData = [...team1ShotsUnfiltered, ...team2ShotsUnfiltered];
        } else {
            const unfilteredData = this.currentGameData;
            const uniqueTeams = [...new Set(unfilteredData.map(d => d.shooting_team))].filter(t => t);
            const team1Unfiltered = uniqueTeams[0];
            const team2Unfiltered = uniqueTeams.length > 1 ? uniqueTeams[1] : team1Unfiltered;
            const team1ShotsUnfiltered = unfilteredData.filter(d => d.shooting_team === team1Unfiltered);
            const team2ShotsUnfiltered = unfilteredData.filter(d => d.shooting_team === team2Unfiltered);

            spiderPlayerData = team1ShotsUnfiltered;
            spiderTeamData = team2ShotsUnfiltered;
            spiderAllData = [...team1ShotsUnfiltered, ...team2ShotsUnfiltered];
        }

        this.createSpiderDiagram(svg, spiderPlayerData, spiderTeamData, spiderAllData, this.currentGameData, spiderWidth, spiderHeight,
            { x: histogramX, y: spiderY });

        // Store references for updating with player overlay
        this.team1HistGroup = team1HistGroup;
        this.team2HistGroup = team2HistGroup;
        this.team1Name = team1;
        this.team2Name = team2;
        this.histogramWidth = histogramWidth;
        this.histogramHeight = histogramHeight;
    }

    calculateSharedYMax(team1Shots, team2Shots) {
        const binWidth = 0.05;
        const thresholds = d3.range(0, 0.6 + binWidth, binWidth);

        // Calculate max for team 1
        const team1ValidShots = team1Shots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        const team1BinnedData = thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = team1ValidShots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });
            return binShots.length;
        });

        // Calculate max for team 2
        const team2ValidShots = team2Shots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        const team2BinnedData = thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = team2ValidShots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });
            return binShots.length;
        });

        // Return the maximum across both teams
        const team1Max = d3.max(team1BinnedData) || 0;
        const team2Max = d3.max(team2BinnedData) || 0;
        return Math.max(team1Max, team2Max);
    }

    drawXGHistogram(group, shots, width, height, teamName, teamClass, sharedYMax) {
        console.log(`Drawing histogram for ${teamName} (${teamClass}): ${shots.length} shots`);

        // Log sample of shooting teams in this data
        const shootingTeams = [...new Set(shots.map(d => d.shooting_team))];
        console.log(`Shooting teams in ${teamName} data:`, shootingTeams);

        // Filter out invalid xG values (xG goes up to 0.6)
        const validShots = shots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        console.log(`Valid shots for ${teamName}: ${validShots.length}`);

        // Store the full team data for background comparison when player is selected
        if (!this.selectedShooter) {
            // Store full team histogram data when no player is selected
            this[`${teamClass}FullData`] = validShots;
            this[`${teamClass}TeamName`] = teamName;
        }

        // Add shot count in upper right corner
        group.append('text')
            .attr('x', width)
            .attr('y', 0)
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .text(`${shots.length} shots`);

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

        // Title removed per user request

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

        // Use shared Y max if provided (no player selected), otherwise use local max (player selected)
        const yMax = sharedYMax !== null ? sharedYMax : d3.max(binnedData, d => d.total) || 0;
        console.log(`Y-axis max for ${teamName}: ${yMax} (sharedYMax: ${sharedYMax})`);

        if (!yMax || yMax === 0) {
            console.warn(`No valid yMax for histogram ${teamName}, using default of 10`);
        }

        const y = d3.scaleLinear()
            .domain([0, yMax || 10])
            .nice()
            .range([height, 0]);

        // Store team histogram data for drawing outline later
        let teamOutlineData = null;
        if (this.selectedShooter && this[`${teamClass}FullData`]) {
            const teamFullData = this[`${teamClass}FullData`];

            // Create binned data for full team
            const teamBinnedData = thresholds.slice(0, -1).map((threshold, i) => {
                const binShots = teamFullData.filter(d => {
                    const xg = parseFloat(d.xg);
                    return xg >= threshold && xg < thresholds[i + 1];
                });
                return {
                    x0: threshold,
                    x1: thresholds[i + 1],
                    total: binShots.length
                };
            });

            // Calculate scaling factor to fit team histogram into current Y-scale
            const teamMaxBin = d3.max(teamBinnedData, d => d.total) || 1;
            const currentMaxBin = yMax; // Use the current Y-scale maximum
            const scaleFactor = currentMaxBin / teamMaxBin;

            // Store scaled data for outline drawing
            teamOutlineData = teamBinnedData.map(bin => ({
                ...bin,
                scaledTotal: bin.total * scaleFactor
            }));
        }

        // Draw stacked bars
        const barGroup = group.append('g').attr('class', 'histogram-bars');

        // Store context for use in event handlers
        const self = this;

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
                .style('opacity', self.selectedShooter ? 0.6 : 0.8) // Semi-transparent when player selected
                .style('stroke', '#fff')
                .style('stroke-width', 0.5)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    binGroup.selectAll('.stack-segment')
                        .style('opacity', self.selectedShooter ? 0.8 : 0.95);

                    // Highlight corresponding hexbins on the shot map
                    const xgMin = bin.x0;
                    const xgMax = bin.x1;
                    this.highlightHexbinsByXGRange(xgMin, xgMax, teamClass);
                }.bind(this))
                .on('mouseout', function() {
                    binGroup.selectAll('.stack-segment')
                        .style('opacity', self.selectedShooter ? 0.6 : 0.8);

                    // Reset hexbin highlighting
                    this.resetHexbinHighlighting();
                }.bind(this))
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

        // Add y-axis (label removed per user request)
        group.append('g')
            .call(d3.axisLeft(y).ticks(5));

        // Add axis labels
        group.append('text')
            .attr('transform', `translate(${width / 2}, ${height + 35})`)
            .style('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#A0A0A8')
            .text('xG Value');

        // Y-axis label removed per user request

        // Draw team histogram outline if player is selected
        if (this.selectedShooter && teamOutlineData) {
            // Create a line generator for the histogram outline
            const lineGenerator = d3.line()
                .x(d => d.x)
                .y(d => d.y);

            // Build path data for the outline (step function)
            const pathData = [];

            // Start at bottom left
            pathData.push({ x: x(0), y: height });

            // Draw the stepped outline
            teamOutlineData.forEach((bin, i) => {
                const binX = x(bin.x0);
                const binWidth = x(bin.x1) - x(bin.x0);
                const binY = y(bin.scaledTotal);

                // Go up to the bar height at the left edge
                if (i === 0 || bin.scaledTotal !== teamOutlineData[i-1].scaledTotal) {
                    pathData.push({ x: binX, y: binY });
                }

                // Go across to the right edge
                pathData.push({ x: binX + binWidth, y: binY });

                // If next bar is different height or last bar, go down/up to next height
                if (i === teamOutlineData.length - 1) {
                    pathData.push({ x: binX + binWidth, y: height });
                } else if (teamOutlineData[i + 1].scaledTotal !== bin.scaledTotal) {
                    pathData.push({ x: binX + binWidth, y: y(teamOutlineData[i + 1].scaledTotal) });
                }
            });

            // Draw the outline
            group.append('path')
                .attr('class', 'team-histogram-outline')
                .attr('d', lineGenerator(pathData))
                .style('fill', 'none')
                .style('stroke', '#fff')
                .style('stroke-width', 1.5)
                .style('opacity', 0.9)
                .style('pointer-events', 'none'); // Don't interfere with hover events
        }

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

    createSpiderDiagram(svg, playerData, teamData, allData, allDataForScale, width, height, position) {
        svg.selectAll('.spider-diagram-group').remove();

        const group = svg.append('g')
            .attr('class', 'spider-diagram-group')
            .attr('transform', `translate(${position.x}, ${position.y})`);

        const playerMetrics = this.calculateSpiderMetrics(
            playerData?.shots || playerData,
            playerData?.allShots || allData
        );
        const teamMetrics = teamData ? this.calculateSpiderMetrics(
            teamData?.shots || teamData,
            teamData?.allShots || allData
        ) : null;

        if (teamMetrics) {
            teamMetrics.corsi = teamMetrics.corsi / 3;
            teamMetrics.fenwick = teamMetrics.fenwick / 3;
            teamMetrics.xGPlusMinus = teamMetrics.xGPlusMinus / 3;
            teamMetrics.xSOGPlusMinus = teamMetrics.xSOGPlusMinus / 3;
        }
        const scaleMetrics = this.calculateSpiderMetrics(allDataForScale, allDataForScale);

        console.log('=== SPIDER DIAGRAM DEBUG ===');
        console.log('Player metrics:', playerMetrics);
        if (teamMetrics) {
            console.log('Team metrics:', teamMetrics);
            console.log('Comparison:');
            console.log(`  Corsi: Player ${playerMetrics.corsi.toFixed(1)} vs Team ${teamMetrics.corsi.toFixed(1)}`);
            console.log(`  Fenwick: Player ${playerMetrics.fenwick.toFixed(1)} vs Team ${teamMetrics.fenwick.toFixed(1)}`);
            console.log(`  xG +/-: Player ${playerMetrics.xGPlusMinus.toFixed(1)} vs Team ${teamMetrics.xGPlusMinus.toFixed(1)}`);
            console.log(`  xSOG +/-: Player ${playerMetrics.xSOGPlusMinus.toFixed(1)} vs Team ${teamMetrics.xSOGPlusMinus.toFixed(1)}`);
        }

        const axes = [
            { key: 'blockedPct', label: 'Blocked %', color: '#E06B47' },
            { key: 'missedPct', label: 'Missed %', color: '#E8B44F' },
            { key: 'savedPct', label: 'Saved %', color: '#5B8DBE' },
            { key: 'goalPct', label: 'Goal %', color: '#7FB069' },
            { key: 'corsi', label: 'Corsi', color: '#9B7EBD' },
            { key: 'fenwick', label: 'Fenwick', color: '#A0A0A8' },
            { key: 'xGPlusMinus', label: 'xG +/-', color: '#E07BB0' },
            { key: 'xSOGPlusMinus', label: 'xSOG +/-', color: '#4ECDC4' }
        ];

        const allTeams = [...new Set(allDataForScale.map(d => d.shooting_team))].filter(t => t);

        axes.forEach(axis => {
            const allValues = allTeams.map(team => {
                const teamShots = allDataForScale.filter(d => d.shooting_team === team);
                const metrics = this.calculateSpiderMetrics(teamShots, allDataForScale);
                return metrics[axis.key];
            }).filter(v => v !== undefined && v !== null && !isNaN(v));

            if (allValues.length === 0) {
                axis.min = 0;
                axis.max = 100;
                return;
            }

            const dataMin = Math.min(...allValues);
            const dataMax = Math.max(...allValues);

            if (axis.key.includes('Pct')) {
                const buffer = 10;
                axis.min = Math.max(0, dataMin - buffer);
                axis.max = Math.min(100, dataMax + buffer);
            } else {
                const absMax = Math.max(Math.abs(dataMin), Math.abs(dataMax)) * 1.2;
                axis.min = -absMax;
                axis.max = absMax;
                console.log(`${axis.label}: min=${axis.min.toFixed(1)}, max=${axis.max.toFixed(1)}, dataMin=${dataMin.toFixed(1)}, dataMax=${dataMax.toFixed(1)}`);
            }
        });

        const radius = Math.min(width, height) / 2 - 40;
        const centerX = width / 2;
        const centerY = height / 2;
        const levels = 5;
        const numAxes = 8;
        const angleSlice = (2 * Math.PI) / numAxes;

        const radialScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);

        const levelData = d3.range(1, levels + 1);
        group.selectAll('.web-circle')
            .data(levelData)
            .enter()
            .append('circle')
            .attr('class', 'web-circle')
            .attr('cx', centerX)
            .attr('cy', centerY)
            .attr('r', d => radialScale((d / levels) * 100))
            .style('fill', 'none')
            .style('stroke', '#2A2D34')
            .style('stroke-width', 0.5)
            .style('stroke-dasharray', '2,2');

        axes.forEach((axis, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            group.append('line')
                .attr('class', 'axis-line')
                .attr('x1', centerX)
                .attr('y1', centerY)
                .attr('x2', centerX + Math.cos(angle) * radius)
                .attr('y2', centerY + Math.sin(angle) * radius)
                .style('stroke', '#2A2D34')
                .style('stroke-width', 1);
        });

        const drawRadarArea = (metrics, className, fillColor, strokeColor, fillOpacity) => {
            const points = axes.map((axis, i) => {
                const angle = angleSlice * i - Math.PI / 2;
                const value = this.normalizeSpiderValue(metrics[axis.key], axis);
                const r = radialScale(value);
                return {
                    x: centerX + Math.cos(angle) * r,
                    y: centerY + Math.sin(angle) * r
                };
            });

            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join('') + 'Z';

            group.append('path')
                .attr('class', className)
                .attr('d', pathData)
                .style('fill', fillColor)
                .style('fill-opacity', fillOpacity)
                .style('stroke', strokeColor)
                .style('stroke-width', 2);
        };

        if (teamMetrics) {
            drawRadarArea(teamMetrics, 'radar-area-team', 'none', '#FFFFFF', 0);
        }

        drawRadarArea(playerMetrics, 'radar-area-player', '#5B8DBE', '#5B8DBE', 0.2);

        const labelRadius = radius + 25;
        axes.forEach((axis, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            const x = centerX + Math.cos(angle) * labelRadius;
            const y = centerY + Math.sin(angle) * labelRadius;

            const value = playerMetrics[axis.key];
            const displayValue = axis.key.includes('Pct') ? `${value.toFixed(1)}%` : value.toFixed(1);

            const labelColor = axis.key.includes('Pct') ? axis.color : '#A0A0A8';

            const labelGroup = group.append('text')
                .attr('x', x)
                .attr('y', y)
                .style('font-size', '10px')
                .style('fill', labelColor)
                .style('text-anchor', 'middle')
                .style('dominant-baseline', 'middle');

            labelGroup.append('tspan')
                .attr('x', x)
                .attr('dy', 0)
                .style('font-weight', 'bold')
                .text(axis.label);

            labelGroup.append('tspan')
                .attr('x', x)
                .attr('dy', 12)
                .style('font-size', '9px')
                .text(displayValue);
        });

        group.append('text')
            .attr('x', centerX)
            .attr('y', -20)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .style('text-anchor', 'middle')
            .text('Performance Metrics');
    }

    calculateSpiderMetrics(data, allData) {
        if (!data || data.length === 0) {
            return {
                blockedPct: 0, missedPct: 0, savedPct: 0, goalPct: 0,
                corsi: 0, fenwick: 0, xGPlusMinus: 0, xSOGPlusMinus: 0
            };
        }

        const total = data.length;
        const blocked = data.filter(d => d.result === 'Blocked').length;
        const missed = data.filter(d => d.result === 'Missed').length;
        const saved = data.filter(d => d.result === 'Saved').length;
        const goals = data.filter(d => d.result === 'Goal').length;

        const teamName = data[0]?.team1 || data[0]?.shooting_team;

        const dataForCorsi = allData || data;
        const shotsFor = dataForCorsi.filter(d => d.shooting_team === teamName).length;
        const shotsAgainst = dataForCorsi.filter(d => d.shooting_team !== teamName).length;
        const corsi = shotsFor - shotsAgainst;

        console.log(`calculateSpiderMetrics for ${teamName}: data=${data.length}, allData=${dataForCorsi.length}, shotsFor=${shotsFor}, shotsAgainst=${shotsAgainst}, corsi=${corsi}`);

        const fenwickFor = dataForCorsi.filter(d =>
            d.shooting_team === teamName && d.result !== 'Blocked'
        ).length;
        const fenwickAgainst = dataForCorsi.filter(d =>
            d.shooting_team !== teamName && d.result !== 'Blocked'
        ).length;
        const fenwick = fenwickFor - fenwickAgainst;

        const xGFor = dataForCorsi
            .filter(d => d.shooting_team === teamName)
            .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
        const xGAgainst = dataForCorsi
            .filter(d => d.shooting_team !== teamName)
            .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
        const xGPlusMinus = xGFor - xGAgainst;

        const xSOGFor = dataForCorsi
            .filter(d => d.shooting_team === teamName && (d.result === 'Saved' || d.result === 'Goal'))
            .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
        const xSOGAgainst = dataForCorsi
            .filter(d => d.shooting_team !== teamName && (d.result === 'Saved' || d.result === 'Goal'))
            .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
        const xSOGPlusMinus = xSOGFor - xSOGAgainst;

        return {
            blockedPct: (blocked / total) * 100,
            missedPct: (missed / total) * 100,
            savedPct: (saved / total) * 100,
            goalPct: (goals / total) * 100,
            corsi: corsi,
            fenwick: fenwick,
            xGPlusMinus: xGPlusMinus,
            xSOGPlusMinus: xSOGPlusMinus
        };
    }

    normalizeSpiderValue(value, axis) {
        const range = axis.max - axis.min;
        if (range === 0) return 50;

        if (axis.key === 'blockedPct' || axis.key === 'missedPct' || axis.key === 'savedPct') {
            const normalized = ((axis.max - value) / range) * 100;
            return Math.max(0, Math.min(100, normalized));
        } else {
            const normalized = ((value - axis.min) / range) * 100;
            return Math.max(0, Math.min(100, normalized));
        }
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

    getAllPlayers() {
        try {
            const result = this.db.exec(`
                SELECT DISTINCT shooter FROM shots WHERE shooter IS NOT NULL AND shooter != ''
                UNION
                SELECT DISTINCT passer FROM shots WHERE passer IS NOT NULL AND passer != ''
                UNION
                SELECT DISTINCT t1lw FROM shots WHERE t1lw IS NOT NULL AND t1lw != ''
                UNION
                SELECT DISTINCT t1c FROM shots WHERE t1c IS NOT NULL AND t1c != ''
                UNION
                SELECT DISTINCT t1rw FROM shots WHERE t1rw IS NOT NULL AND t1rw != ''
                UNION
                SELECT DISTINCT t1ld FROM shots WHERE t1ld IS NOT NULL AND t1ld != ''
                UNION
                SELECT DISTINCT t1rd FROM shots WHERE t1rd IS NOT NULL AND t1rd != ''
                UNION
                SELECT DISTINCT t1g FROM shots WHERE t1g IS NOT NULL AND t1g != ''
                ORDER BY 1
            `);

            if (result.length > 0 && result[0].values.length > 0) {
                return result[0].values.map(row => row[0]);
            }
            return [];
        } catch (error) {
            console.error('Error getting all players:', error);
            return [];
        }
    }

    async loadCorrectionsGamesList() {
        try {
            const games = this.db.exec("SELECT game_id, game_name, game_date, team1, team2 FROM games ORDER BY game_date DESC");
            const gameSelect = document.getElementById('corrections-game-select');

            if (!gameSelect) return;

            gameSelect.innerHTML = '<option value="">Choose a game...</option>';

            if (games.length > 0) {
                games[0].values.forEach(game => {
                    const [gameId, gameName, gameDate, team1, team2] = game;
                    const option = document.createElement('option');
                    option.value = gameId;
                    option.textContent = `${gameName} (${gameDate}) - ${team1} vs ${team2}`;
                    gameSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading corrections games list:', error);
        }
    }

    async loadCorrectionsForGame(gameId) {
        const container = document.getElementById('corrections-table-container');

        if (!gameId) {
            container.innerHTML = '<p class="empty-state">Select a game to view and correct shot data</p>';
            return;
        }

        try {
            const gameResult = this.db.exec(`
                SELECT team1, team2 FROM games WHERE game_id = ?
            `, [gameId]);

            if (gameResult.length === 0 || gameResult[0].values.length === 0) {
                container.innerHTML = '<p class="empty-state">Game not found</p>';
                return;
            }

            const [team1, team2] = gameResult[0].values[0];
            const gameTeams = [team1, team2];

            const shotsResult = this.db.exec(`
                SELECT
                    s.shot_id, s.time, s.shooting_team, s.result, s.type,
                    s.shooter, s.passer, s.xg, s.xgot,
                    s.t1lw, s.t1c, s.t1rw, s.t1ld, s.t1rd, s.t1g, s.t1x,
                    s.t2lw, s.t2c, s.t2rw, s.t2ld, s.t2rd, s.t2g, s.t2x,
                    s.pp, s.sh, s.player_team1, s.player_team2
                FROM shots s
                WHERE s.game_id = ?
                ORDER BY s.time
            `, [gameId]);

            const correctionsResult = this.db.exec(`
                SELECT * FROM shot_corrections
            `);

            if (shotsResult.length === 0 || shotsResult[0].values.length === 0) {
                container.innerHTML = '<p class="empty-state">No shots found for this game</p>';
                return;
            }

            const shots = shotsResult[0].values.map(row => {
                const typeStr = row[4] || '';
                const isTurnover = typeStr.includes('Turnover');
                const baseType = isTurnover ? typeStr.replace('Turnover | ', '') : typeStr;

                return {
                    shot_id: row[0],
                    time: row[1],
                    shooting_team: row[2],
                    result: row[3],
                    type: baseType,
                    is_turnover: isTurnover ? 1 : 0,
                    shooter: row[5],
                    passer: row[6],
                    xg: row[7],
                    xgot: row[8],
                    t1lw: row[9],
                    t1c: row[10],
                    t1rw: row[11],
                    t1ld: row[12],
                    t1rd: row[13],
                    t1g: row[14],
                    t1x: row[15],
                    t2lw: row[16],
                    t2c: row[17],
                    t2rw: row[18],
                    t2ld: row[19],
                    t2rd: row[20],
                    t2g: row[21],
                    t2x: row[22],
                    pp: row[23],
                    sh: row[24],
                    player_team1: row[25],
                    player_team2: row[26]
                };
            });

            const corrections = {};
            if (correctionsResult.length > 0) {
                correctionsResult[0].values.forEach(row => {
                    corrections[row[0]] = {
                        time: row[1],
                        shooting_team: row[2],
                        result: row[3],
                        type: row[4],
                        is_turnover: row[5],
                        xg: row[6],
                        xgot: row[7],
                        shooter: row[8],
                        passer: row[9],
                        t1lw: row[10],
                        t1c: row[11],
                        t1rw: row[12],
                        t1ld: row[13],
                        t1rd: row[14],
                        t1g: row[15],
                        t1x: row[16],
                        t2lw: row[17],
                        t2c: row[18],
                        t2rw: row[19],
                        t2ld: row[20],
                        t2rd: row[21],
                        t2g: row[22],
                        t2x: row[23],
                        pp: row[24],
                        sh: row[25],
                        player_team1: row[26],
                        player_team2: row[27]
                    };
                });
            }

            const allPlayers = this.getAllPlayers();
            this.currentPlayers = allPlayers;

            let filteredShots = shots;

            if (this.currentFilters) {
                filteredShots = shots.filter(shot => {
                    const displayData = corrections[shot.shot_id] ? { ...shot, ...corrections[shot.shot_id] } : shot;

                    if (this.currentFilters.results && !this.currentFilters.results.includes(displayData.result)) {
                        return false;
                    }

                    if (this.currentFilters.types && !this.currentFilters.types.includes(displayData.type)) {
                        return false;
                    }

                    if (this.currentFilters.turnover !== null && displayData.is_turnover != this.currentFilters.turnover) {
                        return false;
                    }

                    if (this.currentFilters.shooters && displayData.shooter && !this.currentFilters.shooters.includes(displayData.shooter)) {
                        return false;
                    }

                    return true;
                });
            }

            if (this.currentSortField && this.currentSortDirection) {
                filteredShots.sort((a, b) => {
                    const aVal = a[this.currentSortField];
                    const bVal = b[this.currentSortField];

                    if (this.currentSortDirection === 'asc') {
                        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                    } else {
                        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                    }
                });
            }

            const correctionCount = Object.keys(corrections).length;
            const filterInfo = this.currentFilters ? ` | Showing ${filteredShots.length} of ${shots.length} shots` : '';
            document.getElementById('corrections-count').textContent =
                `${correctionCount > 0 ? `${correctionCount} correction(s) applied` : 'No corrections applied'}${filterInfo}`;

            this.renderCorrectionsTable(filteredShots, corrections, allPlayers, gameTeams);

        } catch (error) {
            console.error('Error loading corrections:', error);
            container.innerHTML = '<p class="empty-state error">Error loading shot data</p>';
        }
    }

    createPlayerDropdown(fieldName, selectedValue, players) {
        const options = players.map(player =>
            `<option value="${player}" ${player === selectedValue ? 'selected' : ''}>${player}</option>`
        ).join('');

        return `
            <select class="edit-field player-dropdown" data-field="${fieldName}">
                <option value="">-- Empty --</option>
                ${options}
                <option value="__ADD_NEW__">+ Add New Player</option>
            </select>
        `;
    }

    createTeamDropdown(selectedValue, teams) {
        const options = teams.map(team =>
            `<option value="${team}" ${team === selectedValue ? 'selected' : ''}>${team}</option>`
        ).join('');

        return `
            <select class="edit-field team-dropdown" data-field="shooting_team">
                <option value="">-- Select Team --</option>
                ${options}
            </select>
        `;
    }

    renderCorrectionsTable(shots, corrections, players, gameTeams) {
        const container = document.getElementById('corrections-table-container');

        const controlsWrapper = document.createElement('div');
        controlsWrapper.className = 'controls-wrapper';

        const sortingControls = document.createElement('div');
        sortingControls.className = 'sorting-controls';
        sortingControls.innerHTML = `
            <label>Sort by:</label>
            <select id="sort-field">
                <option value="time">Time</option>
                <option value="result">Result</option>
                <option value="shooter">Shooter</option>
                <option value="type">Type</option>
            </select>
            <button id="sort-asc" class="sort-btn">↑ Asc</button>
            <button id="sort-desc" class="sort-btn">↓ Desc</button>
        `;

        const filterControls = document.createElement('div');
        filterControls.className = 'filter-controls';
        filterControls.innerHTML = `
            <label>Filters:</label>
            <div class="filter-group">
                <label>Result:</label>
                <select id="filter-result" multiple size="4">
                    <option value="">All</option>
                    <option value="Goal">Goal</option>
                    <option value="Saved">Saved</option>
                    <option value="Missed">Missed</option>
                    <option value="Blocked">Blocked</option>
                </select>
            </div>
            <div class="filter-group">
                <label>Type:</label>
                <select id="filter-type" multiple size="3">
                    <option value="">All</option>
                    <option value="Direct">Direct</option>
                    <option value="One-timer">One-timer</option>
                    <option value="Rebound">Rebound</option>
                </select>
            </div>
            <div class="filter-group">
                <label>Turnover:</label>
                <select id="filter-turnover">
                    <option value="">All</option>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                </select>
            </div>
            <div class="filter-group">
                <label>Shooter:</label>
                <select id="filter-shooter" multiple size="5">
                    <option value="">All</option>
                    ${players.map(p => `<option value="${p}">${p}</option>`).join('')}
                </select>
            </div>
            <button id="apply-filters" class="sort-btn">Apply Filters</button>
            <button id="clear-filters" class="sort-btn">Clear</button>
        `;

        controlsWrapper.appendChild(sortingControls);
        controlsWrapper.appendChild(filterControls);

        const table = document.createElement('table');
        table.className = 'corrections-table';

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>ID</th>
                <th>Time</th>
                <th>Shooter</th>
                <th>Passer</th>
                <th>Result</th>
                <th>Type</th>
                <th>Turnover</th>
                <th>Team</th>
                <th>P1</th>
                <th>P2</th>
                <th>P3</th>
                <th>P4</th>
                <th>P5</th>
                <th>Goalie</th>
                <th>P6</th>
                <th>PP</th>
                <th>SH</th>
                <th>Actions</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        shots.forEach(shot => {
            const hasCorrection = corrections[shot.shot_id];
            const row = document.createElement('tr');
            row.className = hasCorrection ? 'has-correction' : '';
            row.dataset.shotId = shot.shot_id;

            const displayData = hasCorrection ? { ...shot, ...corrections[shot.shot_id] } : shot;

            const resultClass = displayData.result === 'Goal' ? 'result-goal' : '';

            row.innerHTML = `
                <td>${shot.shot_id}</td>
                <td><input type="number" class="edit-field time-field" data-field="time" value="${displayData.time || ''}" /></td>
                <td>${this.createPlayerDropdown('shooter', displayData.shooter, players)}</td>
                <td>${this.createPlayerDropdown('passer', displayData.passer, players)}</td>
                <td>
                    <select class="edit-field ${resultClass}" data-field="result">
                        <option value="Goal" ${displayData.result === 'Goal' ? 'selected' : ''}>Goal</option>
                        <option value="Saved" ${displayData.result === 'Saved' ? 'selected' : ''}>Saved</option>
                        <option value="Missed" ${displayData.result === 'Missed' ? 'selected' : ''}>Missed</option>
                        <option value="Blocked" ${displayData.result === 'Blocked' ? 'selected' : ''}>Blocked</option>
                    </select>
                </td>
                <td>
                    <select class="edit-field" data-field="type">
                        <option value="Direct" ${displayData.type === 'Direct' ? 'selected' : ''}>Direct</option>
                        <option value="One-timer" ${displayData.type === 'One-timer' ? 'selected' : ''}>One-timer</option>
                        <option value="Rebound" ${displayData.type === 'Rebound' ? 'selected' : ''}>Rebound</option>
                    </select>
                </td>
                <td><input type="checkbox" class="edit-field checkbox-field" data-field="is_turnover" ${displayData.is_turnover ? 'checked' : ''} /></td>
                <td>${this.createTeamDropdown(displayData.shooting_team, gameTeams)}</td>
                <td>${this.createPlayerDropdown('t1lw', displayData.t1lw, players)}</td>
                <td>${this.createPlayerDropdown('t1c', displayData.t1c, players)}</td>
                <td>${this.createPlayerDropdown('t1rw', displayData.t1rw, players)}</td>
                <td>${this.createPlayerDropdown('t1ld', displayData.t1ld, players)}</td>
                <td>${this.createPlayerDropdown('t1rd', displayData.t1rd, players)}</td>
                <td>${this.createPlayerDropdown('t1g', displayData.t1g, players)}</td>
                <td>${this.createPlayerDropdown('t1x', displayData.t1x, players)}</td>
                <td><input type="checkbox" class="edit-field checkbox-field" data-field="pp" ${displayData.pp == 1 ? 'checked' : ''} /></td>
                <td><input type="checkbox" class="edit-field checkbox-field" data-field="sh" ${displayData.sh == 1 ? 'checked' : ''} /></td>
                <td>
                    <button class="save-correction-btn" data-shot-id="${shot.shot_id}">Save</button>
                    ${hasCorrection ? `<button class="delete-correction-btn" data-shot-id="${shot.shot_id}">Reset</button>` : ''}
                </td>
            `;

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(controlsWrapper);
        container.appendChild(table);

        const sortAscBtn = document.getElementById('sort-asc');
        const sortDescBtn = document.getElementById('sort-desc');
        const sortFieldSelect = document.getElementById('sort-field');

        sortAscBtn.addEventListener('click', () => {
            this.sortCorrectionsTable(sortFieldSelect.value, 'asc');
        });

        sortDescBtn.addEventListener('click', () => {
            this.sortCorrectionsTable(sortFieldSelect.value, 'desc');
        });

        document.getElementById('apply-filters').addEventListener('click', () => {
            this.applyCorrectionsFilters();
        });

        document.getElementById('clear-filters').addEventListener('click', () => {
            document.getElementById('filter-result').selectedIndex = -1;
            document.getElementById('filter-type').selectedIndex = -1;
            document.getElementById('filter-turnover').value = '';
            document.getElementById('filter-shooter').selectedIndex = -1;
            this.currentFilters = null;
            this.applyCorrectionsFilters();
        });

        container.querySelectorAll('.player-dropdown').forEach(dropdown => {
            dropdown.addEventListener('change', (e) => {
                if (e.target.value === '__ADD_NEW__') {
                    const newPlayer = prompt('Enter new player name:');
                    if (newPlayer && newPlayer.trim()) {
                        if (!this.currentPlayers.includes(newPlayer.trim())) {
                            this.currentPlayers.push(newPlayer.trim());
                            this.currentPlayers.sort();
                        }
                        e.target.value = newPlayer.trim();
                        const gameId = document.getElementById('corrections-game-select').value;
                        this.loadCorrectionsForGame(gameId);
                    } else {
                        e.target.value = '';
                    }
                }
            });
        });

        container.querySelectorAll('.save-correction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shotId = e.target.dataset.shotId;
                this.saveCorrection(shotId);
            });
        });

        container.querySelectorAll('.delete-correction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shotId = e.target.dataset.shotId;
                this.deleteCorrection(shotId);
            });
        });

        container.querySelectorAll('select[data-field="result"]').forEach(select => {
            select.addEventListener('change', (e) => {
                if (e.target.value === 'Goal') {
                    e.target.classList.add('result-goal');
                } else {
                    e.target.classList.remove('result-goal');
                }
            });
        });
    }

    sortCorrectionsTable(field, direction) {
        const gameId = document.getElementById('corrections-game-select').value;
        if (!gameId) return;

        this.currentSortField = field;
        this.currentSortDirection = direction;

        this.loadCorrectionsForGame(gameId);
    }

    applyCorrectionsFilters() {
        const resultFilter = document.getElementById('filter-result');
        const typeFilter = document.getElementById('filter-type');
        const turnoverFilter = document.getElementById('filter-turnover');
        const shooterFilter = document.getElementById('filter-shooter');

        const selectedResults = Array.from(resultFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        const selectedTypes = Array.from(typeFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        const selectedShooters = Array.from(shooterFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        this.currentFilters = {
            results: selectedResults.length > 0 ? selectedResults : null,
            types: selectedTypes.length > 0 ? selectedTypes : null,
            turnover: turnoverFilter.value !== '' ? turnoverFilter.value : null,
            shooters: selectedShooters.length > 0 ? selectedShooters : null
        };

        const gameId = document.getElementById('corrections-game-select').value;
        if (gameId) {
            this.loadCorrectionsForGame(gameId);
        }
    }

    async saveCorrection(shotId) {
        try {
            const row = document.querySelector(`tr[data-shot-id="${shotId}"]`);
            const fields = row.querySelectorAll('.edit-field');

            const correctionData = {};
            fields.forEach(field => {
                const fieldName = field.dataset.field;
                if (field.type === 'checkbox') {
                    correctionData[fieldName] = field.checked ? 1 : 0;
                } else {
                    correctionData[fieldName] = field.value || null;
                }
            });

            const existingCorrection = this.db.exec(`SELECT shot_id FROM shot_corrections WHERE shot_id = ?`, [shotId]);

            if (existingCorrection.length > 0 && existingCorrection[0].values.length > 0) {
                this.db.run(`
                    UPDATE shot_corrections
                    SET time = ?, result = ?, type = ?, is_turnover = ?, shooting_team = ?, shooter = ?, passer = ?,
                        t1lw = ?, t1c = ?, t1rw = ?, t1ld = ?, t1rd = ?, t1g = ?, t1x = ?,
                        pp = ?, sh = ?
                    WHERE shot_id = ?
                `, [
                    correctionData.time,
                    correctionData.result,
                    correctionData.type,
                    correctionData.is_turnover,
                    correctionData.shooting_team,
                    correctionData.shooter,
                    correctionData.passer,
                    correctionData.t1lw,
                    correctionData.t1c,
                    correctionData.t1rw,
                    correctionData.t1ld,
                    correctionData.t1rd,
                    correctionData.t1g,
                    correctionData.t1x,
                    correctionData.pp,
                    correctionData.sh,
                    shotId
                ]);
            } else {
                this.db.run(`
                    INSERT INTO shot_corrections (
                        shot_id, time, result, type, is_turnover, shooting_team, shooter, passer,
                        t1lw, t1c, t1rw, t1ld, t1rd, t1g, t1x, pp, sh
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    shotId,
                    correctionData.time,
                    correctionData.result,
                    correctionData.type,
                    correctionData.is_turnover,
                    correctionData.shooting_team,
                    correctionData.shooter,
                    correctionData.passer,
                    correctionData.t1lw,
                    correctionData.t1c,
                    correctionData.t1rw,
                    correctionData.t1ld,
                    correctionData.t1rd,
                    correctionData.t1g,
                    correctionData.t1x,
                    correctionData.pp,
                    correctionData.sh
                ]);
            }

            await this.saveDatabaseToFile();

            row.classList.add('has-correction');
            const gameId = document.getElementById('corrections-game-select').value;
            this.loadCorrectionsForGame(gameId);

        } catch (error) {
            console.error('Error saving correction:', error);
            alert('Error saving correction');
        }
    }

    async deleteCorrection(shotId) {
        try {
            this.db.run(`DELETE FROM shot_corrections WHERE shot_id = ?`, [shotId]);
            await this.saveDatabaseToFile();

            const gameId = document.getElementById('corrections-game-select').value;
            this.loadCorrectionsForGame(gameId);

        } catch (error) {
            console.error('Error deleting correction:', error);
            alert('Error deleting correction');
        }
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