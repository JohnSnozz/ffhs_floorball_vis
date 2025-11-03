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
        this.dbManager = new DatabaseManager();
        this.dashboardSidebar = null;
        this.currentGameData = null;
        this.initializeApp().catch(error => {
            console.error('App initialization failed:', error);
            debugLog('App initialization failed', { error: error.message });
        });
    }

    async initializeApp() {
        try {
            console.log('Starting app initialization...');
            await debugLog('Starting app initialization');

            await this.dbManager.initialize();
            console.log('Database initialized');
            await debugLog('Database initialized');

            this.setupEventListeners();
            console.log('Event listeners set up');
            await debugLog('Event listeners set up');

            this.dashboardSidebar = new DashboardSidebar(this);
            console.log('Dashboard sidebar initialized');

            this.shotHistogram = new ShotHistogram(this);
            console.log('Shot histogram initialized');

            this.performanceSpider = new PerformanceSpider(this);
            console.log('Performance spider initialized');

            this.goalkeeperStats = new GoalkeeperStats(this);
            console.log('Goalkeeper stats initialized');

            this.shotMap = new ShotMap(this);
            console.log('Shot map initialized');

            this.corrections = new Corrections(this);
            console.log('Corrections initialized');

            this.csvImport = new CSVImport(this);
            console.log('CSV Import initialized');

            this.setupTabs();
            console.log('Tabs set up');
            await debugLog('Tabs set up');

            await this.loadGamesList();
            await this.corrections.loadCorrectionsGamesList();
            console.log('Floorball app initialized successfully');
            await debugLog('Floorball app initialized successfully');

            // Check initial database state
            const state = this.dbManager.checkDatabaseState();
            console.log('Database state:', state);
        } catch (error) {
            console.error('Failed to initialize app:', error);
            await debugLog('Failed to initialize app', { error: error.message });
            this.showStatus('Failed to initialize application', 'error');
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

    setupEventListeners() {
        console.log('Setting up event listeners...');

        const saveAliasBtn = document.getElementById('save-alias-btn');
        if (saveAliasBtn) {
            saveAliasBtn.addEventListener('click', () => {
                this.saveGameAlias();
            });
        }
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        // Setup hamburger menus for all tabs
        const hamburgerMenus = [
            { btn: 'hamburger-btn', menu: 'dropdown-menu' },
            { btn: 'hamburger-btn-import', menu: 'dropdown-menu-import' },
            { btn: 'hamburger-btn-corrections', menu: 'dropdown-menu-corrections' }
        ];

        hamburgerMenus.forEach(({ btn, menu }) => {
            const hamburgerBtn = document.getElementById(btn);
            const dropdownMenu = document.getElementById(menu);

            if (hamburgerBtn && dropdownMenu) {
                hamburgerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Close all other dropdowns
                    hamburgerMenus.forEach(({ menu: otherMenu }) => {
                        if (otherMenu !== menu) {
                            const otherDropdown = document.getElementById(otherMenu);
                            if (otherDropdown) otherDropdown.classList.remove('show');
                        }
                    });
                    dropdownMenu.classList.toggle('show');
                });
            }
        });

        // Close all dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            hamburgerMenus.forEach(({ btn, menu }) => {
                const hamburgerBtn = document.getElementById(btn);
                const dropdownMenu = document.getElementById(menu);
                if (hamburgerBtn && dropdownMenu &&
                    !hamburgerBtn.contains(e.target) &&
                    !dropdownMenu.contains(e.target)) {
                    dropdownMenu.classList.remove('show');
                }
            });
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // Remove active classes
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active classes
                button.classList.add('active');
                document.getElementById(`${targetTab}-tab`).classList.add('active');

                // Close all dropdown menus after selection
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('show');
                });

                // Update h2 titles for all headers based on selected tab
                const titles = {
                    'import': 'Import Data',
                    'dashboard': 'Statistics Dashboard',
                    'corrections': 'Corrections'
                };
                document.querySelectorAll('.dashboard-header h2').forEach(h2 => {
                    h2.textContent = titles[targetTab] || 'Statistics Dashboard';
                });

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

    async loadGamesList() {
        try {
            const { games, aliases } = await this.dbManager.loadGamesList();

            const gameSelect = document.getElementById('selected-game');
            gameSelect.innerHTML = '<option value="all" selected>All Games</option>';

            const correctionsGameSelect = document.getElementById('corrections-game-select');
            if (correctionsGameSelect) {
                correctionsGameSelect.innerHTML = '<option value="">Choose a game...</option>';
            }

            if (games.length > 0) {
                games.forEach(game => {
                    const [gameId, gameName, gameDate, team1, team2] = game;
                    const displayName = aliases[gameId] || `${gameName} (${gameDate}) - ${team1} vs ${team2}`;

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
            const alias = this.dbManager.loadGameAlias(gameId);
            aliasInput.value = alias || '';
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
            const success = await this.dbManager.saveGameAlias(gameId, alias);

            if (success) {
                await this.loadGamesList();
                alert('Game alias saved successfully!');
            } else {
                alert('Error saving game alias');
            }
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
                shots = this.dbManager.db.exec(`
                    SELECT * FROM shots_view
                    ORDER BY game_id, shot_id
                `);
                console.log(`Found ${shots.length > 0 ? shots[0].values.length : 0} total shots across all games`);
            } else {
                console.log(`Loading data for game ID: ${gameId}`);
                shots = this.dbManager.db.exec(`
                    SELECT * FROM shots_view
                    WHERE game_id = ?
                    ORDER BY shot_id
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
                this.dashboardSidebar.populateFilters(data);
                this.goalkeeperStats.updateGoalkeeperHistogram();
                // Apply current filters instead of directly creating charts with unfiltered data
                this.dashboardSidebar.applyFilters();
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
                const totalShots = this.dbManager.db.exec(`SELECT COUNT(*) as count FROM shots`);
                console.log('Total shots in database:', totalShots[0]?.values[0][0]);

                // Query 2: Shots by team
                const shotsByTeam = this.dbManager.db.exec(`
                    SELECT shooting_team, COUNT(*) as count
                    FROM shots
                    GROUP BY shooting_team
                `);
                console.log('Shots by team:');
                shotsByTeam[0]?.values.forEach(row => {
                    console.log(`  ${row[0]}: ${row[1]} shots`);
                });

                // Query 3: Griezitis on field for opponent shots (matching your SQL)
                const griezitisOpponentShots = this.dbManager.db.exec(`
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
                const griezitisTeamShots = this.dbManager.db.exec(`
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
                const teamStructure = this.dbManager.db.exec(`
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
        await this.shotMap.createShotMap(data, onFieldData);
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