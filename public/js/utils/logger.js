/**
 * File Logging Utility Module
 * Sends log messages to server for file storage
 */
class Logger {
    static async log(level, category, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            category,
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };

        // Also log to console for immediate debugging
        console.log(`[${level}] ${category}: ${message}`, data || '');

        try {
            await fetch('/api/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            console.error('Failed to send log to file:', error);
        }
    }

    static async info(category, message, data = null) {
        return this.log('INFO', category, message, data);
    }

    static async debug(category, message, data = null) {
        return this.log('DEBUG', category, message, data);
    }

    static async error(category, message, data = null) {
        return this.log('ERROR', category, message, data);
    }

    static async warn(category, message, data = null) {
        return this.log('WARN', category, message, data);
    }

    static async duplicateCheck(message, data = null) {
        return this.debug('DUPLICATE_CHECK', message, data);
    }

    static async import(message, data = null) {
        return this.info('IMPORT', message, data);
    }

    static async database(message, data = null) {
        return this.debug('DATABASE', message, data);
    }
}