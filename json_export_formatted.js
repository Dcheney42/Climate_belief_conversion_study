const fs = require('fs');
const path = require('path');

/**
 * Creates a JSON export that matches the example format structure
 * but only includes fields available in the current webapp
 */

// Read the current research data export
const currentDataPath = path.join(__dirname, 'research-data-export.json');
const currentData = JSON.parse(fs.readFileSync(currentDataPath, 'utf8'));

// Function to map current participant data to example-like structure
function mapParticipantData(participant) {
  const mapped = {
    id: participant.id,
    participant_id: participant.participant_id,
    prolific_id: participant.prolific_id,
    timestamp_joined: participant.timestamp_joined,
    classification: participant.classification,
    classification_score: participant.classification_score,
    survey_responses: participant.survey_responses,
    created_at: participant.created_at,
    updated_at: participant.updated_at
  };

  // Add individual survey response fields to top level (like in example)
  // Only include fields that exist in current webapp
  const responses = participant.survey_responses || {};
  
  if (responses.age !== undefined) mapped.age = responses.age;
  if (responses.gender !== undefined) mapped.gender = responses.gender;
  if (responses.education !== undefined) mapped.education = responses.education;
  if (responses.political_affiliation !== undefined) mapped.political_affiliation = responses.political_affiliation;
  if (responses.confidence_level !== undefined) mapped.confidence_level = responses.confidence_level;
  if (responses.views_changed !== undefined) mapped.views_changed = responses.views_changed;
  if (responses.change_direction !== undefined) mapped.change_direction = responses.change_direction;
  if (responses.consent_anonymised !== undefined) mapped.consent_anonymised = responses.consent_anonymised;
  if (responses.consent_given !== undefined) mapped.consent_given = responses.consent_given;
  if (responses.prior_climate_belief !== undefined) mapped.prior_climate_belief = responses.prior_climate_belief;
  if (responses.current_climate_belief !== undefined) mapped.current_climate_belief = responses.current_climate_belief;

  return mapped;
}

// Function to create the formatted export
function createFormattedExport() {
  const formattedData = {
    exported_at: new Date().toISOString(),
    totals: currentData.totals,
    data: {
      participants: currentData.data.participants.map(mapParticipantData),
      conversations: currentData.data.conversations,
      sessions: currentData.data.sessions,
      exit_surveys: currentData.data.exit_surveys,
      messages: currentData.data.messages
    }
  };

  return formattedData;
}

// Create the formatted export
const formattedExport = createFormattedExport();

// Write to file
const outputPath = path.join(__dirname, 'exports', 'formatted-research-data-export.json');

// Ensure exports directory exists
const exportsDir = path.dirname(outputPath);
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Write the formatted data
fs.writeFileSync(outputPath, JSON.stringify(formattedExport, null, 2));

console.log('Formatted research data export created successfully!');
console.log(`Output file: ${outputPath}`);
console.log(`Total participants: ${formattedExport.totals.participants}`);
console.log(`Total conversations: ${formattedExport.totals.conversations}`);
console.log(`Total sessions: ${formattedExport.totals.sessions}`);
console.log(`Total exit surveys: ${formattedExport.totals.exit_surveys}`);
console.log(`Total messages: ${formattedExport.totals.messages}`);

// Show sample participant data structure
if (formattedExport.data.participants.length > 0) {
  console.log('\nSample participant structure:');
  console.log(JSON.stringify(formattedExport.data.participants[0], null, 2));
}