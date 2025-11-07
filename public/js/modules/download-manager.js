/**
 * Download Management Module
 * Handles optional database downloads for backup purposes
 */
class DownloadManager {
    static addDownloadButton() {
        const gameInfo = document.getElementById('gameInfo');
        if (!gameInfo || document.getElementById('downloadSection')) return;

        const downloadSection = document.createElement('div');
        downloadSection.id = 'downloadSection';
        downloadSection.innerHTML = `
            <div class="download-section">
                <h4>Database Backup</h4>
                <p>Optionally download a backup copy of the database file.</p>
                <button class="btn-secondary" onclick="DownloadManager.downloadDatabase()">
                    Download Database Backup
                </button>
            </div>
        `;

        gameInfo.appendChild(downloadSection);
    }

    static async downloadDatabase() {
        try {
            if (window.app && window.app.dbManager) {
                if (window.app.dbManager.exportDatabase()) {
                    UIManager.showStatus('Database backup downloaded', 'success');
                } else {
                    UIManager.showStatus('Failed to download database backup', 'error');
                }
            }
        } catch (error) {
            console.error('Download error:', error);
            UIManager.showStatus('Failed to download database backup', 'error');
        }
    }

    static removeDownloadButton() {
        const downloadSection = document.getElementById('downloadSection');
        if (downloadSection) {
            downloadSection.remove();
        }
    }
}