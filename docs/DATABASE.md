# Database UML Diagram

## Shot Data Import System - Database Schema

```mermaid
erDiagram
    GAMES {
        INTEGER id PK "Primary Key, Auto-increment"
        TEXT name "NOT NULL - Game name (e.g., Team A vs Team B)"
        TEXT date "NOT NULL - Game date (YYYY-MM-DD)"
        DATETIME created_at "Default: CURRENT_TIMESTAMP"
    }

    SHOTS {
        INTEGER id PK "Primary Key, Auto-increment"
        INTEGER game_id FK "Foreign Key to games.id, NOT NULL"
        TEXT date "Shot date from CSV"
        TEXT team1 "First team name"
        TEXT team2 "Second team name"
        TEXT time "Game time when shot occurred"
        TEXT shooting_team "Team that took the shot"
        TEXT result "Shot outcome: Goal, Saved, Blocked, Missed"
        TEXT type "Shot type: Direct, One-timer, Turnover, Rebound"
        REAL xg "Expected Goals value"
        REAL xgot "Expected Goals on Target value"
        TEXT shooter "Player who took the shot"
        TEXT passer "Player who passed to shooter"
        TEXT t1lw "Team 1 Left Wing"
        TEXT t1c "Team 1 Center"
        TEXT t1rw "Team 1 Right Wing"
        TEXT t1ld "Team 1 Left Defense"
        TEXT t1rd "Team 1 Right Defense"
        TEXT t1g "Team 1 Goalie"
        TEXT t1x "Team 1 Extra player"
        TEXT t2lw "Team 2 Left Wing"
        TEXT t2c "Team 2 Center"
        TEXT t2rw "Team 2 Right Wing"
        TEXT t2ld "Team 2 Left Defense"
        TEXT t2rd "Team 2 Right Defense"
        TEXT t2g "Team 2 Goalie"
        TEXT t2x "Team 2 Extra player"
        INTEGER pp "Power Play indicator (0/1)"
        INTEGER sh "Short Handed indicator (0/1)"
        REAL distance "Shot distance from goal"
        REAL angle "Shot angle"
        INTEGER player_team1 "Team 1 player count on ice"
        INTEGER player_team2 "Team 2 player count on ice"
    }

    GAMES ||--o{ SHOTS : "has many"
```

## Relationship Details

- **One-to-Many Relationship**: One game can have many shots
- **Foreign Key Constraint**: `shots.game_id` references `games.id`
- **Referential Integrity**: Each shot must belong to a valid game

## Current Database Status

- **Games Table**: 1 record
  - Game: "Kloten-Dietlikon Jets vs Floorball Uri" (2025-09-14)
- **Shots Table**: 110 records
  - All shots belong to game_id = 1

## Key Features

1. **Unique Identifiers**: Each table has auto-incrementing primary keys
2. **Data Integrity**: Foreign key relationship ensures shots belong to valid games
3. **Comprehensive Shot Data**: Tracks player positions, shot metrics, and game state
4. **Flexible Design**: Can accommodate multiple games and their respective shots
5. **Temporal Tracking**: Games have creation timestamp for audit purposes

## Data Types

- **INTEGER**: Used for IDs, counts, and boolean flags (0/1)
- **TEXT**: Used for names, descriptions, and categorical data
- **REAL**: Used for numerical measurements (distances, angles, probabilities)
- **DATETIME**: Used for timestamps with automatic current time default

## Constraints

- **Primary Keys**: Auto-incrementing unique identifiers
- **NOT NULL**: Required fields (game name, date, game_id for shots)
- **Foreign Key**: Maintains referential integrity between games and shots
- **Default Values**: Automatic timestamp creation for games