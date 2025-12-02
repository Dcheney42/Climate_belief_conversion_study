# JSON to CSV Export Solution for Climate Belief Conversion Study

This repository contains a complete solution for exporting participant data from JSON format to CSV files optimized for statistical analysis in R.

## Files Created

### 1. JavaScript Export Script
- **`create_r_optimized_export.js`** - Generates flattened JSON optimized for R processing

### 2. R Conversion Script  
- **`convert_r_optimized_json_to_csv.R`** - Converts the optimized JSON to multiple CSV files

### 3. Generated Files
- **`exports/r-optimized-export.json`** - Flattened JSON export (14,449 lines)
- **`exports/csv/participants.csv`** - Main participant dataset (when R script is run)
- **`exports/csv/messages.csv`** - All chatbot conversation messages
- Additional themed CSV files based on available data

## Usage Instructions

### Step 1: Generate the R-Optimized JSON
```bash
node create_r_optimized_export.js
```
This creates `exports/r-optimized-export.json` with:
- 103 participants
- 591 messages  
- Flattened structure with consistent field naming
- R-compatible data types (TRUE/FALSE, NA for missing values)

### Step 2: Convert JSON to CSV in R
```r
# In R or RStudio:
source("convert_r_optimized_json_to_csv.R")
```

This will create multiple CSV files in `exports/csv/`:
- `participants.csv` - Complete participant dataset
- `messages.csv` - All conversation messages
- `demographics.csv` - Participants with demographic data
- `belief_change.csv` - Participants who reported belief change
- `views_matrix.csv` - Climate Change Scale responses
- `political_views.csv` - Political orientation data
- `post_chat.csv` - Post-conversation confidence ratings

## Key Features

### Optimized for R Analysis
- **Flattened Structure**: All nested objects flattened with underscore separators
- **Consistent Naming**: Clear, descriptive field names (e.g., `demo_age`, `belief_has_changed_mind`, `ccs_01_raw`)
- **R-Compatible Types**: Boolean values as TRUE/FALSE, missing values as null→NA
- **Multiple Tables**: Separate CSV files for different data types

### Data Structure

#### Participants Dataset (103 rows)
Key fields include:
- **Identifiers**: `participant_id`, `prolific_id`, `consent`, `disqualified`
- **Demographics**: `demo_age`, `demo_gender`, `demo_education`
- **Belief Change**: `belief_has_changed_mind`, `belief_current_view`, `belief_elaboration`
- **Climate Views**: `ccs_01_raw` through `ccs_12_raw`, `ccs_01_scored` through `ccs_12_scored`
- **Political Views**: `political_economic_issues`, `political_social_issues`
- **Post-Chat**: `post_final_belief_confidence`, `post_chatbot_summary_accuracy`
- **Metadata**: `message_count`, `has_chatbot_interaction`

#### Messages Dataset (591 rows)
- **Identifiers**: `message_id`, `participant_id`, `message_order`
- **Content**: `sender`, `text`, `character_count`
- **Metadata**: `timestamp`, `is_participant`, `is_chatbot`

## Data Summary

Based on the current export:
- **Total Participants**: 103
- **With Demographics**: 3 (limited completion)
- **With Belief Change**: 3 (reported changing mind)
- **With Chatbot Interactions**: 87 (engaged with chatbot)
- **With Climate Views**: 3 (completed scale)
- **With Political Views**: 3 (completed orientation questions)

## R Analysis Examples

```r
# Load the data
library(readr)
participants <- read_csv("exports/csv/participants.csv")
messages <- read_csv("exports/csv/messages.csv")

# Basic analysis examples
# Participants by belief change
table(participants$belief_has_changed_mind)

# Message counts by participant
summary(participants$message_count)

# Climate Change Scale means (for participants with data)
belief_changers <- participants[participants$belief_has_changed_mind == TRUE, ]
summary(belief_changers$ccs_mean_scored)

# Political orientation analysis
plot(participants$political_economic_issues, participants$political_social_issues)
```

## Field Descriptions

### Participant Fields
- **`participant_id`**: Unique participant identifier
- **`prolific_id`**: Prolific platform ID (if available)
- **`demo_age`**: Age in years
- **`demo_gender`**: Gender identity
- **`demo_education`**: Education level
- **`belief_has_changed_mind`**: Reports changing mind about climate change (boolean)
- **`belief_current_view`**: Current view on climate change (text)
- **`belief_ai_summary`**: AI-generated summary of beliefs
- **`ccs_01_raw`** through **`ccs_12_raw`**: Climate Change Scale raw scores (1-100)
- **`ccs_01_scored`** through **`ccs_12_scored`**: Scored/transformed CCS values
- **`ccs_mean_scored`**: Mean of all scored CCS items
- **`political_economic_issues`**: Economic political orientation (1-10)
- **`political_social_issues`**: Social political orientation (1-10)
- **`post_final_belief_confidence`**: Final belief confidence rating
- **`message_count`**: Number of chatbot messages exchanged

### Message Fields
- **`message_id`**: Unique message identifier
- **`participant_id`**: Participant who sent/received message
- **`message_order`**: Order within conversation
- **`sender`**: Message sender (`participant` or `chatbot`)
- **`text`**: Message content
- **`timestamp`**: Message timestamp (ISO format)
- **`character_count`**: Length of message in characters
- **`is_participant`**: Message from participant (boolean)
- **`is_chatbot`**: Message from chatbot (boolean)

## Technical Notes

### Array Handling
Arrays in the original data (like `ccs_row_order`, `political_views_order`) are:
1. Preserved as-is in the main field
2. Also converted to JSON strings in `_json` suffix fields for R compatibility

### Missing Data
- Missing values are consistently represented as `null` in JSON
- These convert to `NA` in R automatically
- Boolean fields default to `false` for missing values where appropriate

### Quality Assurance
The export scripts include:
- Data validation and type checking
- Summary statistics for verification
- Field mapping documentation
- Error handling for missing files or malformed data

---

## Quick Start

1. **Generate JSON**: `node create_r_optimized_export.js`
2. **Convert to CSV**: Run `convert_r_optimized_json_to_csv.R` in R/RStudio
3. **Analyze**: Load CSV files into R for statistical analysis

The exported data is ready for comprehensive statistical analysis, including:
- Belief change narrative analysis
- Climate Change Scale psychometric analysis  
- Political orientation correlations
- Conversation pattern analysis
- Demographic comparisons
