class DashboardSidebar {
    constructor(app) {
        this.app = app;
        this.turnoverState = 'off';  // 'off', 'only', 'exclude'
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.setupGameSelector();
        this.setupFilterToggleButtons();
        this.setupVisualizationControls();
    }

    setupGameSelector() {
        const gameSelector = document.getElementById('selected-game');
        if (gameSelector) {
            gameSelector.addEventListener('change', (e) => {
                this.app.loadGameData(e.target.value);
            });
        }
    }

    setupFilterToggleButtons() {
        const turnoverButton = document.querySelector('.turnover-filter');
        const regularButtons = document.querySelectorAll('.toggle-button-grid .toggle-button:not(.turnover-filter)');

        regularButtons.forEach(button => {
            button.addEventListener('click', () => {
                button.classList.toggle('active');
                this.applyFilters();
            });
        });

        if (turnoverButton) {
            turnoverButton.addEventListener('click', () => {
                this.cycleTurnoverState(turnoverButton);
                this.applyFilters();
            });
        }

        const shooterSelect = document.getElementById('filter-shooter');
        if (shooterSelect) {
            shooterSelect.addEventListener('change', () => {
                this.applyFilters();
            });
        }

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

    setupVisualizationControls() {
        const toggleShotDots = document.getElementById('toggle-shot-dots');
        if (toggleShotDots) {
            toggleShotDots.addEventListener('click', () => {
                toggleShotDots.classList.toggle('active');
                const isActive = toggleShotDots.classList.contains('active');
                console.log('Toggle shot dots:', isActive);
                this.app.shotMap.toggleShotDots(isActive);
            });
        }

        const toggleHeatmap = document.getElementById('toggle-heatmap');
        if (toggleHeatmap) {
            toggleHeatmap.addEventListener('click', () => {
                toggleHeatmap.classList.toggle('active');
                const isActive = toggleHeatmap.classList.contains('active');
                console.log('Toggle heatmap:', isActive);
                this.app.shotMap.toggleHeatmap(isActive);
            });
        }
    }

    syncVisualizationButtonStates() {
        const toggleShotDots = document.getElementById('toggle-shot-dots');
        const toggleHeatmap = document.getElementById('toggle-heatmap');

        if (toggleShotDots && this.app.shotMap) {
            if (this.app.shotMap.showDots) {
                toggleShotDots.classList.add('active');
            } else {
                toggleShotDots.classList.remove('active');
            }
        }

        if (toggleHeatmap && this.app.shotMap) {
            if (this.app.shotMap.showHeatmap) {
                toggleHeatmap.classList.add('active');
            } else {
                toggleHeatmap.classList.remove('active');
            }
        }
    }

    cycleTurnoverState(button) {
        if (this.turnoverState === 'off') {
            this.turnoverState = 'only';
            button.classList.add('active');
            button.classList.remove('exclude');
        } else if (this.turnoverState === 'only') {
            this.turnoverState = 'exclude';
            button.classList.remove('active');
            button.classList.add('exclude');
        } else {
            this.turnoverState = 'off';
            button.classList.remove('active');
            button.classList.remove('exclude');
        }
    }

    populateFilters(data) {
        const shooters = [...new Set(data.map(d => d.shooter).filter(s => s && s.trim() !== ''))];

        shooters.sort((a, b) => {
            const numA = parseInt(a.match(/#(\d+)/)?.[1] || '999');
            const numB = parseInt(b.match(/#(\d+)/)?.[1] || '999');
            return numA - numB;
        });

        const shooterSelect = document.getElementById('filter-shooter');

        const previouslySelected = Array.from(shooterSelect.selectedOptions).map(opt => opt.value);

        shooterSelect.innerHTML = '<option value="">All Shooters</option>';
        shooters.forEach(shooter => {
            const option = document.createElement('option');
            option.value = shooter;
            option.textContent = shooter;
            if (previouslySelected.includes(shooter)) {
                option.selected = true;
            }
            shooterSelect.appendChild(option);
        });
    }

    applyFilters() {
        if (!this.app.currentGameData) {
            return;
        }

        const shooterSelect = document.getElementById('filter-shooter');

        const selectedResults = Array.from(document.querySelectorAll('.result-filter.active'))
            .map(btn => btn.getAttribute('data-value'));

        const selectedTypes = Array.from(document.querySelectorAll('.type-filter.active'))
            .map(btn => btn.getAttribute('data-value'));

        const selectedShooters = Array.from(shooterSelect.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v !== '');

        this.app.selectedShooter = selectedShooters.length === 1 ? selectedShooters[0] : null;

        let teamFilteredData = this.app.currentGameData;

        if (selectedResults.length > 0) {
            teamFilteredData = teamFilteredData.filter(shot => selectedResults.includes(shot.result));
        }

        const isDirectActive = selectedTypes.includes('Direct');
        const isOneTimerActive = selectedTypes.includes('One-timer');
        const isReboundActive = selectedTypes.includes('Rebound');

        if (selectedTypes.length > 0 || this.turnoverState !== 'off') {
            teamFilteredData = teamFilteredData.filter(shot => {
                if (!shot.type) return false;

                const isTurnoverShot = shot.type.includes('Turnover');
                const isReboundShot = shot.type === 'Rebound';
                const isDirectShot = shot.type === 'Direct' || shot.type === 'Turnover | Direct';
                const isOneTimerShot = shot.type === 'One-timer' || shot.type === 'Turnover | One-timer';

                let matchesTypeFilter = false;
                if (isReboundActive && isReboundShot) {
                    matchesTypeFilter = true;
                }
                if (isDirectActive && isDirectShot) {
                    matchesTypeFilter = true;
                }
                if (isOneTimerActive && isOneTimerShot) {
                    matchesTypeFilter = true;
                }

                if (this.turnoverState === 'only') {
                    if (selectedTypes.length === 0) {
                        return isTurnoverShot;
                    } else {
                        return isTurnoverShot || matchesTypeFilter;
                    }
                } else if (this.turnoverState === 'exclude') {
                    if (isTurnoverShot) {
                        return false;
                    }

                    if (selectedTypes.length === 0) {
                        return !isReboundShot;
                    }

                    if (isReboundActive && !isDirectActive && !isOneTimerActive) {
                        return true;
                    }

                    return matchesTypeFilter;
                } else {
                    if (selectedTypes.length === 0) {
                        return true;
                    } else {
                        return matchesTypeFilter;
                    }
                }
            });
        }

        this.app.currentTeamFilteredData = teamFilteredData;

        let filteredData = teamFilteredData;

        if (selectedShooters.length > 0) {
            console.log('Filtering by shooters:', selectedShooters);

            // Debug: Check what shooters are in the data
            const uniqueShooters = [...new Set(teamFilteredData.map(s => s.shooter))];
            console.log('Available shooters in data:', uniqueShooters);

            // Check for any goals that might be filtered out
            const goalsBeforeFilter = teamFilteredData.filter(s => s.result === 'Goal');
            console.log('Goals before shooter filter:', goalsBeforeFilter.length, goalsBeforeFilter.map(g => ({
                shooter: g.shooter,
                shot_id: g.shot_id
            })));

            filteredData = filteredData.filter(shot =>
                selectedShooters.includes(shot.shooter)
            );

            const goalsAfterFilter = filteredData.filter(s => s.result === 'Goal');
            console.log('Goals after shooter filter:', goalsAfterFilter.length);

            // Check what was filtered out
            const filteredOutGoals = goalsBeforeFilter.filter(g =>
                !filteredData.some(f => f.shot_id === g.shot_id)
            );
            if (filteredOutGoals.length > 0) {
                console.warn('Goals filtered out:', filteredOutGoals);
            }
        }

        if (selectedShooters.length === 1) {
            this.app.createCharts(filteredData, teamFilteredData);
        } else {
            this.app.createCharts(filteredData);
        }

        this.syncVisualizationButtonStates();

        this.app.goalkeeperStats.updateGoalkeeperHistogram();

        if (this.app.xgScatter) {
            this.app.xgScatter.setFilters(
                this.app.selectedShooter,
                selectedTypes,
                this.turnoverState
            );
            this.app.xgScatter.createScatterPlot(this.app.currentGameData);
        }

        if (this.app.playerMetrics) {
            this.app.playerMetrics.setData(this.app.currentGameData, this.app.selectedShooter);
        }
    }
}

window.DashboardSidebar = DashboardSidebar;
