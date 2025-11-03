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

class CSVImport {
    constructor(app) {
        this.app = app;
        this.currentData = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
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

                let gameName = '';
                const fileName = file.name.replace(/\.[^/.]+$/, '');
                const parts = fileName.split('_');

                if (parts.length >= 2) {
                    const team1 = parts[0];
                    const team2 = parts[1];
                    gameName = `${team1} - ${team2}`;
                    document.getElementById('game-name').value = gameName;
                    console.log('Auto-populated game name:', gameName);
                }

                if (this.currentData.data.length > 0 && this.currentData.data[0]['Date']) {
                    const csvDate = this.currentData.data[0]['Date'];
                    document.getElementById('game-date').value = csvDate;
                    console.log('Auto-populated game date:', csvDate);
                }

                this.showCSVPreview(this.currentData);
                document.getElementById('import-btn').disabled = false;
                this.app.showStatus('CSV file loaded successfully. Game name and date auto-populated. Ready to import.', 'success');
                debugLog('FILE SELECTION - Ready for import with auto-populated fields', {
                    gameName: gameName,
                    gameDate: this.currentData.data[0]['Date'] || 'not found'
                });
            } catch (error) {
                debugLog('FILE SELECTION - Error reading CSV', { error: error.message });
                this.app.showStatus(`Error reading CSV: ${error.message}`, 'error');
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
            this.app.showStatus('Please enter game name and date', 'error');
            return;
        }

        if (!this.currentData) {
            this.app.showStatus('Please select a CSV file first', 'error');
            return;
        }

        try {
            console.log('Starting import process with duplicate detection...');

            const firstRow = this.currentData.data[0];
            const team1 = firstRow['Team 1'];
            const team2 = firstRow['Team 2'];

            console.log('Loading ALL existing shots from database for duplicate check...');
            let allExistingShots = [];
            const allShotsResult = this.app.dbManager.db.exec(`SELECT * FROM shots`);
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

            const existingGameResult = this.app.dbManager.db.exec(`
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
                this.app.dbManager.db.run(`
                    INSERT INTO games (game_name, game_date, team1, team2)
                    VALUES (?, ?, ?, ?)
                `, [gameName, gameDate, team1, team2]);

                const gameResult = this.app.dbManager.db.exec("SELECT last_insert_rowid()");
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
                        const coords = this.app.calculateCoordinates(distance, angle);

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

                        this.app.dbManager.db.run(`
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
                    this.app.dbManager.db.run(`DELETE FROM games WHERE game_id = ?`, [gameId]);
                    console.log('Deleted empty game - all shots were duplicates');
                }
                this.app.showStatus(`Import aborted: All ${duplicateCount} shots already exist in database!`, 'error');
                alert(`WARNUNG: Alle ${duplicateCount} Schüsse existieren bereits in der Datenbank!\n\nDiese Datei wurde bereits importiert.`);
            } else {
                let message = isNewGame
                    ? `Created new game and imported ${uniqueCount} shots`
                    : `Added ${uniqueCount} new shots to existing game`;

                if (duplicateCount > 0) {
                    message += ` (${duplicateCount} duplicates skipped)`;
                    alert(`Import erfolgreich!\n\n${uniqueCount} neue Schüsse importiert\n${duplicateCount} Duplikate übersprungen`);
                }

                this.app.showStatus(message, 'success');
            }

            document.getElementById('game-name').value = '';
            document.getElementById('game-date').value = '';
            document.getElementById('csv-file').value = '';
            document.getElementById('file-name').textContent = '';
            document.getElementById('csv-preview').innerHTML = '';
            document.getElementById('import-btn').disabled = true;
            this.currentData = null;

            this.app.dbManager.checkDatabaseState();
            await this.app.dbManager.saveDatabaseToFile();
            await this.app.loadGamesList();
            await this.app.corrections.loadCorrectionsGamesList();

        } catch (error) {
            console.error('Import error:', error);
            this.app.showStatus(`Import failed: ${error.message}`, 'error');
        }
    }
}

window.CSVImport = CSVImport;
