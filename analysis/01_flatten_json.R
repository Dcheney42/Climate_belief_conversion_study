#!/usr/bin/env Rscript

# Climate Change Conversation Platform - JSON to CSV Flattening Script
# This script processes session JSON files and creates analysis-ready CSV exports

# Load required libraries
library(jsonlite)
library(dplyr)
library(purrr)
library(lubridate)

# Set up paths
input_dir <- "data/sessions_json"
output_dir <- "analysis_exports"

# Create output directory if it doesn't exist
if (!dir.exists(output_dir)) {
  dir.create(output_dir, recursive = TRUE)
  cat("Created output directory:", output_dir, "\n")
}

# Check if input directory exists
if (!dir.exists(input_dir)) {
  # Fallback to conversations directory if sessions_json doesn't exist
  input_dir <- "data/conversations"
  if (!dir.exists(input_dir)) {
    stop("No session data found. Expected data/sessions_json/ or data/conversations/")
  }
  cat("Using fallback directory:", input_dir, "\n")
}

# Get all JSON files
json_files <- list.files(input_dir, pattern = "\\.json$", full.names = TRUE)

if (length(json_files) == 0) {
  stop("No JSON files found in ", input_dir)
}

cat("Found", length(json_files), "JSON files to process\n")

# Initialize data frames
conversations_df <- data.frame()
individual_differences_df <- data.frame()

# Process each JSON file
for (file_path in json_files) {
  cat("Processing:", basename(file_path), "\n")
  
  tryCatch({
    # Read JSON file
    session_data <- fromJSON(file_path, flatten = FALSE)
    
    # Extract session metadata
    session_id <- session_data$id %||% tools::file_path_sans_ext(basename(file_path))
    participant_id <- session_data$participantId %||% NA
    started_at <- session_data$startedAt %||% NA
    ended_at <- session_data$endedAt %||% NA
    duration_seconds <- session_data$durationSeconds %||% NA
    
    # Convert timestamps to Australia/Brisbane timezone
    if (!is.na(started_at)) {
      started_at_brisbane <- with_tz(ymd_hms(started_at), "Australia/Brisbane")
    } else {
      started_at_brisbane <- NA
    }
    
    if (!is.na(ended_at)) {
      ended_at_brisbane <- with_tz(ymd_hms(ended_at), "Australia/Brisbane")
    } else {
      ended_at_brisbane <- NA
    }
    
    # Process messages if they exist
    if (!is.null(session_data$messages) && length(session_data$messages) > 0) {
      messages <- session_data$messages
      
      # Create conversations dataframe
      for (i in seq_len(nrow(messages))) {
        message <- messages[i, ]
        
        # Convert message timestamp
        message_timestamp <- message$timestamp %||% NA
        if (!is.na(message_timestamp)) {
          message_timestamp_brisbane <- with_tz(ymd_hms(message_timestamp), "Australia/Brisbane")
        } else {
          message_timestamp_brisbane <- NA
        }
        
        conv_row <- data.frame(
          session_id = session_id,
          participant_id = participant_id,
          message_index = i - 1,  # 0-based indexing
          role = message$role %||% NA,
          content = message$content %||% NA,
          timestamp_utc = message$timestamp %||% NA,
          timestamp_brisbane = message_timestamp_brisbane,
          session_started_at = started_at_brisbane,
          session_ended_at = ended_at_brisbane,
          session_duration_seconds = duration_seconds,
          stringsAsFactors = FALSE
        )
        
        conversations_df <- rbind(conversations_df, conv_row)
      }
    }
    
    # Try to load participant data for individual differences
    participant_data <- NULL
    if (!is.na(participant_id)) {
      participant_file <- file.path("data/participants", paste0(participant_id, ".json"))
      if (file.exists(participant_file)) {
        tryCatch({
          participant_data <- fromJSON(participant_file, flatten = TRUE)
        }, error = function(e) {
          cat("Warning: Could not read participant file for", participant_id, "\n")
        })
      }
    }
    
    # Create individual differences row
    ind_diff_row <- data.frame(
      session_id = session_id,
      participant_id = participant_id,
      started_at_utc = started_at,
      started_at_brisbane = started_at_brisbane,
      ended_at_utc = ended_at,
      ended_at_brisbane = ended_at_brisbane,
      duration_seconds = duration_seconds,
      completed = !is.na(ended_at),
      message_count = ifelse(!is.null(session_data$messages), nrow(session_data$messages), 0),
      
      # Participant demographics (if available)
      age = participant_data$age %||% NA,
      gender = participant_data$gender %||% NA,
      education = participant_data$education %||% NA,
      political_affiliation = participant_data$politicalAffiliation %||% NA,
      confidence_level = participant_data$confidenceLevel %||% NA,
      views_changed = participant_data$viewsChanged %||% NA,
      current_views = participant_data$currentViews %||% NA,
      elaboration = participant_data$elaboration %||% NA,
      ai_summary_generated = participant_data$aiSummaryGenerated %||% NA,
      ai_accurate = participant_data$aiAccurate %||% NA,
      missing_info = participant_data$missingInfo %||% NA,
      prolific_id = participant_data$prolificId %||% NA,
      consent_given = participant_data$consentGiven %||% NA,
      
      stringsAsFactors = FALSE
    )
    
    individual_differences_df <- rbind(individual_differences_df, ind_diff_row)
    
  }, error = function(e) {
    cat("Error processing", basename(file_path), ":", e$message, "\n")
  })
}

# Write output files
cat("\nWriting output files...\n")

# Conversations CSV
conversations_output <- file.path(output_dir, "conversations.csv")
write.csv(conversations_df, conversations_output, row.names = FALSE, na = "")
cat("Wrote", nrow(conversations_df), "conversation rows to", conversations_output, "\n")

# Individual differences CSV
individual_differences_output <- file.path(output_dir, "individual_differences.csv")
write.csv(individual_differences_df, individual_differences_output, row.names = FALSE, na = "")
cat("Wrote", nrow(individual_differences_df), "individual differences rows to", individual_differences_output, "\n")

# Summary statistics
cat("\n=== SUMMARY ===\n")
cat("Sessions processed:", nrow(individual_differences_df), "\n")
cat("Total messages:", nrow(conversations_df), "\n")
cat("Completed sessions:", sum(individual_differences_df$completed, na.rm = TRUE), "\n")
cat("Participants with demographics:", sum(!is.na(individual_differences_df$age)), "\n")

# Show sample of conversation data
if (nrow(conversations_df) > 0) {
  cat("\n=== SAMPLE CONVERSATION DATA ===\n")
  print(head(conversations_df[, c("session_id", "role", "message_index", "timestamp_brisbane")], 5))
}

# Show sample of individual differences data
if (nrow(individual_differences_df) > 0) {
  cat("\n=== SAMPLE INDIVIDUAL DIFFERENCES DATA ===\n")
  print(head(individual_differences_df[, c("session_id", "completed", "message_count", "views_changed")], 5))
}

cat("\nFlattening complete! Output files saved to", output_dir, "\n")