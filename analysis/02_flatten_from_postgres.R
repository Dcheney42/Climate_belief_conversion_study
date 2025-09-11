#!/usr/bin/env Rscript

# Climate Change Conversation Platform - Postgres to CSV Flattening Script
# This script pulls session data directly from Postgres and creates analysis-ready CSV exports

# Load required libraries
library(RPostgres)
library(DBI)
library(jsonlite)
library(dplyr)
library(purrr)
library(lubridate)

# Set up paths
output_dir <- "analysis_exports"

# Create output directory if it doesn't exist
if (!dir.exists(output_dir)) {
  dir.create(output_dir, recursive = TRUE)
  cat("Created output directory:", output_dir, "\n")
}

# Get DATABASE_URL from environment
database_url <- Sys.getenv("DATABASE_URL")
if (database_url == "") {
  stop("DATABASE_URL environment variable not set. Please set it before running this script.")
}

cat("Connecting to Postgres database...\n")

# Parse DATABASE_URL (format: postgresql://user:password@host:port/dbname)
tryCatch({
  # Connect to database
  con <- dbConnect(RPostgres::Postgres(), database_url)
  cat("Successfully connected to database\n")
}, error = function(e) {
  stop("Failed to connect to database: ", e$message)
})

# Ensure we disconnect on exit
on.exit({
  if (exists("con") && dbIsValid(con)) {
    dbDisconnect(con)
    cat("Database connection closed\n")
  }
})

# Initialize data frames
conversations_df <- data.frame()
individual_differences_df <- data.frame()

tryCatch({
  # Query sessions with their related data
  cat("Querying sessions from database...\n")
  
  sessions_query <- "
    SELECT 
      s.id as session_id,
      s.participant_id,
      s.started_at,
      s.completed_at,
      s.raw as session_raw,
      s.created_at,
      s.updated_at
    FROM sessions s
    ORDER BY s.created_at DESC
  "
  
  sessions <- dbGetQuery(con, sessions_query)
  cat("Found", nrow(sessions), "sessions in database\n")
  
  if (nrow(sessions) == 0) {
    cat("No sessions found in database\n")
  } else {
    
    # Query messages
    cat("Querying messages from database...\n")
    messages_query <- "
      SELECT 
        m.session_id,
        m.turn,
        m.role,
        m.content,
        m.timestamp
      FROM messages m
      ORDER BY m.session_id, m.turn
    "
    
    messages <- dbGetQuery(con, messages_query)
    cat("Found", nrow(messages), "messages in database\n")
    
    # Query individual differences
    cat("Querying individual differences from database...\n")
    individual_diffs_query <- "
      SELECT 
        id.session_id,
        id.raw as participant_raw,
        id.political7,
        id.confidence0_100,
        id.age,
        id.gender,
        id.education,
        id.views_changed
      FROM individual_differences id
    "
    
    individual_diffs <- dbGetQuery(con, individual_diffs_query)
    cat("Found", nrow(individual_diffs), "individual differences records in database\n")
    
    # Process each session
    for (i in seq_len(nrow(sessions))) {
      session <- sessions[i, ]
      session_id <- session$session_id
      
      cat("Processing session:", session_id, "\n")
      
      tryCatch({
        # Parse the raw JSON from the session
        session_data <- fromJSON(session$session_raw, flatten = FALSE)
        
        # Extract session metadata
        participant_id <- session$participant_id
        started_at <- session$started_at
        ended_at <- session$completed_at
        
        # Calculate duration if both timestamps exist
        duration_seconds <- NA
        if (!is.na(started_at) && !is.na(ended_at)) {
          duration_seconds <- as.numeric(difftime(ended_at, started_at, units = "secs"))
        }
        
        # Convert timestamps to Australia/Brisbane timezone
        started_at_brisbane <- if (!is.na(started_at)) with_tz(started_at, "Australia/Brisbane") else NA
        ended_at_brisbane <- if (!is.na(ended_at)) with_tz(ended_at, "Australia/Brisbane") else NA
        
        # Get messages for this session
        session_messages <- messages[messages$session_id == session_id, ]
        
        # Process messages
        if (nrow(session_messages) > 0) {
          for (j in seq_len(nrow(session_messages))) {
            message <- session_messages[j, ]
            
            # Convert message timestamp
            message_timestamp_brisbane <- if (!is.na(message$timestamp)) {
              with_tz(message$timestamp, "Australia/Brisbane")
            } else {
              NA
            }
            
            conv_row <- data.frame(
              session_id = session_id,
              participant_id = participant_id,
              message_index = message$turn %||% (j - 1),  # Use turn or fallback to 0-based index
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
        
        # Get individual differences for this session
        session_ind_diff <- individual_diffs[individual_diffs$session_id == session_id, ]
        
        # Parse participant data from raw JSON if available
        participant_data <- NULL
        if (nrow(session_ind_diff) > 0 && !is.na(session_ind_diff$participant_raw[1])) {
          tryCatch({
            participant_data <- fromJSON(session_ind_diff$participant_raw[1], flatten = TRUE)
          }, error = function(e) {
            cat("Warning: Could not parse participant raw data for session", session_id, "\n")
          })
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
          message_count = nrow(session_messages),
          
          # Use database columns first, then fall back to raw JSON
          age = if (nrow(session_ind_diff) > 0) session_ind_diff$age[1] else (participant_data$age %||% NA),
          gender = if (nrow(session_ind_diff) > 0) session_ind_diff$gender[1] else (participant_data$gender %||% NA),
          education = if (nrow(session_ind_diff) > 0) session_ind_diff$education[1] else (participant_data$education %||% NA),
          political_affiliation = if (nrow(session_ind_diff) > 0) session_ind_diff$political7[1] else (participant_data$politicalAffiliation %||% NA),
          confidence_level = if (nrow(session_ind_diff) > 0) session_ind_diff$confidence0_100[1] else (participant_data$confidenceLevel %||% NA),
          views_changed = if (nrow(session_ind_diff) > 0) session_ind_diff$views_changed[1] else (participant_data$viewsChanged %||% NA),
          
          # Additional fields from raw participant data
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
        cat("Error processing session", session_id, ":", e$message, "\n")
      })
    }
  }
  
}, error = function(e) {
  cat("Error querying database:", e$message, "\n")
  stop("Database query failed")
})

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

cat("\nFlattening from Postgres complete! Output files saved to", output_dir, "\n")