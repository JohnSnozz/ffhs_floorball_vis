class GoalkeeperStats {
    constructor(app) {
        this.app = app;
    }

    updateGoalkeeperHistogram(filteredData = null) {
        if (typeof goalkeeperHistogram === 'undefined') {
            return;
        }

        // Use filtered data if provided, otherwise fall back to currentGameData
        const currentData = filteredData || this.app.currentGameData;

        let allGamesData = null;
        try {
            const allShots = this.app.dbManager.db.exec(`SELECT * FROM shots_view ORDER BY game_id, time`);
            if (allShots.length > 0 && allShots[0].values.length > 0) {
                const columns = allShots[0].columns;
                allGamesData = allShots[0].values.map(row => {
                    const obj = {};
                    columns.forEach((col, index) => {
                        obj[col] = row[index];
                    });
                    return obj;
                });
            }
        } catch (error) {
            console.error('Error loading all games data for goalkeeper histogram:', error);
        }

        goalkeeperHistogram.setData(currentData, allGamesData);

        if (typeof goalkeeperRadialChart !== 'undefined') {
            const gkSelect = document.getElementById('goalkeeper-select');
            const selectedGK = gkSelect ? gkSelect.value : null;

            const selectedTypes = Array.from(document.querySelectorAll('.type-filter.active:not(.turnover-filter)'))
                .map(btn => btn.getAttribute('data-value'));

            goalkeeperRadialChart.setData(currentData, allGamesData, selectedGK, selectedTypes);
        }

        if (typeof goalkeeperQuadrant !== 'undefined') {
            const gkSelect = document.getElementById('goalkeeper-select');
            const selectedGK = gkSelect ? gkSelect.value : null;
            goalkeeperQuadrant.setData(currentData, selectedGK);
        }
    }
}

window.GoalkeeperStats = GoalkeeperStats;
