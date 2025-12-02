# Climate Belief Conversion Study - JSON to CSV Converter
# This script converts the structured JSON export to multiple CSV files
# 
# INSTRUCTIONS FOR RSTUDIO:
# 1. Install required packages (run once):
#    install.packages(c("jsonlite", "dplyr", "tidyr", "readr"))
# 2. Set working directory to your project folder
# 3. Run this script

# Load required libraries
library(jsonlite)
library(dplyr)
library(tidyr)
library(readr)

# Read the structured JSON file
json_file <- "exports/structured-research-data-export.json"
cat("Reading JSON file:", json_file, "\n")

if (!file.exists(json_file)) {
  stop("JSON file not found. Please run: node json_export_structured.js")
}

data <- fromJSON(json_file)
participants <- data$participants

cat("Processing", length(participants), "participants\n")

# Helper function to safely extract values
safe_get <- function(obj, default = NA) {
  if (is.null(obj) || length(obj) == 0) return(default)
  return(obj)
}

# 1. PARTICIPANTS CSV - Main participant data
cat("Creating participants CSV...\n")

participants_df <- data.frame(
  participant_id = sapply(participants, function(x) safe_get(x$participant_id)),
  prolific_id = sapply(participants, function(x) safe_get(x$prolific_id)),
  consent = sapply(participants, function(x) safe_get(x$consent)),
  disqualified = sapply(participants, function(x) safe_get(x$disqualified, FALSE)),
  timestamp_joined = sapply(participants, function(x) safe_get(x$timestamp_joined)),
  classification = sapply(participants, function(x) safe_get(x$classification)),
  classification_score = sapply(participants, function(x) safe_get(x$classification_score)),
  attention_check_passed = sapply(participants, function(x) safe_get(x$attention_check_passed)),
  session_count = sapply(participants, function(x) safe_get(x$session_count, 0)),
  total_messages = sapply(participants, function(x) safe_get(x$total_messages, 0)),
  
  # Demographics
  age = sapply(participants, function(x) safe_get(x$demographics$age)),
  gender = sapply(participants, function(x) safe_get(x$demographics$gender)),
  education = sapply(participants, function(x) safe_get(x$demographics$education)),
  
  # Belief change
  has_changed_mind = sapply(participants, function(x) safe_get(x$belief_change$has_changed_mind, FALSE)),
  previous_view_example = sapply(participants, function(x) safe_get(x$belief_change$previous_view_example)),
  current_view = sapply(participants, function(x) safe_get(x$belief_change$current_view)),
  elaboration = sapply(participants, function(x) safe_get(x$belief_change$elaboration)),
  ai_summary = sapply(participants, function(x) safe_get(x$belief_change$ai_summary)),
  ai_confidence_slider = sapply(participants, function(x) safe_get(x$belief_change$ai_confidence_slider)),
  ai_summary_accuracy = sapply(participants, function(x) safe_get(x$belief_change$ai_summary_accuracy)),
  
  # Post-chat
  final_belief_confidence = sapply(participants, function(x) safe_get(x$post_chat$final_belief_confidence)),
  chatbot_summary_accuracy = sapply(participants, function(x) safe_get(x$post_chat$chatbot_summary_accuracy)),
  
  # Timestamps
  started = sapply(participants, function(x) safe_get(x$timestamps$started)),
  completed = sapply(participants, function(x) safe_get(x$timestamps$completed)),
  
  stringsAsFactors = FALSE
)

# 2. CLIMATE CHANGE VIEWS CSV - Matrix responses
cat("Creating climate change views CSV...\n")

climate_views_list <- list()
for (i in seq_along(participants)) {
  p <- participants[[i]]
  climate_views <- p$views_matrix$climate_change_views
  
  climate_row <- data.frame(
    participant_id = p$participant_id,
    stringsAsFactors = FALSE
  )
  
  # Add all climate change view fields if they exist
  if (length(climate_views) > 0) {
    for (field_name in names(climate_views)) {
      climate_row[[field_name]] <- safe_get(climate_views[[field_name]])
    }
  }
  
  climate_views_list[[i]] <- climate_row
}

climate_views_df <- bind_rows(climate_views_list)

# 3. POLITICAL VIEWS CSV
cat("Creating political views CSV...\n")

political_views_df <- data.frame(
  participant_id = sapply(participants, function(x) x$participant_id),
  economic = sapply(participants, function(x) safe_get(x$views_matrix$political_views$economic)),
  social = sapply(participants, function(x) safe_get(x$views_matrix$political_views$social)),
  general = sapply(participants, function(x) safe_get(x$views_matrix$political_views$general)),
  stringsAsFactors = FALSE
)

# 4. MESSAGES CSV - Chatbot interactions
cat("Creating messages CSV...\n")

all_messages_list <- list()
message_counter <- 1

for (i in seq_along(participants)) {
  p <- participants[[i]]
  messages <- p$chatbot_interaction$messages
  
  if (length(messages) > 0) {
    for (j in seq_along(messages)) {
      msg <- messages[[j]]
      all_messages_list[[message_counter]] <- data.frame(
        participant_id = p$participant_id,
        message_order = j,
        sender = safe_get(msg$sender),
        text = safe_get(msg$text),
        timestamp = safe_get(msg$timestamp),
        character_count = safe_get(msg$character_count),
        stringsAsFactors = FALSE
      )
      message_counter <- message_counter + 1
    }
  }
}

if (length(all_messages_list) > 0) {
  all_messages_df <- bind_rows(all_messages_list)
} else {
  all_messages_df <- data.frame(
    participant_id = character(0),
    message_order = integer(0),
    sender = character(0),
    text = character(0),
    timestamp = character(0),
    character_count = numeric(0),
    stringsAsFactors = FALSE
  )
}

# 5. SUMMARY CSV - Key metrics for analysis
cat("Creating summary CSV...\n")

summary_df <- participants_df %>%
  select(
    participant_id,
    prolific_id,
    classification,
    classification_score,
    has_changed_mind,
    age,
    gender,
    education,
    ai_confidence_slider,
    final_belief_confidence,
    session_count,
    total_messages
  )

# Add political orientation average
political_avg <- political_views_df %>%
  mutate(
    political_average = case_when(
      !is.na(economic) & !is.na(social) & !is.na(general) ~ (economic + social + general) / 3,
      !is.na(economic) & !is.na(social) ~ (economic + social) / 2,
      !is.na(economic) & !is.na(general) ~ (economic + general) / 2,
      !is.na(social) & !is.na(general) ~ (social + general) / 2,
      !is.na(economic) ~ economic,
      !is.na(social) ~ social,
      !is.na(general) ~ general,
      TRUE ~ NA_real_
    )
  ) %>%
  select(participant_id, political_average)

summary_df <- summary_df %>%
  left_join(political_avg, by = "participant_id")

# Create exports directory if it doesn't exist
if (!dir.exists("exports/csv")) {
  dir.create("exports/csv", recursive = TRUE)
}

# Export all CSV files
cat("Exporting CSV files...\n")

write_csv(participants_df, "exports/csv/participants.csv")
write_csv(climate_views_df, "exports/csv/climate_views_matrix.csv")
write_csv(political_views_df, "exports/csv/political_views.csv")
write_csv(all_messages_df, "exports/csv/messages.csv")
write_csv(summary_df, "exports/csv/summary.csv")

# Print summary statistics
cat("\n=== EXPORT SUMMARY ===\n")
cat("Participants CSV:", nrow(participants_df), "rows\n")
cat("Climate Views CSV:", nrow(climate_views_df), "rows\n")
cat("Political Views CSV:", nrow(political_views_df), "rows\n")
cat("Messages CSV:", nrow(all_messages_df), "rows\n")
cat("Summary CSV:", nrow(summary_df), "rows\n")

cat("\n=== DATA COMPLETENESS ===\n")
cat("Participants with age:", sum(!is.na(participants_df$age)), "/", nrow(participants_df), "\n")
cat("Participants who changed mind:", sum(participants_df$has_changed_mind, na.rm = TRUE), "/", nrow(participants_df), "\n")
cat("Participants with AI confidence:", sum(!is.na(participants_df$ai_confidence_slider)), "/", nrow(participants_df), "\n")
cat("Participants with final confidence:", sum(!is.na(participants_df$final_belief_confidence)), "/", nrow(participants_df), "\n")
cat("Participants with chatbot messages:", sum(participants_df$total_messages > 0), "/", nrow(participants_df), "\n")

cat("\n=== CSV FILES CREATED ===\n")
cat("• participants.csv - Main participant data with demographics and belief change\n")
cat("• climate_views_matrix.csv - Climate skepticism scale responses\n") 
cat("• political_views.csv - Political orientation responses\n")
cat("• messages.csv - All chatbot conversation messages\n")
cat("• summary.csv - Key metrics for quick analysis\n")

cat("\n✅ JSON to CSV conversion completed successfully!\n")
cat("📁 Files saved to: exports/csv/\n")

# Display first few rows of each dataset for verification
cat("\n=== SAMPLE DATA PREVIEW ===\n")
cat("Participants (first 3 rows):\n")
print(head(participants_df, 3))

cat("\nPolitical Views (first 3 rows):\n")
print(head(political_views_df, 3))

if (nrow(all_messages_df) > 0) {
  cat("\nMessages (first 3 rows):\n")
  print(head(all_messages_df, 3))
}