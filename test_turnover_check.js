const initSqlJs = require('sql.js');
const fs = require('fs');

async function checkTurnovers() {
    const SQL = await initSqlJs();
    const dbBuffer = fs.readFileSync('floorball_stats.db');
    const db = new SQL.Database(dbBuffer);
    
    // Check for turnover markers that are not shots
    const result = db.exec(`
        SELECT type, COUNT(*) as count, is_turnover
        FROM corrections
        WHERE is_turnover = 1
        GROUP BY type, is_turnover
    `);
    
    console.log('Turnover markers by type in corrections:');
    if (result.length > 0) {
        console.log(result[0]);
    }
    
    // Also check shots table
    const result2 = db.exec(`
        SELECT DISTINCT type
        FROM shots
        WHERE type LIKE '%Turnover%' OR type IS NULL OR type = ''
        LIMIT 20
    `);
    
    console.log('\nShots table turnover types:');
    if (result2.length > 0) {
        console.log(result2[0]);
    }
    
    db.close();
}

checkTurnovers();
