# Floorball Shot Visualization System

A comprehensive web application for analyzing and visualizing floorball shot data with advanced analytics, authentication, and interactive dashboards.

## Project Structure

```
ffhs_floorball_vis/
├── public/                         # Static web files
│   ├── index.html                 # Main application
│   ├── css/                       # Stylesheets (14 files)
│   │   ├── base.css              # Base styles
│   │   ├── dashboard.css         # Dashboard layout
│   │   ├── visualizations.css    # Chart styles
│   │   ├── corrections.css       # Data correction UI
│   │   ├── goalkeeper.css        # GK-specific styles
│   │   └── ...                   # Other component styles
│   ├── js/                       # JavaScript modules (14 files)
│   │   ├── app.js               # Main orchestrator (797 lines)
│   │   ├── database.js          # DatabaseManager class
│   │   ├── dashboard-sidebar.js # Filters and controls
│   │   ├── shotmap.js          # Hexbin visualization
│   │   ├── shothistogram.js    # xG histograms
│   │   ├── performancespider.js # Radar charts
│   │   ├── goalkeeperstats.js  # GK statistics
│   │   ├── corrections.js      # Data corrections
│   │   ├── csvimport.js       # CSV import
│   │   └── modules/            # Additional modules
│   ├── images/                  # Field images
│   │   ├── field.png           # Main field (600x1200px)
│   │   └── field_inverted.png  # Inverted field
│   └── assets/                  # Data files
│       └── rawdata/            # Sample CSV data
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md         # System architecture
│   ├── DEVELOPMENT.md          # Development guide
│   ├── DATABASE.md             # Database schema
│   ├── AUTH_SETUP.md           # Authentication setup
│   └── CLAUDE.md               # Claude Code instructions
├── dev/                        # Development files
│   ├── logs/                   # Debug logs (gitignored)
│   ├── authtest/               # Archived test files (20 files)
│   ├── projektidee/            # Project documentation
│   └── screenshots/            # UI screenshots
├── auth-server.js              # Main server with authentication (1088 lines)
├── app.js                      # Frontend application (797 lines)
├── dashboard.html              # Dashboard page
├── tokens.html                 # Admin token management
├── index.html                  # Main HTML page
├── floorball_data.sqlite       # SQLite database
├── package.json                # Dependencies
└── README.md                   # This file
```

## Features

### Core Functionality
- **Shot Data Visualization**: Interactive hexbin heatmaps with customizable bin sizes
- **Expected Goals (xG) Analysis**: Statistical shot quality analysis
- **Performance Metrics**: Spider/radar charts for player performance
- **Goalkeeper Analytics**: Dedicated GK statistics and visualizations
- **Data Corrections**: In-app data correction system with audit trail
- **CSV Import**: Bulk data import with duplicate detection

### Authentication & Security
- **JWT-based Authentication**: Secure token-based auth system
- **User Management**: Admin panel for user and token management
- **Role-based Access**: Admin and user roles
- **Persistent Sessions**: Secure cookie-based sessions

### Visualizations
1. **Shot Map**: Hexbin visualization with density heatmap
2. **xG Histogram**: Shot quality distribution
3. **Performance Spider**: Multi-metric player comparison
4. **Goalkeeper Stats**: Save percentages and positioning
5. **Player Metrics**: Individual player statistics

## Quick Start

### Prerequisites
- [Bun](https://bun.sh/) runtime installed
- Node.js (optional, for npm packages)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ffhs_floorball_vis

# Install dependencies
bun install

# Create .env file for authentication
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
echo "PORT=3000" >> .env
```

### Running the Application

```bash
# Start the authentication server (recommended)
bun run auth-server.js

# OR for development without auth
bun run server.js

# Application will be available at
# http://localhost:3000
```

### Default Login
- **Username**: admin
- **Password**: admin123
- **First login**: Change password immediately

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6), D3.js v7, d3-hexbin
- **Backend**: Bun.js server with JWT authentication
- **Database**: SQLite (in-browser via SQL.js + server-side)
- **Visualization**: D3.js for all charts and visualizations
- **Styling**: Modular CSS architecture

## Database Schema

### Main Tables
- `games`: Game metadata and aliases
- `shots`: Shot data (31 fields including xG, coordinates)
- `shot_corrections`: Data corrections with audit trail
- `users`: User accounts and authentication
- `refresh_tokens`: JWT refresh token management

### Views
- `shots_view`: Combined shots + corrections
- `shots_with_game_names`: Shots with game display names

See `docs/DATABASE.md` for complete schema documentation.

## Development Guidelines

### Adding New Features
1. **Create a new module** in `public/js/`
2. **Never add large features to app.js** - keep it as orchestrator
3. Follow the existing module pattern (ES6 classes)
4. Add styles to appropriate CSS file
5. Initialize in `app.js`

### Module Pattern
```javascript
// public/js/myfeature.js
class MyFeature {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }
    // Implementation...
}
window.MyFeature = MyFeature;
```

See `docs/DEVELOPMENT.md` for detailed guidelines.

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/verify` - Verify JWT token
- `POST /api/refresh` - Refresh JWT token

### Data Management
- `POST /api/save-database` - Save SQLite database
- `POST /api/debug-log` - Write debug logs
- `GET /api/users` - Get all users (admin only)
- `POST /api/users` - Create user (admin only)

## Deployment

### Production Setup
1. Set secure JWT_SECRET in `.env`
2. Configure proper CORS headers
3. Use HTTPS in production
4. Set up proper backup strategy for SQLite database
5. Configure rate limiting for API endpoints

### Environment Variables
```bash
JWT_SECRET=<secure-random-string>
PORT=3000
NODE_ENV=production
```

## Documentation

- `docs/ARCHITECTURE.md` - Complete system architecture
- `docs/DEVELOPMENT.md` - Development guidelines
- `docs/DATABASE.md` - Database schema details
- `docs/AUTH_SETUP.md` - Authentication configuration
- `docs/CLAUDE.md` - Claude Code instructions

## Troubleshooting

### Common Issues

1. **"Cannot find module"**: Run `bun install`
2. **Port already in use**: Change PORT in `.env`
3. **Database not saving**: Check write permissions
4. **Token expired**: Tokens expire after 15 minutes, refresh tokens after 7 days
5. **Admin panel error**: Ensure `tokens.html` is in root directory

### Debug Mode
Enable debug logging in browser console:
```javascript
window.floorballApp.debugMode = true;
```

## License

MIT License - See package.json for details

## Contributing

1. Follow existing code patterns
2. Create modules for new features
3. Keep `app.js` under 1000 lines
4. Write self-documenting code
5. Test thoroughly before committing

## Contact

For issues and questions, please open a GitHub issue.