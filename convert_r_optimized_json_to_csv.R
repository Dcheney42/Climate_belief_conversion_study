# Climate Belief Conversion Study - R-Optimized JSON to CSV Converter
# This script converts the R-optimized JSON export to CSV files for analysis
#
# INSTRUCTIONS:
# 1. First run: node create_r_optimized_export.js
# 2. Then run this R script to convert JSON to CSV
# 3. Make sure you have required packages: jsonlite, dplyr, readr

# Load required libraries
required_packages <- c("jsonlite", "dplyr", "readr", "tidyr")

for (pkg in required_packages) {
  if (!require(pkg, character.only = TRUE)) {
    install.packages(pkg)
    library(pkg, character.only = TRUE)
  }
}

# Define input and output paths
json_file <- "exports/r-optimized-export.json"
output_dir <- "exports/csv"

# Check if input file exists
if (!file.exists(json_file)) {
  stop("❌ JSON file not found: ", json_file, 
       "\nPlease run: node create_r_optimized_export.js")
}

# Create output directory if it doesn't exist
if (!dir.exists(output_dir)) {
  dir.create(output_dir, recursive = TRUE)
  cat("📁 Created output directory:", output_dir, "\n")
}

cat("🚀 Converting R-Optimized JSON to CSV\n")
cat("=====================================\n\n")

# Read the JSON data
cat("📖 Reading JSON file:", json_file, "\n")
data <- fromJSON(json_file)

# Extract data tables
participants_data <- data$data_tables$participants
messages_data <- data$data_tables$messages

cat("📊 Processing data:\n")
cat("   •", length(participants_data), "participants\n")
cat("   •", nrow(messages_data), "messages\n\n")

# Convert participants data to dataframe
cat("🔄 Converting participants data...\n")
participants_df <- as.data.frame(participants_data)

# Handle any list columns that might need special treatment
list_columns <- sapply(participants_df, is.list)
if (any(list_columns)) {
  cat("   ⚠️  Converting list columns to character strings...\n")
  for (col_name in names(participants_df)[list_columns]) {
    participants_df[[col_name]] <- sapply(participants_df[[col_name]], function(x) {
      if (is.null(x) || length(x) == 0) {
        return(NA)
      } else if (length(x) == 1) {
        return(as.character(x))
      } else {
        return(paste(x, collapse = ","))
      }
    })
  }
}

# Convert messages data to dataframe
cat("🔄 Converting messages data...\n")
messages_df <- as.data.frame(messages_data)

# Write CSV files
cat("💾 Writing CSV files...\n")

# Write participants CSV
participants_file <- file.path(output_dir, "participants.csv")
write_csv(participants_df, participants_file)
cat("   ✅ Participants:", participants_file, "\n")

# Write messages CSV
messages_file <- file.path(output_dir, "messages.csv")
write_csv(messages_df, messages_file)
cat("   ✅ Messages:", messages_file, "\n")

# Create additional themed CSV files for easier analysis

# Demographics CSV - subset with demographic data
demographics_df <- participants_df %>%
  select(
    participant_id, 
    prolific_id,
    demo_age,
    demo_gender, 
    demo_education,
    created_at
  ) %>%
  filter(!is.na(demo_age) | !is.na(demo_gender) | !is.na(demo_education))

if (nrow(demographics_df) > 0) {
  demographics_file <- file.path(output_dir, "demographics.csv")
  write_csv(demographics_df, demographics_file)
  cat("   ✅ Demographics:", demographics_file, "\n")
}

# Belief Change CSV - participants who reported belief change
belief_change_df <- participants_df %>%
  select(
    participant_id,
    prolific_id, 
    belief_has_changed_mind,
    belief_current_view,
    belief_elaboration,
    belief_ai_summary,
    belief_ai_confidence_slider,
    belief_ai_summary_accuracy,
    belief_chatbot_summary,
    post_final_belief_confidence,
    message_count
  ) %>%
  filter(belief_has_changed_mind == TRUE | !is.na(belief_current_view))

if (nrow(belief_change_df) > 0) {
  belief_change_file <- file.path(output_dir, "belief_change.csv")
  write_csv(belief_change_df, belief_change_file)
  cat("   ✅ Belief Change:", belief_change_file, "\n")
}

# Climate Views Matrix CSV - participants with climate scale responses
climate_views_df <- participants_df %>%
  select(
    participant_id,
    starts_with("ccs_"),
    -contains("json")  # Exclude JSON string versions of arrays
  ) %>%
  filter_at(vars(starts_with("ccs_") & ends_with("_raw")), any_vars(!is.na(.)))

if (nrow(climate_views_df) > 0) {
  climate_views_file <- file.path(output_dir, "views_matrix.csv")
  write_csv(climate_views_df, climate_views_file)
  cat("   ✅ Climate Views Matrix:", climate_views_file, "\n")
}

# Political Views CSV - participants with political orientation data
political_views_df <- participants_df %>%
  select(
    participant_id,
    starts_with("political_"),
    -contains("json")  # Exclude JSON string versions
  ) %>%
  filter(!is.na(political_economic_issues) | !is.na(political_social_issues))

if (nrow(political_views_df) > 0) {
  political_views_file <- file.path(output_dir, "political_views.csv")
  write_csv(political_views_df, political_views_file)
  cat("   ✅ Political Views:", political_views_file, "\n")
}

# Post-Chat Data CSV - final confidence and summary accuracy
post_chat_df <- participants_df %>%
  select(
    participant_id,
    post_final_belief_confidence,
    post_chatbot_summary_accuracy,
    belief_ai_summary_accuracy,
    timestamp_completed
  ) %>%
  filter(!is.na(post_final_belief_confidence) | !is.na(post_chatbot_summary_accuracy))

if (nrow(post_chat_df) > 0) {
  post_chat_file <- file.path(output_dir, "post_chat.csv")
  write_csv(post_chat_df, post_chat_file)
  cat("   ✅ Post-Chat:", post_chat_file, "\n")
}

# Print comprehensive summary
cat("\n📈 CONVERSION SUMMARY\n")
cat("====================\n")
cat("Input JSON:", json_file, "\n")
cat("Output directory:", output_dir, "\n\n")

cat("📊 DATASET SIZES:\n")
cat("• Total participants:", nrow(participants_df), "\n")
cat("• Total messages:", nrow(messages_df), "\n")
cat("• Demographics records:", nrow(demographics_df), "\n") 
cat("• Belief change records:", nrow(belief_change_df), "\n")
cat("• Climate views records:", nrow(climate_views_df), "\n")
cat("• Political views records:", nrow(political_views_df), "\n")
cat("• Post-chat records:", nrow(post_chat_df), "\n")

cat("\n🔍 DATA COMPLETENESS:\n")
cat("• Age provided:", sum(!is.na(participants_df$demo_age)), "/", nrow(participants_df), "\n")
cat("• Gender provided:", sum(!is.na(participants_df$demo_gender)), "/", nrow(participants_df), "\n")
cat("• Education provided:", sum(!is.na(participants_df$demo_education)), "/", nrow(participants_df), "\n")
cat("• Has changed mind:", sum(participants_df$belief_has_changed_mind, na.rm = TRUE), "/", nrow(participants_df), "\n")
cat("• Has chatbot interaction:", sum(participants_df$has_chatbot_interaction, na.rm = TRUE), "/", nrow(participants_df), "\n")
cat("• Has climate views:", sum(!is.na(participants_df$ccs_01_raw)), "/", nrow(participants_df), "\n")
cat("• Has political views:", sum(!is.na(participants_df$political_economic_issues) | !is.na(participants_df$political_social_issues)), "/", nrow(participants_df), "\n")

cat("\n📁 CSV FILES CREATED:\n")
cat("• participants.csv - Complete participant dataset (flattened)\n")
cat("• messages.csv - All chatbot conversation messages\n")
if (nrow(demographics_df) > 0) cat("• demographics.csv - Demographic information\n")
if (nrow(belief_change_df) > 0) cat("• belief_change.csv - Belief change narratives and summaries\n")
if (nrow(climate_views_df) > 0) cat("• views_matrix.csv - Climate Change Scale responses\n")
if (nrow(political_views_df) > 0) cat("• political_views.csv - Political orientation responses\n")
if (nrow(post_chat_df) > 0) cat("• post_chat.csv - Post-conversation data\n")

cat("\n🎯 R ANALYSIS TIPS:\n")
cat("• Use readr::read_csv() to read the files back into R\n")
cat("• All nested data has been flattened with underscore separators\n") 
cat("• Boolean values are TRUE/FALSE (R-compatible)\n")
cat("• Missing values are represented as NA\n")
cat("• Array data has been preserved in _json columns where needed\n")

cat("\n✅ JSON to CSV conversion completed successfully!\n")
cat("🎉 Ready for statistical analysis in R!\n")

# Show column names for key datasets
cat("\n📋 KEY COLUMN NAMES:\n")
cat("Participants columns (", ncol(participants_df), "total):\n")
cat(paste("  ", names(participants_df)[1:min(20, ncol(participants_df))], collapse = "\n"), "\n")
if (ncol(participants_df) > 20) {
  cat("  ... and", ncol(participants_df) - 20, "more columns\n")
}

cat("\nMessages columns:\n")
cat(paste("  ", names(messages_df), collapse = "\n"), "\n")