# Authentication System Setup

## Overview

The Floorball Dashboard now includes a comprehensive authentication system with two access levels:
1. **Admin Access**: Full control over the dashboard, data import, corrections, and access code management
2. **Viewer Access**: Read-only access to dashboard statistics via 6-digit hex codes

## Initial Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Initialize Admin Account

Run the setup script to create your admin account:

```bash
bun run scripts/init-admin.js
```

This will:
- Create the admin user table
- Set up your admin username and password
- Generate sample access codes (optional)
- Create a .env file with JWT secret

### 3. Start the Secure Server

```bash
bun run server-auth.js
```

The server will run on `http://localhost:3000`

## Access the Dashboard

### Login Page

Navigate to: `http://localhost:3000/login.html`

You'll see two login options:
1. **Access Code**: For viewers with 6-digit codes
2. **Admin Login**: For administrators

### Default Admin Credentials

If you didn't run the init script, the default credentials are:
- Username: `admin`
- Password: `changeme123`

**⚠️ IMPORTANT: Change the default password immediately after first login!**

## Admin Features

### Access Code Management

Admins can manage access codes through the dashboard:

1. **Navigate to Access Codes** (via burger menu → Administration → Access Codes)
2. **Generate New Codes**:
   - Season Access: Full access to all games
   - Game Access: Limited to specific game
3. **Set Optional Restrictions**:
   - Expiration date
   - Maximum usage count
   - Description for tracking

### Code Properties

Each access code has:
- **6-digit hex code** (e.g., A1B2C3)
- **Type**: Season or Game-specific
- **Usage tracking**: Counts how many times used
- **Active/Inactive status**: Can be toggled
- **Optional expiration**: Auto-expires after set date

### Admin Panel Access

Through the burger menu (admin only), access:
- **Dashboard**: View all statistics
- **Import CSV**: Upload new game data
- **Data Corrections**: Modify existing data
- **Access Codes**: Manage viewer codes
- **Settings**: Change admin password

## Viewer Features

### Using Access Codes

1. Go to login page
2. Enter the 6-digit code provided by admin
3. Access granted based on code type:
   - **Season codes**: View all games
   - **Game codes**: View specific game only

### Viewer Restrictions

Viewers cannot:
- Access admin panel
- Import or modify data
- See navigation burger menu
- Manage access codes
- Change any settings

Viewers can only:
- View dashboard statistics
- Switch between allowed games (if season access)
- Use filter options in dashboard

## Security Features

### Password Security
- Passwords hashed with bcrypt (12 rounds)
- Never stored in plain text
- Secure password change process

### JWT Authentication
- Tokens expire after 24 hours (admin) or 8 hours (viewer)
- Secure token generation and validation
- Automatic session cleanup

### Access Control
- Role-based permissions (admin/viewer)
- Game-level access restrictions
- API endpoint protection

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/admin/login`: Admin login
- `POST /api/auth/code/verify`: Verify access code
- `GET /api/auth/verify`: Verify current session

### Admin-Only Endpoints

- `POST /api/admin/change-password`: Change admin password
- `GET /api/admin/codes`: List all access codes
- `POST /api/admin/codes`: Create new access code
- `PUT /api/admin/codes/:id`: Update access code
- `DELETE /api/admin/codes/:id`: Delete access code

### Protected Data Endpoints

- `POST /api/save-database`: Save database (admin only)
- `POST /api/debug-log`: Debug logging (admin only)

## Troubleshooting

### Forgot Admin Password

Run the init script again to reset:
```bash
bun run scripts/init-admin.js
```

### Session Expired

If you see "Unauthorized" errors:
1. Clear browser localStorage
2. Login again at `/login.html`

### Access Code Not Working

Check if:
- Code is typed correctly (case-insensitive)
- Code hasn't expired
- Usage limit not exceeded
- Code is still active

## Environment Variables

The system uses these environment variables (in `.env`):
- `JWT_SECRET`: Secret key for JWT tokens (auto-generated)
- `PORT`: Server port (default: 3000)

## Database Schema

### New Tables

**admin_users**
- id (PRIMARY KEY)
- username (UNIQUE)
- password_hash
- created_at
- last_login

**access_codes**
- id (PRIMARY KEY)
- code (UNIQUE)
- game_id (FOREIGN KEY)
- type (game/season)
- description
- created_at
- expires_at
- usage_count
- max_usage
- is_active

## Best Practices

1. **Change default password immediately**
2. **Use strong passwords** (minimum 8 characters)
3. **Set expiration dates** for temporary access codes
4. **Monitor usage counts** to detect unauthorized sharing
5. **Deactivate unused codes** instead of deleting (for audit trail)
6. **Regular password changes** for admin accounts

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify server is running with `bun run server-auth.js`
3. Ensure database file exists: `floorball_data.sqlite`
4. Check `.env` file contains JWT_SECRET