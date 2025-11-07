# Shot Data Import System

A clean, modern web application for importing CSV shot data into SQLite database with proper file organization.

## 📁 Project Structure

```
ffhs-visual/
├── public/                     # Public web files
│   ├── index.html             # Main HTML file
│   ├── css/                   # Stylesheets
│   │   ├── main.css          # Main application styles
│   │   ├── upload.css        # File upload component styles
│   │   ├── forms.css         # Form and input styles
│   │   └── components.css    # UI components and status messages
│   ├── js/                   # JavaScript files
│   │   ├── app.js           # Main application entry point
│   │   ├── modules/         # Core application modules
│   │   │   ├── database.js  # SQLite database management
│   │   │   └── ui-handlers.js # UI management and DOM manipulation
│   │   └── utils/           # Utility functions
│   │       └── csv-parser.js # CSV parsing utilities
│   └── assets/              # Static assets and data
│       ├── shots_database.sqlite # SQLite database file
│       └── rawdata/         # Sample CSV data
├── docs/                    # Documentation
│   └── database_uml.md     # Database schema documentation
├── dev-server.js           # Bun development server
├── package.json           # Project configuration
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh/) runtime installed

### Installation & Running

```bash
# Clone or navigate to project directory
cd ffhs-visual

# Start development server
bun run dev

# Alternative commands
bun run start
bun run serve
```

The application will be available at `http://localhost:3000`

## ✨ Features

- **🎯 Drag & Drop CSV Import** - Easy file upload interface
- **🗄️ SQLite Integration** - Persistent database storage
- **🔑 Unique ID Generation** - Auto-generated shot and game IDs
- **🏗️ Normalized Database** - Proper foreign key relationships
- **📊 Real-time Statistics** - Live shot data analysis
- **📋 Data Preview** - CSV content preview before import
- **🎮 Game Management** - Multiple games support

## 🗄️ Database Schema

The application uses a normalized SQLite database with two main tables:

- **games**: Stores game metadata (id, name, date, created_at)
- **shots**: Stores shot data with foreign key to games table

See [Database UML Documentation](docs/database_uml.md) for detailed schema information.

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database**: SQLite (browser-based with sql.js)
- **Runtime**: Bun.js
- **Architecture**: Modular, clean separation of concerns

## 📋 Usage

1. Start the development server
2. Open your browser to `http://localhost:3000`
3. Drag and drop a CSV file or use the file selector
4. Review the data preview and statistics
5. Enter game name and date
6. Click "Import to Database"
7. Database file automatically downloads

## 🏗️ Architecture

### Module Organization
- **`js/app.js`** - Main application coordinator
- **`js/modules/database.js`** - Database operations and SQLite management
- **`js/modules/ui-handlers.js`** - DOM manipulation and user interface
- **`js/utils/csv-parser.js`** - CSV parsing and data transformation

### CSS Organization
- **`css/main.css`** - Base styles and layout
- **`css/upload.css`** - File upload component
- **`css/forms.css`** - Form inputs and buttons
- **`css/components.css`** - UI components and status messages

## 🔧 Development

The project follows modern web development best practices:

- Clean separation of concerns
- Modular JavaScript architecture
- Organized CSS structure
- Proper file organization
- Documentation and comments

## 📄 License

MIT License - See package.json for details