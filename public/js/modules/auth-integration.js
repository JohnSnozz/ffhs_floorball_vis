// Authentication Integration Module
class AuthIntegration {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.userType = localStorage.getItem('user_type');
        this.accessType = localStorage.getItem('access_type');
        this.gameId = localStorage.getItem('game_id');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Check if user is admin
    isAdmin() {
        return this.userType === 'admin';
    }

    // Check if user is viewer
    isViewer() {
        return this.userType === 'viewer';
    }

    // Check if user has access to specific game
    hasGameAccess(gameId) {
        if (this.isAdmin()) return true;
        if (this.accessType === 'season') return true;
        if (this.accessType === 'game' && this.gameId) {
            return parseInt(this.gameId) === parseInt(gameId);
        }
        return false;
    }

    // Get authorization headers
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Make authenticated request
    async authenticatedFetch(url, options = {}) {
        const defaultOptions = {
            headers: this.getAuthHeaders()
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        const response = await fetch(url, mergedOptions);

        // Check if unauthorized
        if (response.status === 401 || response.status === 403) {
            this.handleUnauthorized();
            throw new Error('Unauthorized');
        }

        return response;
    }

    // Handle unauthorized access
    handleUnauthorized() {
        localStorage.clear();
        window.location.href = '/login.html';
    }

    // Filter games based on access
    filterGamesForUser(games) {
        if (this.isAdmin() || this.accessType === 'season') {
            return games;
        }

        if (this.accessType === 'game' && this.gameId) {
            return games.filter(game => game.id === parseInt(this.gameId));
        }

        return [];
    }

    // Check if feature is available for user
    isFeatureAvailable(feature) {
        const adminOnlyFeatures = [
            'import',
            'corrections',
            'delete',
            'edit',
            'codeManagement',
            'settings'
        ];

        if (adminOnlyFeatures.includes(feature)) {
            return this.isAdmin();
        }

        return true;
    }

    // Apply UI restrictions
    applyUIRestrictions() {
        if (this.isViewer()) {
            // Hide admin-only elements
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = 'none';
            });

            // Disable editing capabilities
            document.querySelectorAll('.editable').forEach(el => {
                el.setAttribute('readonly', 'true');
                el.setAttribute('disabled', 'true');
            });

            // Remove delete buttons
            document.querySelectorAll('.delete-btn').forEach(el => {
                el.remove();
            });

            // Hide navigation burger
            const burger = document.querySelector('.burger-menu');
            if (burger) burger.style.display = 'none';
        }
    }

    // Save data with authentication
    async saveDatabase(dbData) {
        if (!this.isAdmin()) {
            console.warn('Only administrators can save the database');
            return false;
        }

        try {
            const response = await this.authenticatedFetch('/api/save-database', {
                method: 'POST',
                body: dbData
            });

            return response.ok;
        } catch (error) {
            console.error('Error saving database:', error);
            return false;
        }
    }

    // Log debug information with authentication
    async debugLog(message, data = null) {
        if (!this.isAdmin()) {
            console.log(message, data);
            return;
        }

        try {
            await this.authenticatedFetch('/api/debug-log', {
                method: 'POST',
                body: JSON.stringify({ message, data })
            });
        } catch (error) {
            console.error('Error logging debug info:', error);
        }
    }

    // Initialize authentication checks
    async initialize() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }

        try {
            const response = await this.authenticatedFetch('/api/auth/verify', {
                method: 'GET'
            });

            if (!response.ok) {
                this.handleUnauthorized();
                return false;
            }

            const data = await response.json();
            if (!data.valid) {
                this.handleUnauthorized();
                return false;
            }

            // Apply UI restrictions based on user type
            this.applyUIRestrictions();

            return true;
        } catch (error) {
            console.error('Authentication verification failed:', error);
            this.handleUnauthorized();
            return false;
        }
    }

    // Update session data
    updateSession(token, userType, accessType, gameId = null) {
        this.token = token;
        this.userType = userType;
        this.accessType = accessType;
        this.gameId = gameId;

        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_type', userType);
        localStorage.setItem('access_type', accessType);
        if (gameId) {
            localStorage.setItem('game_id', gameId);
        }
    }

    // Clear session
    clearSession() {
        this.token = null;
        this.userType = null;
        this.accessType = null;
        this.gameId = null;
        localStorage.clear();
    }
}

// Export for use in other modules
window.AuthIntegration = AuthIntegration;