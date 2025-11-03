class GoalkeeperStats {
    constructor(app) {
        this.app = app;
    }

    updateGoalkeeperHistogram() {
        if (typeof goalkeeperHistogram === 'undefined') {
            return;
        }

        let allGamesData = null;
        try {
            const allShots = this.app.dbManager.db.exec(`SELECT * FROM shots ORDER BY game_id, time`);
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

        goalkeeperHistogram.setData(this.app.currentGameData, allGamesData);
    }
}

window.GoalkeeperStats = GoalkeeperStats;
