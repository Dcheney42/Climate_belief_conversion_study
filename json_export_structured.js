const fs = require('fs');
const path = require('path');

/**
 * Creates a structured JSON export matching the ChatGPT-generated format
 * Maps current webapp data to the organized structure provided
 */

// Read the current research data export
const currentDataPath = path.join(__dirname, 'research-data-export.json');
const currentData = JSON.parse(fs.readFileSync(currentDataPath, 'utf8'));

// Function to map participant data to structured format
function mapParticipantToStructuredFormat(participant, conversations, sessions, exitSurveys, messages) {
  const responses = participant.survey_responses || {};
  
  // Find exit survey data for this participant
  const exitSurvey = exitSurveys.find(survey => survey.participant_id === participant.participant_id);
  const exitResponses = exitSurvey?.survey_data?.responses || {};
  
  // Find conversation data for this participant
  const participantSessions = sessions.filter(session => 
    session.participants && session.participants.includes(participant.participant_id)
  );
  
  // Find messages for this participant
  const participantMessages = [];
  participantSessions.forEach(session => {
    const sessionMessages = messages.filter(msg => msg.session_id === session.session_id);
    participantMessages.push(...sessionMessages);
  });

  // Build structured format
  const structured = {
    participant_id: participant.participant_id,
    prolific_id: participant.prolific_id,
    consent: responses.consent_given || null,
    disqualified: false, // Assume not disqualified if they have data
    timestamp_joined: participant.timestamp_joined,
    
    demographics: {
      age: responses.age || null,
      gender: responses.gender || null,
      education: responses.education || null
    },
    
    belief_change: {
      has_changed_mind: responses.views_changed === "Yes",
      previous_view_example: responses.change_direction || null,
      current_view: responses.current_views || null, // From views.html textarea
      elaboration: responses.elaboration || null, // From views.html elaboration textarea
      ai_summary: responses.ai_summary_generated || responses.AI_Summary_Views || null,
      ai_confidence_slider: responses.confidence_level !== "N/a" ? responses.confidence_level : null,
      ai_summary_accuracy: responses.ai_accurate || null
    },
    
    views_matrix: {
      climate_change_views: extractClimateChangeViews(responses),
      political_views: extractPoliticalViews(responses)
    },
    
    chatbot_interaction: {
      messages: mapChatbotMessages(participantMessages, participant.participant_id)
    },
    
    post_chat: {
      final_belief_confidence: exitResponses.final_confidence_level !== "N/a" ? exitResponses.final_confidence_level : null,
      chatbot_summary_accuracy: responses.summary_accurate || null // From chatbot-summary-validation.html
    },
    
    timestamps: {
      started: participant.timestamp_joined,
      completed: participant.updated_at
    },
    
    // Additional metadata
    classification: participant.classification,
    classification_score: participant.classification_score,
    attention_check_passed: responses.attention_check_passed || null,
    session_count: participantSessions.length,
    total_messages: participantMessages.length
  };

  return structured;
}

// Extract climate change views from matrix responses
function extractClimateChangeViews(responses) {
  const climateViews = {};
  
  // Map all ccs_ (Climate Change Skepticism) items
  for (let i = 1; i <= 12; i++) {
    const rawKey = `ccs_${i.toString().padStart(2, '0')}_raw`;
    const scoredKey = `ccs_${i.toString().padStart(2, '0')}_scored`;
    
    if (responses[rawKey] !== undefined) {
      climateViews[`q${i}`] = responses[rawKey];
    }
    if (responses[scoredKey] !== undefined) {
      climateViews[`q${i}_scored`] = responses[scoredKey];
    }
  }
  
  // Add attention check
  if (responses.attention_check_value !== undefined) {
    climateViews.attention_check = responses.attention_check_value;
  }
  
  // Add mean scores
  if (responses.ccs_mean_scored !== undefined) {
    climateViews.overall_mean = responses.ccs_mean_scored;
  }
  
  // Add subscale means
  if (responses.ccs_occurrence_mean !== undefined) {
    climateViews.occurrence_mean = responses.ccs_occurrence_mean;
  }
  if (responses.ccs_causation_mean !== undefined) {
    climateViews.causation_mean = responses.ccs_causation_mean;
  }
  if (responses.ccs_seriousness_mean !== undefined) {
    climateViews.seriousness_mean = responses.ccs_seriousness_mean;
  }
  if (responses.ccs_efficacy_mean !== undefined) {
    climateViews.efficacy_mean = responses.ccs_efficacy_mean;
  }
  if (responses.ccs_trust_mean !== undefined) {
    climateViews.trust_mean = responses.ccs_trust_mean;
  }
  
  return climateViews;
}

// Extract political views from responses
function extractPoliticalViews(responses) {
  const politicalViews = {};
  
  if (responses.economic_issues !== undefined) {
    politicalViews.economic = responses.economic_issues;
  }
  if (responses.social_issues !== undefined) {
    politicalViews.social = responses.social_issues;
  }
  if (responses.political_affiliation !== undefined) {
    politicalViews.general = responses.political_affiliation;
  }
  
  return politicalViews;
}

// Map chatbot messages to structured format
function mapChatbotMessages(messagesList, participantId) {
  return messagesList.map(msg => ({
    sender: msg.sender === participantId ? "participant" : "chatbot",
    text: msg.message,
    timestamp: msg.timestamp,
    character_count: msg.character_count || null
  })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Function to create the structured export
function createStructuredExport() {
  const participants = currentData.data.participants;
  const conversations = currentData.data.conversations;
  const sessions = currentData.data.sessions;
  const exitSurveys = currentData.data.exit_surveys;
  const messages = currentData.data.messages;
  
  const structuredParticipants = participants.map(participant => 
    mapParticipantToStructuredFormat(participant, conversations, sessions, exitSurveys, messages)
  );
  
  const structuredData = {
    exported_at: new Date().toISOString(),
    study_info: {
      title: "Climate Belief Conversion Narratives Study",
      version: "structured_export_v1.0",
      export_format: "chatgpt_optimized"
    },
    totals: {
      participants: currentData.totals.participants,
      with_conversations: currentData.totals.conversations,
      with_exit_surveys: currentData.totals.exit_surveys,
      total_messages: currentData.totals.messages
    },
    participants: structuredParticipants,
    
    // Keep raw data sections for reference
    raw_data: {
      conversations: currentData.data.conversations,
      sessions: currentData.data.sessions,
      exit_surveys: currentData.data.exit_surveys
    }
  };

  return structuredData;
}

// Create the structured export
const structuredExport = createStructuredExport();

// Write to file
const outputPath = path.join(__dirname, 'exports', 'structured-research-data-export.json');

// Ensure exports directory exists
const exportsDir = path.dirname(outputPath);
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Write the structured data
fs.writeFileSync(outputPath, JSON.stringify(structuredExport, null, 2));

console.log('Structured research data export created successfully!');
console.log(`Output file: ${outputPath}`);
console.log(`Total participants: ${structuredExport.totals.participants}`);
console.log(`Participants with conversations: ${structuredExport.totals.with_conversations}`);
console.log(`Participants with exit surveys: ${structuredExport.totals.with_exit_surveys}`);
console.log(`Total messages: ${structuredExport.totals.total_messages}`);

// Show sample participant structure
if (structuredExport.participants.length > 0) {
  console.log('\nSample structured participant:');
  console.log(JSON.stringify(structuredExport.participants[0], null, 2));
}

// Show field mapping summary
console.log('\n=== FIELD MAPPING SUMMARY ===');
console.log('Basic Info: participant_id, prolific_id, consent, disqualified, timestamp_joined');
console.log('Demographics: age, gender, education');
console.log('Belief Change: has_changed_mind, previous_view_example, current_view, elaboration, ai_summary, ai_confidence_slider, ai_summary_accuracy');
console.log('Views Matrix: climate_change_views (q1-q12 + subscales), political_views (economic, social, general)');
console.log('Chatbot Interaction: messages array with sender, text, timestamp');
console.log('Post Chat: final_belief_confidence, chatbot_summary_accuracy');
console.log('Timestamps: started, completed');
console.log('Additional: classification, classification_score, attention_check_passed, session_count, total_messages');