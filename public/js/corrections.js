class Corrections {
    constructor(app) {
        this.app = app;
        this.currentFilters = null;
        this.currentSortField = null;
        this.currentSortDirection = null;
        this.currentPlayers = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const correctionsGameSelect = document.getElementById('corrections-game-select');
        if (correctionsGameSelect) {
            correctionsGameSelect.addEventListener('change', (e) => {
                this.loadCorrectionsForGame(e.target.value);
                this.app.loadGameAlias(e.target.value);
            });
        }
    }

    getAllPlayers() {
        try {
            const result = this.app.dbManager.db.exec(`
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
            // Use the same method as app.js to get games with aliases
            const { games, aliases } = await this.app.dbManager.loadGamesList();
            const gameSelect = document.getElementById('corrections-game-select');

            if (!gameSelect) return;

            gameSelect.innerHTML = '<option value="">Choose a game...</option>';

            if (games.length > 0) {
                games.forEach(game => {
                    const [gameId, gameName, gameDate, team1, team2] = game;
                    const displayName = aliases[gameId] || `${gameName} (${gameDate}) - ${team1} vs ${team2}`;
                    const option = document.createElement('option');
                    option.value = gameId;
                    option.textContent = displayName;
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
            const gameData = await this.app.dbManager.loadCorrectionsForGame(gameId);

            if (!gameData) {
                container.innerHTML = '<p class="empty-state">Game not found</p>';
                return;
            }

            const { gameName, gameDate, team1, team2, shots, corrections } = gameData;
            const gameTeams = [team1, team2].filter(t => t);

            if (!shots || shots.length === 0) {
                container.innerHTML = '<p class="empty-state">No shots found for this game</p>';
                return;
            }

            const allPlayers = this.getAllPlayers();
            this.currentPlayers = allPlayers;

            let filteredShots = shots;

            if (this.currentFilters) {
                console.log('Filtering shots with:', this.currentFilters);
                console.log('Total shots before filter:', shots.length);

                filteredShots = shots.filter(shot => {
                    const displayData = corrections[shot.shot_id] ? { ...shot, ...corrections[shot.shot_id] } : shot;

                    // Team filter (OR within teams)
                    if (this.currentFilters.teams && this.currentFilters.teams.length > 0) {
                        if (!displayData.shooting_team || !this.currentFilters.teams.includes(displayData.shooting_team)) {
                            return false;
                        }
                    }

                    // Result filter (OR within results)
                    if (this.currentFilters.results && this.currentFilters.results.length > 0) {
                        if (!displayData.result || !this.currentFilters.results.includes(displayData.result)) {
                            return false;
                        }
                    }

                    // Type filter (OR within types)
                    if (this.currentFilters.types && this.currentFilters.types.length > 0) {
                        if (!displayData.type || !this.currentFilters.types.includes(displayData.type)) {
                            return false;
                        }
                    }

                    // Turnover filter
                    if (this.currentFilters.turnover !== null && displayData.is_turnover != this.currentFilters.turnover) {
                        return false;
                    }

                    // Shooter filter (OR within shooters)
                    if (this.currentFilters.shooters && this.currentFilters.shooters.length > 0) {
                        if (!displayData.shooter || !this.currentFilters.shooters.includes(displayData.shooter)) {
                            return false;
                        }
                    }

                    // On field filter (OR within players)
                    if (this.currentFilters.onfield && this.currentFilters.onfield.length > 0) {
                        const onFieldPlayers = [
                            displayData.t1lw, displayData.t1c, displayData.t1rw,
                            displayData.t1ld, displayData.t1rd, displayData.t1g, displayData.t1x,
                            displayData.t2lw, displayData.t2c, displayData.t2rw,
                            displayData.t2ld, displayData.t2rd, displayData.t2g, displayData.t2x
                        ].filter(p => p);

                        const hasSelectedPlayer = this.currentFilters.onfield.some(player =>
                            onFieldPlayers.includes(player)
                        );

                        if (!hasSelectedPlayer) {
                            return false;
                        }
                    }

                    return true;
                });

                console.log('Shots after filter:', filteredShots.length);
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

        // Save current filter selections before re-rendering
        const savedSelections = {};
        const filterIds = ['filter-team', 'filter-result', 'filter-type', 'filter-turnover', 'filter-shooter', 'filter-onfield'];
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (element.multiple) {
                    savedSelections[id] = Array.from(element.selectedOptions).map(opt => opt.value);
                } else {
                    savedSelections[id] = element.value;
                }
            }
        });

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
            <div class="filter-header">
                <label>Filters</label>
            </div>
            <div class="filter-groups-container">
                <div class="filter-group">
                    <label>Team</label>
                    <select id="filter-team" multiple size="4">
                        ${gameTeams.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Result</label>
                    <select id="filter-result" multiple size="4">
                        <option value="Goal">Goal</option>
                        <option value="Saved">Saved</option>
                        <option value="Missed">Missed</option>
                        <option value="Blocked">Blocked</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Type</label>
                    <select id="filter-type" multiple size="4">
                        <option value="Direct">Direct</option>
                        <option value="One-timer">One-timer</option>
                        <option value="Rebound">Rebound</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Turnover</label>
                    <select id="filter-turnover" size="4">
                        <option value="">All</option>
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Shooter</label>
                    <select id="filter-shooter" multiple size="4">
                        ${players.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>On Field</label>
                    <select id="filter-onfield" multiple size="4">
                        ${players.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="filter-actions">
                <button id="clear-filters" class="filter-btn clear-btn">Clear All Filters</button>
            </div>
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
            const displayData = hasCorrection ? { ...shot, ...corrections[shot.shot_id] } : shot;
            const isHidden = displayData.is_hidden == 1;

            // Add classes for correction and hidden status
            row.className = `${hasCorrection ? 'has-correction' : ''} ${isHidden ? 'is-hidden' : ''}`.trim();
            row.dataset.shotId = shot.shot_id;

            const resultClass = displayData.result === 'Goal' ? 'result-goal' : '';

            row.innerHTML = `
                <td>${shot.shot_id}${isHidden ? ' <span class="hidden-indicator" title="Hidden from dashboard">[HIDDEN]</span>' : ''}</td>
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
                    <button class="toggle-hidden-btn ${isHidden ? 'unhide' : 'hide'}" data-shot-id="${shot.shot_id}">${isHidden ? 'Show' : 'Hide'}</button>
                </td>
            `;

            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'corrections-table-wrapper';
        tableWrapper.appendChild(table);

        container.innerHTML = '';
        container.appendChild(controlsWrapper);
        container.appendChild(tableWrapper);

        // Restore saved filter selections after re-rendering
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element && savedSelections[id]) {
                if (element.multiple && Array.isArray(savedSelections[id])) {
                    // For multi-select, set each option's selected state
                    Array.from(element.options).forEach(option => {
                        option.selected = savedSelections[id].includes(option.value);
                    });
                } else {
                    // For single select
                    element.value = savedSelections[id];
                }
            }
        });

        const sortAscBtn = document.getElementById('sort-asc');
        const sortDescBtn = document.getElementById('sort-desc');
        const sortFieldSelect = document.getElementById('sort-field');

        sortAscBtn.addEventListener('click', () => {
            this.sortCorrectionsTable(sortFieldSelect.value, 'asc');
        });

        sortDescBtn.addEventListener('click', () => {
            this.sortCorrectionsTable(sortFieldSelect.value, 'desc');
        });

        // Add instant filter listeners to all filter dropdowns
        const filterElements = [
            'filter-team',
            'filter-result',
            'filter-type',
            'filter-turnover',
            'filter-shooter',
            'filter-onfield'
        ];

        filterElements.forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement) {
                // Enable multi-select without holding Ctrl/Cmd
                if (filterElement.multiple) {
                    filterElement.addEventListener('mousedown', function(e) {
                        if (e.target.tagName === 'OPTION') {
                            e.preventDefault();
                            const option = e.target;
                            const wasSelected = option.selected;

                            // Toggle the option
                            option.selected = !wasSelected;

                            // Focus back on the select to keep it active
                            this.focus();

                            // Manually trigger change event
                            setTimeout(() => {
                                this.dispatchEvent(new Event('change', { bubbles: true }));
                            }, 0);

                            return false;
                        }
                    });
                }

                filterElement.addEventListener('change', () => {
                    this.applyCorrectionsFilters();
                });
            }
        });

        document.getElementById('clear-filters').addEventListener('click', () => {
            document.getElementById('filter-team').selectedIndex = -1;
            document.getElementById('filter-result').selectedIndex = -1;
            document.getElementById('filter-type').selectedIndex = -1;
            document.getElementById('filter-turnover').value = '';
            document.getElementById('filter-shooter').selectedIndex = -1;
            document.getElementById('filter-onfield').selectedIndex = -1;
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

        container.querySelectorAll('.toggle-hidden-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const shotId = e.target.dataset.shotId;
                const isHidden = e.target.classList.contains('unhide');

                if (isHidden) {
                    await this.unhideShot(shotId);
                } else {
                    await this.hideShot(shotId);
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
        const teamFilter = document.getElementById('filter-team');
        const resultFilter = document.getElementById('filter-result');
        const typeFilter = document.getElementById('filter-type');
        const turnoverFilter = document.getElementById('filter-turnover');
        const shooterFilter = document.getElementById('filter-shooter');
        const onFieldFilter = document.getElementById('filter-onfield');

        const selectedTeams = Array.from(teamFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        const selectedResults = Array.from(resultFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        const selectedTypes = Array.from(typeFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        const selectedShooters = Array.from(shooterFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        const selectedOnField = Array.from(onFieldFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        console.log('DEBUG selectedTeams:', selectedTeams);
        console.log('DEBUG selectedResults:', selectedResults);
        console.log('DEBUG selectedTypes:', selectedTypes);
        console.log('DEBUG selectedShooters:', selectedShooters);
        console.log('DEBUG selectedOnField:', selectedOnField);

        this.currentFilters = {
            teams: selectedTeams.length > 0 ? selectedTeams : null,
            results: selectedResults.length > 0 ? selectedResults : null,
            types: selectedTypes.length > 0 ? selectedTypes : null,
            turnover: turnoverFilter.value !== '' ? turnoverFilter.value : null,
            shooters: selectedShooters.length > 0 ? selectedShooters : null,
            onfield: selectedOnField.length > 0 ? selectedOnField : null
        };

        console.log('Active filters:', this.currentFilters);

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

            // Use the database manager's saveCorrection method
            const success = await this.app.dbManager.saveCorrection(shotId, correctionData);

            if (success) {
                row.classList.add('has-correction');

                // Reload corrections table
                const gameId = document.getElementById('corrections-game-select').value;
                this.loadCorrectionsForGame(gameId);

                // Reload dashboard data to reflect the changes
                if (gameId && this.app.currentGameId === gameId) {
                    await this.app.loadGameData(gameId);
                }

                // Show success feedback
                const saveBtn = row.querySelector('.save-correction-btn');
                if (saveBtn) {
                    saveBtn.textContent = 'Saved!';
                    saveBtn.classList.add('saved');
                    setTimeout(() => {
                        saveBtn.textContent = 'Save';
                        saveBtn.classList.remove('saved');
                    }, 2000);
                }
            } else {
                alert('Error saving correction');
            }

        } catch (error) {
            console.error('Error saving correction:', error);
            alert('Error saving correction: ' + error.message);
        }
    }

    async deleteCorrection(shotId) {
        try {
            // Use the database manager's deleteCorrection method
            const success = await this.app.dbManager.deleteCorrection(shotId);

            if (success) {
                const row = document.querySelector(`tr[data-shot-id="${shotId}"]`);
                if (row) {
                    row.classList.remove('has-correction');
                }

                // Reload corrections table
                const gameId = document.getElementById('corrections-game-select').value;
                this.loadCorrectionsForGame(gameId);

                // Reload dashboard data to reflect the changes
                if (gameId && this.app.currentGameId === gameId) {
                    await this.app.loadGameData(gameId);
                }
            } else {
                alert('Error deleting correction');
            }

        } catch (error) {
            console.error('Error deleting correction:', error);
            alert('Error deleting correction: ' + error.message);
        }
    }

    async hideShot(shotId) {
        try {
            const success = await this.app.dbManager.hideShot(shotId);

            if (success) {
                // Reload corrections table
                const gameId = document.getElementById('corrections-game-select').value;
                this.loadCorrectionsForGame(gameId);

                // Reload dashboard data to reflect the changes
                if (gameId && this.app.currentGameId === gameId) {
                    await this.app.loadGameData(gameId);
                }
            } else {
                alert('Error hiding shot');
            }

        } catch (error) {
            console.error('Error hiding shot:', error);
            alert('Error hiding shot: ' + error.message);
        }
    }

    async unhideShot(shotId) {
        try {
            const success = await this.app.dbManager.unhideShot(shotId);

            if (success) {
                // Reload corrections table
                const gameId = document.getElementById('corrections-game-select').value;
                this.loadCorrectionsForGame(gameId);

                // Reload dashboard data to reflect the changes
                if (gameId && this.app.currentGameId === gameId) {
                    await this.app.loadGameData(gameId);
                }
            } else {
                alert('Error showing shot');
            }

        } catch (error) {
            console.error('Error showing shot:', error);
            alert('Error showing shot: ' + error.message);
        }
    }
}

window.Corrections = Corrections;
