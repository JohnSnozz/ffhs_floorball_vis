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
                return; // Exit early if we loaded existing database
            }
        } catch (error) {
            console.log('No existing database file found, creating new one...');
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
                player_team1 INTEGER,
                player_team2 INTEGER,
                FOREIGN KEY (game_id) REFERENCES games (game_id) ON DELETE CASCADE
            )
        `);
        
        console.log('Database tables created successfully');
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
                
                this.showCSVPreview(this.currentData);
                document.getElementById('import-btn').disabled = false;
                this.showStatus('CSV file loaded successfully. Ready to import.', 'success');
                debugLog('FILE SELECTION - Ready for import');
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
            console.log('Starting import process...');
            console.log('Current data:', this.currentData);
            
            // Extract team names from the first data row
            const firstRow = this.currentData.data[0];
            const team1 = firstRow['Team 1'];
            const team2 = firstRow['Team 2'];
            
            console.log('Team 1:', team1, 'Team 2:', team2);

            // Check if database exists
            console.log('Database object:', this.db);
            console.log('Database constructor:', this.db.constructor.name);
            
            // Insert game record
            console.log('Inserting game record...');
            console.log('Game data:', {gameName, gameDate, team1, team2});
            
            try {
                this.db.run(`
                    INSERT INTO games (game_name, game_date, team1, team2) 
                    VALUES (?, ?, ?, ?)
                `, [gameName, gameDate, team1, team2]);
                console.log('Game insert successful');
            } catch (insertError) {
                console.error('Game insert failed:', insertError);
                throw insertError;
            }
            
            const gameResult = this.db.exec("SELECT last_insert_rowid()");
            console.log('Game result:', gameResult);
            const gameId = gameResult[0].values[0][0];
            console.log('Game inserted with ID:', gameId);

            // Insert shot data
            console.log('Inserting shots...');
            let shotCount = 0;
            
            this.currentData.data.forEach((row, index) => {
                try {
                    this.db.run(`
                        INSERT INTO shots (
                            game_id, date, team1, team2, time, shooting_team, result, type,
                            xg, xgot, shooter, passer, t1lw, t1c, t1rw, t1ld, t1rd, t1g, t1x,
                            t2lw, t2c, t2rw, t2ld, t2rd, t2g, t2x, pp, sh, distance, angle,
                            player_team1, player_team2
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        parseFloat(row['Distance']) || 0,
                        parseFloat(row['Angle']) || 0,
                        parseInt(row['Player Team 1']) || 0,
                        parseInt(row['Player Team 2']) || 0
                    ]);
                    shotCount++;
                } catch (shotError) {
                    console.error(`Error inserting shot ${index}:`, shotError, row);
                }
            });
            
            console.log(`Inserted ${shotCount} shots`);

            // Verify data was actually saved
            const verifyResult = this.db.exec(`SELECT COUNT(*) as count FROM shots WHERE game_id = ?`, [gameId]);
            const savedCount = verifyResult[0].values[0][0];
            console.log(`Verified: ${savedCount} shots saved to database for game ID ${gameId}`);

            this.showStatus(`Successfully imported ${shotCount} shots for game: ${gameName} (${savedCount} saved to database)`, 'success');
            
            // Reset form
            document.getElementById('game-name').value = '';
            document.getElementById('game-date').value = '';
            document.getElementById('csv-file').value = '';
            document.getElementById('file-name').textContent = '';
            document.getElementById('csv-preview').innerHTML = '';
            document.getElementById('import-btn').disabled = true;
            this.currentData = null;

            // Check database state before saving
            this.checkDatabaseState();

            // Save database to file
            await this.saveDatabaseToFile();

            // Refresh games list
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
            console.error('Error loading games:', error);
        }
    }

    async loadGameData(gameId) {
        if (!gameId) {
            this.clearCharts();
            return;
        }

        try {
            console.log(`Loading data for game ID: ${gameId}`);
            
            const shots = this.db.exec(`
                SELECT * FROM shots WHERE game_id = ? ORDER BY time
            `, [gameId]);

            console.log(`Found ${shots.length > 0 ? shots[0].values.length : 0} shots for game ${gameId}`);

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
                this.createCharts(data);
            } else {
                console.log('No shots found for this game');
                this.clearCharts();
            }
        } catch (error) {
            console.error('Error loading game data:', error);
            this.showStatus(`Error loading game data: ${error.message}`, 'error');
        }
    }

    createCharts(data) {
        this.createShotMap(data);
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

    createShotMap(data) {
        console.log('Creating shot map...');
        debugLog('Creating shot map', { dataLength: data.length });
        
        const container = d3.select('#shot-map-chart');
        container.selectAll('*').remove();

        // Floorball court dimensions (in meters, scaled for visualization)
        // Using vertical orientation: height = length (40m), width = width (20m)
        const courtLength = 40; // 40m length (vertical)
        const courtWidth = 20;  // 20m width (horizontal)
        const scale = 15; // Scale factor for visualization
        
        const margin = {top: 20, right: 20, bottom: 40, left: 20};
        const width = courtWidth * scale;   // 20m becomes width
        const height = courtLength * scale; // 40m becomes height

        const svg = container
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Add field background image
        this.addFieldBackground(g, width, height);

        // Draw floorball court elements (minimal since we have background)
        this.drawFloorballCourtOverlay(g, width, height, scale);

        // Prepare shot data with coordinates
        const shotData = this.prepareShotMapData(data, width, height, scale);
        
        if (shotData.length === 0) {
            g.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', '#666')
                .text('No shot location data available');
            return;
        }

        // Create shot visualization (hexagonal or fallback)
        console.log('Creating shot visualization...');
        await debugLog('Creating shot visualization', { d3Available: typeof d3 !== 'undefined', hexbinAvailable: typeof d3.hexbin !== 'undefined' });
        
        if (typeof d3.hexbin === 'undefined') {
            console.log('d3.hexbin not available, using simple scatter plot');
            await debugLog('d3.hexbin not available, using scatter plot fallback');
            this.createScatterShotMap(g, shotData, width, height);
            return;
        }
        
        const hexRadius = Math.min(width, height) / 40;
        const hexbin = d3.hexbin()
            .radius(hexRadius)
            .extent([[0, 0], [width, height]]);
            
        console.log('Hexbin created successfully');
        await debugLog('Hexbin created successfully', { radius: hexRadius });

        const hexData = hexbin(shotData);

        // Calculate success rate for each hexagon
        hexData.forEach(hex => {
            const goals = hex.filter(d => d.result === 'Goal').length;
            const total = hex.length;
            hex.successRate = total > 0 ? goals / total : 0;
            hex.totalShots = total;
            hex.goals = goals;
        });

        // Color scale based on success rate
        const colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
            .domain([0, d3.max(hexData, d => d.successRate) || 1]);

        // Size scale based on number of shots
        const sizeScale = d3.scaleSqrt()
            .domain([1, d3.max(hexData, d => d.totalShots) || 1])
            .range([2, hexRadius]);

        // Create tooltip
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        // Draw hexagons
        g.selectAll('.hexagon')
            .data(hexData.filter(d => d.totalShots > 0))
            .enter().append('path')
            .attr('class', 'hexagon')
            .attr('d', d => hexbin.hexagon(sizeScale(d.totalShots)))
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .style('fill', d => colorScale(d.successRate))
            .style('opacity', 0.8)
            .on('mouseover', function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`
                    <strong>Shots: ${d.totalShots}</strong><br/>
                    Goals: ${d.goals}<br/>
                    Success Rate: ${(d.successRate * 100).toFixed(1)}%
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(d) {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        // Add legend
        this.addShotMapLegend(svg, width, height, margin, colorScale);
    }

    createScatterShotMap(g, shotData, width, height) {
        console.log('Creating scatter plot shot map');
        debugLog('Creating scatter plot shot map', { shotCount: shotData.length });
        
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
                .text('Select a game to view shot map');
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
    
    debugLog('DOM LOADED - Starting app creation', {
        d3Available: typeof d3 !== 'undefined',
        hexbinAvailable: typeof d3.hexbin !== 'undefined', 
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