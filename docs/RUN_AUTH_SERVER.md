# Authentication Server - Quick Start

## Start Server
```bash
bun run auth-server.js
```

## Features

### 1. Login Protection
- **Automatic redirect**: http://localhost:3000/ → redirects to /login if not authenticated
- **Session persistence**: Stays logged in until logout

### 2. User Types

#### Admin
- **Login**: admin / changeme123
- **Access**: Full dashboard + Import + Corrections tabs
- **Hamburger menu**: Visible with:
  - Import Data
  - Dashboard
  - Corrections
  - --- (separator) ---
  - Access Tokens (opens token management)
  - Logout

#### Viewer - Season
- **Login**: Code TEST01
- **Access**: Dashboard only (all games)
- **No hamburger menu**
- **Logout button** in header

#### Viewer - Single Game
- **Login**: Code GAME01
- **Access**: Dashboard only (locked to one game)
- **No hamburger menu**
- **Game selector disabled**
- **Logout button** in header

## Token Management (Admin Only)

Access via hamburger menu → "Access Tokens"

### Features:
- Generate new access codes
- Choose type: Season or Single Game
- Assign specific game for single-game access
- View usage statistics
- Delete codes
- Copy codes to clipboard

### API Endpoints:
- `POST /api/admin/login` - Admin login
- `POST /api/code/verify` - Viewer code verification
- `POST /api/verify` - Token validation
- `GET /api/codes` - List all codes (admin)
- `POST /api/codes` - Create new code (admin)
- `DELETE /api/codes/:id` - Delete code (admin)
- `GET /api/games` - List available games

## File Structure
```
auth-server.js      - Main server with authentication
tokens.html         - Token management interface
index.html          - Your original dashboard (unchanged)
```

## Important Notes

1. **Original dashboard unchanged**: Your dashboard UI remains exactly as it was
2. **Minimal injection**: Only auth check and restrictions added
3. **No UI modifications**: Just adds/hides features based on user type
4. **Hamburger menu**: Only visible for admin users
5. **Token management**: Separate page, opens in new tab

## Troubleshooting

### Server won't start
```bash
# Kill existing servers
pkill bun

# Start fresh
bun run auth-server.js
```

### Can't login
- Check database exists: `floorball_data.sqlite`
- Default admin was created on first run
- Tokens TEST01 and GAME01 created automatically

### Token generation not working
- Must be logged in as admin
- Access via hamburger menu → "Access Tokens"
- Check browser console for errors

## Database Reset

If needed, delete database and restart server:
```bash
rm floorball_data.sqlite
bun run auth-server.js
```

This will recreate:
- Admin user (admin/changeme123)
- Sample tokens (TEST01, GAME01)