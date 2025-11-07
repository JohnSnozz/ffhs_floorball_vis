# Development Instructions

## Project Structure Guidelines

This document defines the mandatory structure and coding standards for this project. All code modifications must follow these rules.

### Folder Structure

```
project-root/
├── public/                    # All web-accessible files
│   ├── index.html            # Main HTML entry point
│   ├── css/                  # Stylesheets (modular)
│   │   ├── main.css         # Base styles and layout
│   │   ├── components.css   # Reusable UI components
│   │   ├── forms.css        # Form-specific styles
│   │   └── [feature].css    # Feature-specific styles
│   ├── js/                  # JavaScript files
│   │   ├── app.js          # Main application entry
│   │   ├── modules/        # Core application modules
│   │   │   ├── [module].js  # Single-responsibility modules
│   │   │   └── ...
│   │   └── utils/          # Utility functions
│   │       ├── [utility].js # Pure utility functions
│   │       └── ...
│   └── assets/             # Static files and data
│       ├── data/           # Database files, samples
│       ├── images/         # Image assets
│       └── ...
├── docs/                   # Documentation
├── dev-server.js          # Development server
├── package.json           # Project configuration
└── README.md             # Project documentation
```

## File Organization Rules

### JavaScript Files
- **Maximum 200 lines per file** - Split larger files into logical modules
- **Single responsibility** - Each file should have one clear purpose
- **Clear naming** - Use descriptive names (database.js, csv-parser.js, ui-manager.js)
- **Module structure**:
  - `modules/` - Core business logic (DatabaseManager, UIManager)
  - `utils/` - Pure functions and utilities (parsers, validators, helpers)
  - `app.js` - Main coordinator that ties modules together

### CSS Files
- **Maximum 150 lines per file** - Create new files for distinct features
- **Logical grouping**:
  - `main.css` - Base styles, typography, layout
  - `components.css` - Reusable UI components
  - `forms.css` - Input fields, buttons, form layouts
  - `[feature].css` - Feature-specific styles (upload.css, dashboard.css)
- **No inline styles** - All CSS must be in external files

### HTML Files
- **Clean markup** - Semantic HTML5 elements
- **External resources** - All CSS and JS in separate files
- **Organized script loading** - Libraries first, then modules, then main app

## Code Quality Standards

### Mandatory Requirements

1. **Simplicity First**
   - Write the simplest solution that works
   - Avoid over-engineering
   - Prefer clear, straightforward code over clever solutions

2. **No LLM Signatures**
   - **NO EMOJIS** in code, comments, or documentation
   - **Minimal comments** - Code should be self-explanatory
   - Avoid verbose or overly enthusiastic language
   - No excessive explanatory comments

3. **Professional Code Style**
   - Use standard naming conventions (camelCase for JS, kebab-case for CSS)
   - Keep functions small and focused
   - Avoid unnecessary abstractions
   - Write code that looks human-authored

### JavaScript Standards

```javascript
// Good - Simple and clear
class DatabaseManager {
    constructor() {
        this.db = null;
    }

    connect() {
        // Implementation
    }
}

// Bad - Over-commented and verbose
class DatabaseManager {
    constructor() {
        // Initialize the database property to null for later assignment
        this.db = null; // This will hold our database connection
    }

    // This method establishes a connection to the database
    connect() {
        // Implementation here...
    }
}
```

### CSS Standards

```css
/* Good - Clean and focused */
.upload-section {
    border: 2px dashed #ddd;
    padding: 20px;
    text-align: center;
}

/* Bad - Over-documented */
/*
 * Upload section styling
 * Creates a dashed border area for file uploads
 * Includes padding and center alignment
 */
.upload-section {
    border: 2px dashed #ddd; /* Dashed border for visual feedback */
    padding: 20px; /* Internal spacing */
    text-align: center; /* Center align content */
}
```

## File Splitting Guidelines

### When to Create New Files

**JavaScript:**
- Function count > 5 in a single class
- File length > 200 lines
- Distinct functionality (UI vs Data vs Utils)
- Different concerns (parsing vs validation vs formatting)

**CSS:**
- Style count > 50 rules
- Distinct UI areas (navigation vs content vs forms)
- Feature-specific styles
- Component libraries

### Naming Conventions

**JavaScript Files:**
- `kebab-case.js` (csv-parser.js, ui-manager.js)
- Descriptive and specific names
- Suffix indicates purpose (-manager, -parser, -validator)

**CSS Files:**
- `kebab-case.css` (main.css, upload-form.css)
- Feature or component based names
- Avoid generic names like styles.css or custom.css

## Integration Requirements

### Path References
- All paths relative to public/ folder
- CSS links in HTML head section
- JS scripts before closing body tag
- External libraries loaded before application scripts

### Module Dependencies
- Clear dependency order in HTML
- Utilities loaded before modules
- Modules loaded before main app
- No circular dependencies

## Enforcement

These rules are mandatory. Any code that violates these standards must be refactored before integration. The goal is maintainable, professional code that scales with the project.