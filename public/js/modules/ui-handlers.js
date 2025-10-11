/**
 * UI Management Module
 * Handles DOM manipulation and user interface interactions
 */
class UIManager {
    static showStatus(message, type) {
        const status = document.getElementById('status');
        if (status) {
            status.textContent = message;
            status.className = `status ${type}`;
            status.style.display = 'block';
        }
    }

    static showPreview(data) {
        // Preview functionality removed for simplified UI
        return;
    }

    static showGameInfo(csvData) {
        const gameInfo = document.getElementById('gameInfo');
        if (gameInfo) {
            gameInfo.style.display = 'block';
        }

        // Auto-fill date if available from CSV
        if (csvData && csvData.length > 1) {
            const dateFromCSV = csvData[1][0].replace(/"/g, '');
            const gameDate = document.getElementById('gameDate');
            if (gameDate) {
                gameDate.value = dateFromCSV;
            }

            // Auto-fill game name from team names
            const team1 = csvData[1][1].replace(/"/g, '');
            const team2 = csvData[1][2].replace(/"/g, '');
            const gameName = document.getElementById('gameName');
            if (gameName) {
                gameName.value = `${team1} vs ${team2}`;
            }
        }
    }

    static updateStats(stats) {
        const shotCountElement = document.getElementById('shotCount');
        const simpleStatsElement = document.getElementById('simpleStats');

        if (shotCountElement) {
            shotCountElement.textContent = stats.totalShots;
        }
        if (simpleStatsElement) {
            simpleStatsElement.style.display = 'block';
        }
    }

    static setupFileUpload(handleFileCallback) {
        const uploadSection = document.getElementById('uploadSection');
        const fileInput = document.getElementById('fileInput');

        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.classList.add('dragover');
        });

        uploadSection.addEventListener('dragleave', () => {
            uploadSection.classList.remove('dragover');
        });

        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileCallback(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileCallback(e.target.files[0]);
            }
        });
    }

    static validateGameInput() {
        const gameNameElement = document.getElementById('gameName');
        const gameDateElement = document.getElementById('gameDate');

        if (!gameNameElement || !gameDateElement) {
            UIManager.showStatus('Form elements not found', 'error');
            return null;
        }

        const gameName = gameNameElement.value.trim();
        const gameDate = gameDateElement.value;

        if (!gameName) {
            UIManager.showStatus('Please enter a game name', 'error');
            return null;
        }

        if (!gameDate) {
            UIManager.showStatus('Please select a game date', 'error');
            return null;
        }

        return { gameName, gameDate };
    }

    static getGameInputValues() {
        const gameNameElement = document.getElementById('gameName');
        const gameDateElement = document.getElementById('gameDate');

        if (!gameNameElement || !gameDateElement) return null;

        const gameName = gameNameElement.value.trim();
        const gameDate = gameDateElement.value;

        if (!gameName || !gameDate) return null;

        return { gameName, gameDate };
    }

    static showDuplicateWarning(stats, importPlan, existingGameId) {
        this.hideDuplicateWarning();

        if (stats.duplicates === 0 && !existingGameId) return;

        const gameInfo = document.getElementById('gameInfo');
        const warningHtml = this.createDuplicateWarningHTML(stats, importPlan, existingGameId);

        const warningDiv = document.createElement('div');
        warningDiv.id = 'duplicateWarning';
        warningDiv.innerHTML = warningHtml;

        gameInfo.appendChild(warningDiv);
    }

    static createDuplicateWarningHTML(stats, importPlan, existingGameId) {
        if (stats.duplicates === 0 && existingGameId) {
            return `
                <div class="duplicate-summary">
                    <h4>Game Already Exists</h4>
                    <p>This game already exists in the database. New shots will be added to the existing game.</p>
                    <div class="duplicate-stats">
                        <div class="duplicate-stat success">
                            <strong>${stats.total}</strong><br>
                            <small>New Shots</small>
                        </div>
                    </div>
                </div>
            `;
        }

        if (stats.duplicates > 0) {
            return `
                <div class="duplicate-warning">
                    <h4>Duplicate Data Detected</h4>
                    <p>Some shots in this CSV already exist in the database.</p>

                    <div class="duplicate-stats">
                        <div class="duplicate-stat">
                            <strong>${stats.total}</strong><br>
                            <small>Total Shots</small>
                        </div>
                        <div class="duplicate-stat success">
                            <strong>${stats.unique}</strong><br>
                            <small>New Shots</small>
                        </div>
                        <div class="duplicate-stat warning">
                            <strong>${stats.duplicates}</strong><br>
                            <small>Duplicates</small>
                        </div>
                    </div>

                    <div class="import-options">
                        <p><strong>Import Options:</strong></p>
                        <p>Only ${stats.unique} new shots will be imported. ${stats.duplicates} duplicate shots will be skipped.</p>
                    </div>
                </div>
            `;
        }

        return '';
    }

    static showDuplicateConfirmation(stats, importPlan, onConfirm) {
        const warningDiv = document.getElementById('duplicateWarning');
        if (!warningDiv) return;

        const confirmationHtml = `
            <div class="duplicate-actions">
                <button class="btn-warning" onclick="this.parentElement.nextElementSibling()">
                    Import ${stats.unique} New Shots Only
                </button>
                <button class="btn-secondary" onclick="UIManager.hideDuplicateWarning()">
                    Cancel Import
                </button>
            </div>
        `;

        const actionsDiv = document.createElement('div');
        actionsDiv.innerHTML = confirmationHtml;

        const importBtn = actionsDiv.querySelector('.btn-warning');
        importBtn.onclick = () => {
            onConfirm();
        };

        warningDiv.appendChild(actionsDiv);
    }

    static hideDuplicateWarning() {
        const warningDiv = document.getElementById('duplicateWarning');
        if (warningDiv) {
            warningDiv.remove();
        }
    }

    static disableImportButton() {
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.classList.add('loading');
        }
    }

    static enableImportButton() {
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.classList.remove('loading');
        }
    }

    static showImportSuccess(details) {
        this.hideImportSuccess();

        const gameInfo = document.getElementById('gameInfo');
        const successHtml = `
            <div class="import-success" id="importSuccess">
                <div class="success-icon">✓</div>
                <h3>Import Successful!</h3>
                <div class="success-details">
                    <strong>${details.gameName}</strong><br>
                    ${details.isNewGame ? 'New game created' : 'Added to existing game'}<br>
                    ${details.totalImported} shots imported
                    ${details.totalSkipped > 0 ? `<br>${details.totalSkipped} duplicates skipped` : ''}
                </div>
                <div class="success-details" style="margin-top: 15px;">
                    Database file updated successfully
                </div>
            </div>
        `;

        const successDiv = document.createElement('div');
        successDiv.innerHTML = successHtml;
        gameInfo.appendChild(successDiv.firstElementChild);

        setTimeout(() => {
            this.hideImportSuccess();
        }, 5000);
    }

    static hideImportSuccess() {
        const successDiv = document.getElementById('importSuccess');
        if (successDiv) {
            successDiv.remove();
        }
    }
}