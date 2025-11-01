// Utility functions for coordinate calculation, hash generation, and logging

export function calculateCoordinates(distance, angle) {
    const radians = (angle * Math.PI) / 180;
    const x = distance * Math.cos(radians);
    const y = distance * Math.sin(radians);
    return { x, y };
}

export function generateShotHash(shotData) {
    const hashInput = [
        shotData.time,
        shotData.period,
        shotData.shooter,
        shotData.distance,
        shotData.angle,
        shotData.result,
        shotData.type,
        shotData.t1lw,
        shotData.t1c,
        shotData.t1rw,
        shotData.t1ld,
        shotData.t1rd,
        shotData.t1g,
        shotData.t2lw,
        shotData.t2c,
        shotData.t2rw,
        shotData.t2ld,
        shotData.t2rd,
        shotData.t2g
    ].map(v => v === null || v === undefined ? '' : String(v).trim().toLowerCase())
     .join('|');

    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
        const char = hashInput.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

export async function debugLog(message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        message,
        data
    };

    console.log(`[DEBUG ${timestamp}]`, message, data);

    try {
        await fetch('http://localhost:3000/api/debug-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logEntry)
        });
    } catch (error) {
        console.error('Failed to send debug log to server:', error);
    }
}
