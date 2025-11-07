/**
 * CSV Parser Utility Module
 * Handles CSV file parsing and data transformation
 */
class CSVParser {
    static parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const result = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
                const char = line[j];

                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());
            result.push(values);
        }

        return result;
    }

    static csvToShotData(csvRow) {
        const cleanData = csvRow.map(cell => cell.replace(/"/g, ''));

        return {
            date: cleanData[0],
            team1: cleanData[1],
            team2: cleanData[2],
            time: cleanData[3],
            shooting_team: cleanData[4],
            result: cleanData[5],
            type: cleanData[6],
            xg: cleanData[7],
            xgot: cleanData[8],
            shooter: cleanData[9],
            passer: cleanData[10],
            t1lw: cleanData[11],
            t1c: cleanData[12],
            t1rw: cleanData[13],
            t1ld: cleanData[14],
            t1rd: cleanData[15],
            t1g: cleanData[16],
            t1x: cleanData[17],
            t2lw: cleanData[18],
            t2c: cleanData[19],
            t2rw: cleanData[20],
            t2ld: cleanData[21],
            t2rd: cleanData[22],
            t2g: cleanData[23],
            t2x: cleanData[24],
            pp: cleanData[25],
            sh: cleanData[26],
            distance: cleanData[27],
            angle: cleanData[28],
            player_team1: cleanData[29],
            player_team2: cleanData[30]
        };
    }

    static calculateStats(csvData) {
        if (csvData.length <= 1) return { totalShots: 0, goals: 0, saves: 0, blocked: 0, missed: 0 };

        let totalShots = csvData.length - 1; // Exclude header
        let goals = 0;
        let saves = 0;
        let blocked = 0;
        let missed = 0;

        for (let i = 1; i < csvData.length; i++) {
            const result = csvData[i][5].replace(/"/g, '').toLowerCase();
            if (result === 'goal') goals++;
            else if (result === 'saved') saves++;
            else if (result === 'blocked') blocked++;
            else if (result === 'missed') missed++;
        }

        return { totalShots, goals, saves, blocked, missed };
    }
}