/**
 * Duplicate Detection Utility Module
 * Handles checking for duplicate games and shots before import
 */
class DuplicateChecker {
    static generateGameHash(gameName, gameDate) {
        const normalizedName = gameName.toLowerCase().trim();
        const normalizedDate = gameDate.trim();
        return `${normalizedName}_${normalizedDate}`;
    }

    static generateShotHash(shotData) {
        // Normalize data to handle differences between CSV and database formats
        const normalize = (value) => {
            if (value === null || value === undefined) return '';
            return value.toString().replace(/"/g, '').trim();
        };

        const parts = [
            normalize(shotData.date),
            normalize(shotData.time),
            normalize(shotData.shooting_team),
            normalize(shotData.result),
            normalize(shotData.shooter),
            normalize(shotData.distance),
            normalize(shotData.angle)
        ];

        const key = parts.join('|');
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '');

        return normalizedKey;
    }

    static findDuplicateShots(csvData, existingShots) {
        const duplicates = [];
        const existingShotHashes = new Set(
            existingShots.map(shot => this.generateShotHash(shot))
        );

        Logger.duplicateCheck('Starting duplicate detection', {
            existingShotsCount: existingShots.length,
            csvRowCount: csvData.length - 1
        });

        if (existingShotHashes.size > 0) {
            Logger.duplicateCheck('Sample existing shot hashes', {
                sampleHashes: Array.from(existingShotHashes).slice(0, 3),
                sampleExistingShot: existingShots[0]
            });
        }

        for (let i = 1; i < csvData.length; i++) {
            const shotData = CSVParser.csvToShotData(csvData[i]);
            const shotHash = this.generateShotHash(shotData);

            if (i <= 3) {
                const isMatch = existingShotHashes.has(shotHash);
                Logger.duplicateCheck(`CSV row ${i} analysis`, {
                    hash: shotHash,
                    isMatch: isMatch,
                    data: {
                        date: shotData.date,
                        time: shotData.time,
                        shooting_team: shotData.shooting_team,
                        result: shotData.result,
                        shooter: shotData.shooter,
                        distance: shotData.distance,
                        angle: shotData.angle
                    }
                });
            }

            if (existingShotHashes.has(shotHash)) {
                duplicates.push({
                    rowIndex: i,
                    shotData: shotData,
                    hash: shotHash
                });
            }
        }

        Logger.duplicateCheck('Duplicate detection complete', {
            duplicatesFound: duplicates.length,
            uniqueShots: csvData.length - 1 - duplicates.length
        });
        return duplicates;
    }

    static calculateDuplicateStats(csvData, duplicates) {
        const totalShots = csvData.length - 1;
        const duplicateCount = duplicates.length;
        const uniqueShots = totalShots - duplicateCount;

        return {
            total: totalShots,
            duplicates: duplicateCount,
            unique: uniqueShots,
            duplicatePercentage: Math.round((duplicateCount / totalShots) * 100)
        };
    }

    static createImportPlan(csvData, duplicates, gameExists) {
        const duplicateRows = new Set(duplicates.map(d => d.rowIndex));
        const uniqueRows = [];

        for (let i = 1; i < csvData.length; i++) {
            if (!duplicateRows.has(i)) {
                uniqueRows.push(i);
            }
        }

        return {
            gameExists: gameExists,
            totalRows: csvData.length - 1,
            uniqueRows: uniqueRows,
            duplicateRows: Array.from(duplicateRows),
            willImport: uniqueRows.length,
            willSkip: duplicateRows.size
        };
    }
}