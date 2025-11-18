/**
 * Main Application Module
 * Coordinates all application functionality and manages application lifecycle
 */
class ShotDataImporter {
    constructor() {
        this.csvData = null;
        this.dbManager = new DatabaseManager();
    }

    async initialize() {
        try {
            await this.dbManager.initialize();

            // Show database status
            const gameCount = this.dbManager.getGameCount();
            const shotCount = this.dbManager.getShotCount();

            if (gameCount > 0) {
                UIManager.showStatus(
                    `Database loaded successfully - ${gameCount} games, ${shotCount} shots`,
                    'success'
                );
            } else {
                UIManager.showStatus('Database initialized successfully', 'success');
            }

            this.setupEventListeners();
        } catch (error) {
            UIManager.showStatus('Failed to initialize database: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        UIManager.setupFileUpload(this.handleFile.bind(this));

        // Make functions available globally
        window.importData = this.importData.bind(this);
        window.app = this;
    }

    handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            UIManager.showStatus('Please select a CSV file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.csvData = CSVParser.parseCSV(e.target.result);
                UIManager.showPreview(this.csvData);
                UIManager.showGameInfo(this.csvData);

                const stats = CSVParser.calculateStats(this.csvData);
                UIManager.updateStats(stats);

                Logger.import('CSV file loaded successfully', {
                    filename: file.name,
                    totalShots: this.csvData.length - 1,
                    headers: this.csvData[0]
                });

                this.checkForDuplicates();
                DownloadManager.addDownloadButton();

                UIManager.showStatus(`Loaded ${this.csvData.length - 1} shots from CSV`, 'success');
            } catch (error) {
                UIManager.showStatus('Error parsing CSV: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    checkForDuplicates() {
        const gameInput = UIManager.getGameInputValues();
        if (!gameInput) return;

        const { gameName, gameDate } = gameInput;

        try {
            const existingGameId = this.dbManager.checkGameExists(gameName, gameDate);

            let existingShots = [];
            if (existingGameId) {
                existingShots = this.dbManager.getAllShotsForGame(existingGameId);
            }

            const duplicates = DuplicateChecker.findDuplicateShots(this.csvData, existingShots);
            const duplicateStats = DuplicateChecker.calculateDuplicateStats(this.csvData, duplicates);
            const importPlan = DuplicateChecker.createImportPlan(this.csvData, duplicates, !!existingGameId);

            UIManager.showDuplicateWarning(duplicateStats, importPlan, existingGameId);
        } catch (error) {
        console.warn('Error in duplicate checking:', error);
        }
    }

    async importData(forceImport = false) {
        if (!this.csvData || this.csvData.length <= 1) {
            UIManager.showStatus('No CSV data to import', 'error');
            return;
        }

        const gameInput = UIManager.validateGameInput();
        if (!gameInput) return;

        const { gameName, gameDate } = gameInput;

        try {
            UIManager.showStatus('Processing import...', 'info');
            UIManager.disableImportButton();

            const existingGameId = this.dbManager.checkGameExists(gameName, gameDate);
            let gameId = existingGameId;

            let existingShots = [];
            if (existingGameId) {
                existingShots = this.dbManager.getAllShotsForGame(existingGameId);
                Logger.database('Retrieved existing shots for game', {
                    gameId: existingGameId,
                    shotCount: existingShots.length,
                    sampleShot: existingShots.length > 0 ? existingShots[0] : null
                });
            } else {
                Logger.database('No existing game found, all shots will be new');
            }

            const duplicates = DuplicateChecker.findDuplicateShots(this.csvData, existingShots);

            if (duplicates.length > 0 && !forceImport) {
                const stats = DuplicateChecker.calculateDuplicateStats(this.csvData, duplicates);
                const importPlan = DuplicateChecker.createImportPlan(this.csvData, duplicates, !!existingGameId);

                UIManager.showDuplicateConfirmation(stats, importPlan, () => {
                    this.importData(true);
                });
                UIManager.enableImportButton();
                return;
            }

            UIManager.showStatus('Saving to database...', 'info');

            if (!gameId) {
                gameId = this.dbManager.insertGame(gameName, gameDate);
            }

            const duplicateRows = new Set(duplicates.map(d => d.rowIndex));
            const uniqueShotData = [];

            for (let i = 1; i < this.csvData.length; i++) {
                if (!duplicateRows.has(i)) {
                    uniqueShotData.push(CSVParser.csvToShotData(this.csvData[i]));
                }
            }

            const result = this.dbManager.insertShotsInBatch(gameId, uniqueShotData);

            const totalImported = result.inserted;
            const totalSkipped = duplicates.length;

            let successMessage = existingGameId
                ? `✓ Added ${totalImported} shots to existing game`
                : `✓ Imported game with ${totalImported} shots`;

            if (totalSkipped > 0) {
                successMessage += ` (${totalSkipped} duplicates skipped)`;
            }

            UIManager.showStatus('Saving to file...', 'info');

            if (await this.dbManager.saveDatabase()) {
                Logger.import('Import completed successfully', {
                    gameName,
                    gameId,
                    totalImported,
                    totalSkipped,
                    isNewGame: !existingGameId
                });

                UIManager.showImportSuccess({
                    gameName,
                    totalImported,
                    totalSkipped,
                    isNewGame: !existingGameId
                });
            } else {
                Logger.error('IMPORT', 'Database save failed after import');
                UIManager.showStatus('Import completed but file save failed', 'error');
            }

            UIManager.hideDuplicateWarning();
            UIManager.enableImportButton();

        } catch (error) {
            console.error('Import error:', error);
            UIManager.showStatus('Error importing data: ' + error.message, 'error');
            UIManager.enableImportButton();
        }
    }
}

// Initialize application when page loads
let app;
window.addEventListener('load', async () => {
    app = new ShotDataImporter();
    await app.initialize();
});