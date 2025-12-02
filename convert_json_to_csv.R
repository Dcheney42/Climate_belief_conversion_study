# Climate Belief Conversion Study - JSON to CSV Converter
# This script converts the structured JSON export to multiple CSV files
#
# INSTRUCTIONS:
# 1. Make sure you have the required packages installed:
#    install.packages(c("jsonlite", "dplyr", "tidyr", "readr"))
# 2. Set your working directory to the project folder in RStudio
# 3. Run this script section by section or all at once

# Load required libraries
if (!require(jsonlite)) install.packages("jsonlite")
if (!require(dplyr)) install.packages("dplyr")
if (!require(tidyr)) install.packages("tidyr")
if (!require(readr)) install.packages("readr")
if (!require(purrr)) install.packages("purrr")

library(jsonlite)
library(dplyr)
library(tidyr)
library(readr)
library(purrr)

# Function to safely extract nested data
safe_extract <- function(data, field) {
  if (is.null(data[[field]]) || length(data[[field]]) == 0) {
    return(NA)
  }
  return(data[[field]])
}

# Read the structured JSON file
json_file <- "exports/structured-research-data-export.json"
cat("Reading JSON file:", json_file, "\n")

if (!file.exists(json_file)) {
  stop("JSON file not found. Please run the Node.js export script first.")
}

data <- fromJSON(json_file)
participants <- data$participants

cat("Processing", length(participants), "participants\n")

# 1. PARTICIPANTS CSV - Basic info, demographics, and belief change
cat("Creating participants CSV...\n")

# Extract data using base R approach
participants_df <- data.frame(
  participant_id = sapply(participants, function(x) x$participant_id),
  prolific_id = sapply(participants, function(x) if(is.null(x$prolific_id)) NA else x$prolific_id),
  consent = sapply(participants, function(x) if(is.null(x$consent)) NA else x$consent),
  disqualified = sapply(participants, function(x) if(is.null(x$disqualified)) FALSE else x$disqualified),
  timestamp_joined = sapply(participants, function(x) x$timestamp_joined),
  classification = sapply(participants, function(x) x$classification),
  classification_score = sapply(participants, function(x) if(is.null(x$classification_score)) NA else x$classification_score),
  attention_check_passed = sapply(participants, function(x) if(is.null(x$attention_check_passed)) NA else x$attention_check_passed),
  session_count = sapply(participants, function(x) if(is.null(x$session_count)) 0 else x$session_count),
  total_messages = sapply(participants, function(x) if(is.null(x$total_messages)) 0 else x$total_messages),
  
  # Demographics
  age = sapply(participants, function(x) if(is.null(x$demographics$age)) NA else x$demographics$age),
  gender = sapply(participants, function(x) if(is.null(x$demographics$gender)) NA else x$demographics$gender),
  education = sapply(participants, function(x) if(is.null(x$demographics$education)) NA else x$demographics$education),
  
  # Belief change
  has_changed_mind = sapply(participants, function(x) if(is.null(x$belief_change$has_changed_mind)) FALSE else x$belief_change$has_changed_mind),
  previous_view_example = sapply(participants, function(x) if(is.null(x$belief_change$previous_view_example)) NA else x$belief_change$previous_view_example),
  current_view = sapply(participants, function(x) if(is.null(x$belief_change$current_view)) NA else x$belief_change$current_view),
  elaboration = sapply(participants, function(x) if(is.null(x$belief_change$elaboration)) NA else x$belief_change$elaboration),
  ai_summary = sapply(participants, function(x) if(is.null(x$belief_change$ai_summary)) NA else x$belief_change$ai_summary),
  ai_confidence_slider = sapply(participants, function(x) if(is.null(x$belief_change$ai_confidence_slider)) NA else x$belief_change$ai_confidence_slider),
  ai_summary_accuracy = sapply(participants, function(x) if(is.null(x$belief_change$ai_summary_accuracy)) NA else x$belief_change$ai_summary_accuracy),
  
  # Post-chat
  final_belief_confidence = sapply(participants, function(x) if(is.null(x$post_chat$final_belief_confidence)) NA else x$post_chat$final_belief_confidence),
  chatbot_summary_accuracy = sapply(participants, function(x) if(is.null(x$post_chat$chatbot_summary_accuracy)) NA else x$post_chat$chatbot_summary_accuracy),
  
  # Timestamps
  started = sapply(participants, function(x) x$timestamps$started),
  completed = sapply(participants, function(x) x$timestamps$completed),
  
  stringsAsFactors = FALSE
)

# 2. CLIMATE CHANGE VIEWS CSV - Matrix responses
cat("Creating climate change views CSV...\n")

climate_views_list <- list()
for (i in seq_along(participants)) {
  p <- participants[[i]]
  climate_views <- p$views_matrix$climate_change_views
  
  if (length(climate_views) > 0) {
    climate_row <- data.frame(
      participant_id = p$participant_id,
      stringsAsFactors = FALSE
    )
    
    # Add all climate change view fields
    for (field_name in names(climate_views)) {
      climate_row[[field_name]] <- climate_views[[field_name]]
    }
    
    climate_views_list[[i]] <- climate_row
  } else {
    # Empty row for participants with no climate views data
    climate_views_list[[i]] <- data.frame(
      participant_id = p$participant_id,
      stringsAsFactors = FALSE
    )
  }
}

climate_views_df <- bind_rows(climate_views_list)

# 3. POLITICAL VIEWS CSV
cat("Creating political views CSV...\n")

political_views_list <- list()
for (i in seq_along(participants)) {
  p <- participants[[i]]
  political_views <- p$views_matrix$political_views
  
  political_row <- data.frame(
    participant_id = p$participant_id,
    economic = safe_extract(political_views, "economic"),
    social = safe_extract(political_views, "social"),
    general = safe_extract(political_views, "general"),
    stringsAsFactors = FALSE
  )
  
  political_views_list[[i]] <- political_row
}

political_views_df <- bind_rows(political_views_list)

# 4. MESSAGES CSV - Chatbot interactions
cat("Creating messages CSV...\n")

messages_list <- list()
for (i in seq_along(participants)) {
  p <- participants[[i]]
  messages <- p$chatbot_interaction$messages
  
  if (length(messages) > 0) {
    messages_df <- data.frame(
      participant_id = rep(p$participant_id, length(messages)),
      sender = sapply(messages, function(x) x$sender),
      text = sapply(messages, function(x) x$text),
      timestamp = sapply(messages, function(x) x$timestamp),
      character_count = sapply(messages, function(x) if(is.null(x$character_count)) NA else x$character_count),
      stringsAsFactors = FALSE
    )
    messages_list[[length(messages_list) + 1]] <- messages_df
  }
}

if (length(messages_list) > 0) {
  all_messages_df <- bind_rows(messages_list)
} else {
  all_messages_df <- data.frame(
    participant_id = character(0),
    sender = character(0),
    text = character(0),
    timestamp = character(0),
    character_count = numeric(0)
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
  ) %>%
  # Add political orientation average
  left_join(
    political_views_df %>%
      rowwise() %>%
      mutate(
        political_average = mean(c(economic, social, general), na.rm = TRUE)
      ) %>%
      select(participant_id, political_average),
    by = "participant_id"
  )

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
cat("Participants with demographics:", sum(!is.na(participants_df$age)), "/", nrow(participants_df), "\n")
cat("Participants with belief change:", sum(participants_df$has_changed_mind, na.rm = TRUE), "/", nrow(participants_df), "\n")
cat("Participants with AI confidence:", sum(!is.na(participants_df$ai_confidence_slider)), "/", nrow(participants_df), "\n")
cat("Participants with final confidence:", sum(!is.na(participants_df$final_belief_confidence)), "/", nrow(participants_df), "\n")
cat("Participants with messages:", sum(participants_df$total_messages > 0), "/", nrow(participants_df), "\n")

cat("\n=== FILES CREATED ===\n")
cat("• exports/csv/participants.csv - Main participant data\n")
cat("• exports/csv/climate_views_matrix.csv - Climate skepticism scale responses\n") 
cat("• exports/csv/political_views.csv - Political orientation data\n")
cat("• exports/csv/messages.csv - All chatbot conversation messages\n")
cat("• exports/csv/summary.csv - Key metrics for quick analysis\n")

cat("\nConversion completed successfully!\n")