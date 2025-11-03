class DashboardSidebar {
    constructor(app) {
        this.app = app;
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
        const allButtons = document.querySelectorAll('.toggle-button-grid .toggle-button');
        allButtons.forEach(button => {
            button.addEventListener('click', () => {
                button.classList.toggle('active');
                this.applyFilters();
            });
        });

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
                this.app.toggleShotDots(isActive);
            });
        }

        const toggleHeatmap = document.getElementById('toggle-heatmap');
        if (toggleHeatmap) {
            toggleHeatmap.addEventListener('click', () => {
                toggleHeatmap.classList.toggle('active');
                const isActive = toggleHeatmap.classList.contains('active');
                console.log('Toggle heatmap:', isActive);
                this.app.toggleHeatmap(isActive);
            });
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

        if (selectedTypes.length > 0) {
            const isTurnoverActive = selectedTypes.includes('Turnover');
            const isDirectActive = selectedTypes.includes('Direct');
            const isOneTimerActive = selectedTypes.includes('One-timer');
            const isReboundActive = selectedTypes.includes('Rebound');

            if (isTurnoverActive && !isDirectActive && !isOneTimerActive && !isReboundActive) {
                teamFilteredData = teamFilteredData.filter(shot =>
                    shot.type && shot.type.includes('Turnover')
                );
            } else {
                const allowedTypes = [];
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
                    teamFilteredData = teamFilteredData.filter(shot =>
                        allowedTypes.some(allowedType => shot.type === allowedType)
                    );
                }
            }
        }

        let filteredData = teamFilteredData;

        if (selectedShooters.length > 0) {
            filteredData = filteredData.filter(shot =>
                selectedShooters.includes(shot.shooter)
            );
        }

        if (selectedShooters.length === 1) {
            this.app.createCharts(filteredData, teamFilteredData);
        } else {
            this.app.createCharts(filteredData);
        }
    }
}

window.DashboardSidebar = DashboardSidebar;
