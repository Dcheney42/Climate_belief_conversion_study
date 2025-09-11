# Climate Change Conversation Platform - Analysis Scripts

This directory contains R scripts for processing and analyzing conversation data from the Climate Change Conversation Platform.

## Overview

The analysis scripts flatten JSON session data into structured CSV files for statistical analysis in R, Python, or other tools.

## Scripts

### `01_flatten_json.R`

Processes raw JSON session files and creates analysis-ready CSV exports.

**Input**: JSON files from conversation sessions
**Output**: Two CSV files for analysis

### `02_flatten_from_postgres.R`

Pulls session data directly from Postgres database and creates the same CSV exports.

**Input**: Live Postgres database connection
**Output**: Same two CSV files as the JSON script

## Usage

### Prerequisites

- R installed with required packages: `jsonlite`, `dplyr`, `purrr`, `lubridate`
- Session data in JSON format

### Running the Scripts

From the repository root directory:

```bash
# Process JSON files (local development)
Rscript analysis/01_flatten_json.R

# Process from Postgres database (production/live data)
Rscript analysis/02_flatten_from_postgres.R

# Using npm script for JSON processing
npm run analysis:flatten
```

**Important**: Do not change directories before running. The scripts expect to be run from the repository root.

### Setting up DATABASE_URL for Postgres Script

The `02_flatten_from_postgres.R` script requires a `DATABASE_URL` environment variable. Set this before running:

#### On Windows (Command Prompt)
```cmd
set DATABASE_URL=postgresql://username:password@host:port/database
Rscript analysis/02_flatten_from_postgres.R
```

#### On Windows (PowerShell)
```powershell
$env:DATABASE_URL="postgresql://username:password@host:port/database"
Rscript analysis/02_flatten_from_postgres.R
```

#### On macOS/Linux
```bash
export DATABASE_URL="postgresql://username:password@host:port/database"
Rscript analysis/02_flatten_from_postgres.R
```

#### Using .env file
You can also add `DATABASE_URL` to your `.env` file and load it:

```bash
# In .env file
DATABASE_URL=postgresql://username:password@host:port/database

# Load environment and run script
source .env  # Linux/macOS
Rscript analysis/02_flatten_from_postgres.R
```

**Note**: For Render deployments, the DATABASE_URL is automatically provided by the Postgres database service.

## Input Data

The script looks for JSON files in the following locations (in order of preference):

1. `data/sessions_json/` - Primary location for session data
2. `data/conversations/` - Fallback location

Each JSON file should contain session data with:
- Session metadata (id, participantId, timestamps)
- Message array with conversation history
- Optional participant demographic data

## Output Files

Both scripts generate the same two CSV files in the `analysis_exports/` directory:

### `conversations.csv`
- **One row per message**
- Columns include:
  - `session_id` - Unique session identifier
  - `participant_id` - Participant identifier  
  - `message_index` - Message order (0-based)
  - `role` - Message sender (user/assistant/system)
  - `content` - Message text content
  - `timestamp_utc` - Original UTC timestamp
  - `timestamp_brisbane` - Converted to Australia/Brisbane timezone
  - Session-level metadata (start/end times, duration)

### `individual_differences.csv`
- **One row per session/participant**
- Columns include:
  - Session metadata (id, timestamps, duration, completion status)
  - Message statistics (total count)
  - Participant demographics (age, gender, education)
  - Survey responses (political affiliation, confidence levels)
  - Belief change data (views_changed, current_views, elaboration)
  - Study metadata (prolific_id, consent status)

## Timezone Handling

All timestamps are converted from UTC to **Australia/Brisbane** timezone for analysis consistency. Both original UTC and converted Brisbane times are preserved in the output.

## Error Handling

Both scripts include robust error handling:

### JSON Script (`01_flatten_json.R`)
- Skips corrupted JSON files with warnings
- Handles missing participant data gracefully
- Provides detailed processing summary
- Shows sample data for verification

### Postgres Script (`02_flatten_from_postgres.R`)
- Validates DATABASE_URL before connecting
- Handles database connection failures gracefully
- Processes sessions even with missing related data
- Combines database columns with raw JSON data
- Provides detailed query and processing summaries

## Data Quality

The script provides summary statistics including:
- Total sessions and messages processed
- Number of completed vs. incomplete sessions
- Participant demographic coverage
- Sample data preview for verification

## Example Output Structure

```
analysis_exports/
├── conversations.csv      # Message-level data
└── individual_differences.csv  # Session/participant-level data
```

## Integration with Analysis Workflows

These CSV files are designed to integrate easily with:
- R statistical analysis workflows
- Python pandas/numpy analysis
- Statistical software (SPSS, Stata, etc.)
- Visualization tools (ggplot2, matplotlib, etc.)

The flat structure makes it easy to join datasets and perform statistical modeling on conversation patterns and individual differences.

## When to Use Which Script

### Use `01_flatten_json.R` when:
- Working with exported JSON files
- Running analysis in development environment
- Processing historical data snapshots
- Working offline or without database access

### Use `02_flatten_from_postgres.R` when:
- Analyzing live production data
- Working with large datasets that would be cumbersome as files
- Need the most up-to-date data
- Have direct database access
- Running scheduled analysis jobs

Both scripts produce identical output formats, making it easy to switch between data sources as needed.