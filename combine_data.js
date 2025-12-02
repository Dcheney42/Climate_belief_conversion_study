const fs = require('fs');
const path = require('path');

// Helper function to read JSON file
function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return null;
    }
}

// Helper function to get all files in a directory
function getFilesInDirectory(dirPath) {
    try {
        return fs.readdirSync(dirPath).filter(file => file.endsWith('.json'));
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error.message);
        return [];
    }
}

// Main function to combine all data
function combineData() {
    const exportTimestamp = new Date().toISOString();
    
    // Read all participant files
    console.log('Reading participant files...');
    const participantFiles = getFilesInDirectory('data/participants');
    const participants = [];
    
    participantFiles.forEach(file => {
        const participantData = readJsonFile(path.join('data/participants', file));
        if (participantData) {
            // Transform to match uploaded format structure
            const surveyResponses = {
                age: participantData.age || null,
                gender: participantData.gender || null,
                education: participantData.education || null,
                political_affiliation: participantData.politicalAffiliation || null,
                prior_climate_belief: participantData.priorClimateBelief || null,
                current_climate_belief: participantData.currentClimateBelief || null,
                confidence_level: participantData.confidenceLevel || null,
                views_changed: participantData.viewsChanged || null,
                change_direction: participantData.changeDirection || null,
                consent_anonymised: participantData.consentAnonymised || null,
                consent_given: participantData.consentGiven || null,
                // Add placeholder fields to match uploaded format structure
                opinion_influences: null,
                overall_perspective: null,
                receptiveness_1_pre: null,
                receptiveness_2_pre: null,
                receptiveness_3_pre: null,
                receptiveness_4_pre: null,
                moral_conviction_1_pre: null,
                moral_conviction_2_pre: null,
                moral_conviction_3_pre: null,
                moral_conviction_4_pre: null,
                feelings_thermometer_pre: null
            };

            // Remove null values to keep structure clean
            Object.keys(surveyResponses).forEach(key => {
                if (surveyResponses[key] === null) {
                    delete surveyResponses[key];
                }
            });

            const transformedParticipant = {
                id: participants.length + 1, // Sequential ID
                participant_id: participantData.id,
                prolific_id: participantData.prolificId || null,
                timestamp_joined: participantData.createdAt,
                classification: determineClassification(participantData),
                classification_score: determineClassificationScore(participantData),
                survey_responses: surveyResponses,
                created_at: participantData.createdAt,
                updated_at: participantData.updatedAt || participantData.createdAt
            };
            participants.push(transformedParticipant);
        }
    });

    // Read all conversation files
    console.log('Reading conversation files...');
    const conversationFiles = getFilesInDirectory('data/conversations');
    const conversations = [];
    const sessions = [];
    const allMessages = [];
    let messageId = 1;

    conversationFiles.forEach(file => {
        const conversationData = readJsonFile(path.join('data/conversations', file));
        if (conversationData) {
            // Transform conversation
            const transformedConversation = {
                id: conversations.length + 1,
                session_id: `sess_${conversationData.id.substring(0, 8)}`,
                conversation_metadata: {
                    total_messages: conversationData.messages ? conversationData.messages.length : 0,
                    completion_reason: conversationData.endedAt ? "completed" : "in_progress",
                    messages_per_participant: {},
                    conversation_duration_seconds: conversationData.durationSeconds
                },
                total_messages: conversationData.messages ? conversationData.messages.length : 0,
                last_updated: conversationData.endedAt || conversationData.startedAt,
                created_at: conversationData.startedAt,
                updated_at: conversationData.endedAt || conversationData.startedAt
            };

            // Create session
            const session = {
                id: sessions.length + 1,
                session_id: `sess_${conversationData.id.substring(0, 8)}`,
                timestamp_start: conversationData.startedAt,
                timestamp_end: conversationData.endedAt,
                participants: [conversationData.participantId],
                pairing_time_seconds: 0, // Not available in source data
                conversation_duration_seconds: conversationData.durationSeconds,
                status: conversationData.endedAt ? "ended" : "active",
                completion_status: conversationData.endedAt ? "completed" : "in_progress",
                message_count: conversationData.messages ? conversationData.messages.length : 0,
                connected_participants: [conversationData.participantId],
                participant_names: {
                    [conversationData.participantId]: "Participant"
                },
                created_at: conversationData.startedAt,
                updated_at: conversationData.endedAt || conversationData.startedAt
            };

            // Transform messages
            if (conversationData.messages) {
                conversationData.messages.forEach((message, index) => {
                    if (message.role !== 'system') { // Skip system messages
                        const transformedMessage = {
                            id: messageId++,
                            session_id: `sess_${conversationData.id.substring(0, 8)}`,
                            sender: message.role === 'user' ? conversationData.participantId : 'assistant',
                            message: message.content,
                            character_count: message.content.length,
                            timestamp: conversationData.startedAt, // Approximation
                            created_at: conversationData.startedAt
                        };
                        allMessages.push(transformedMessage);
                    }
                });
            }

            conversations.push(transformedConversation);
            sessions.push(session);
        }
    });

    // Read all end-survey files  
    console.log('Reading end-survey files...');
    const endSurveyFiles = getFilesInDirectory('data/end-surveys');
    const exitSurveys = [];

    endSurveyFiles.forEach(file => {
        const surveyData = readJsonFile(path.join('data/end-surveys', file));
        if (surveyData) {
            const responses = {
                summary_confidence: surveyData.summaryConfidence || null,
                final_confidence_level: surveyData.finalConfidenceLevel || null,
                // Add placeholder fields to match uploaded format
                other_respectfulness: null,
                receptiveness_1_post: null,
                receptiveness_2_post: null,
                receptiveness_3_post: null,
                receptiveness_4_post: null,
                moral_conviction_1_post: null,
                moral_conviction_2_post: null,
                moral_conviction_3_post: null,
                moral_conviction_4_post: null,
                feelings_thermometer_post: null
            };

            // Remove null values to keep structure clean
            Object.keys(responses).forEach(key => {
                if (responses[key] === null) {
                    delete responses[key];
                }
            });

            const transformedSurvey = {
                id: exitSurveys.length + 1,
                participant_id: surveyData.participantId,
                survey_data: {
                    responses: responses,
                    timestamp: surveyData.createdAt,
                    session_id: null, // Not available in source data
                    prolific_id: null, // Not available in source data
                    participant_id: surveyData.participantId
                },
                submitted_at: surveyData.createdAt,
                created_at: surveyData.createdAt
            };
            exitSurveys.push(transformedSurvey);
        }
    });

    // Calculate totals
    const totals = {
        participants: participants.length,
        conversations: conversations.length,
        sessions: sessions.length,
        exit_surveys: exitSurveys.length,
        messages: allMessages.length
    };

    // Create final combined structure
    const combinedData = {
        exported_at: exportTimestamp,
        totals: totals,
        data: {
            participants: participants,
            conversations: conversations,
            sessions: sessions,
            exit_surveys: exitSurveys,
            messages: allMessages
        }
    };

    return combinedData;
}

// Helper functions for classification
function determineClassification(participant) {
    if (participant.changeDirection) {
        if (participant.changeDirection.includes('sceptic') || participant.changeDirection.includes('skeptic')) {
            return participant.changeDirection.includes('to climate sceptic') ? 'anti_climate' : 'pro_climate';
        }
        if (participant.changeDirection.includes('believer')) {
            return participant.changeDirection.includes('to climate believer') ? 'pro_climate' : 'anti_climate';
        }
    }
    return 'neutral';
}

function determineClassificationScore(participant) {
    // Simple scoring based on available data
    if (participant.confidenceLevel) {
        if (participant.confidenceLevel >= 7) return 6;
        if (participant.confidenceLevel >= 5) return 4;
        return 2;
    }
    return 4; // Default neutral score
}

// Run the combination
console.log('Starting data combination...');
const result = combineData();

// Write the combined data to a file
const outputPath = 'research-data-export.json';
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

console.log(`\nData combination complete!`);
console.log(`Combined data written to: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`- Participants: ${result.totals.participants}`);
console.log(`- Conversations: ${result.totals.conversations}`);
console.log(`- Sessions: ${result.totals.sessions}`);
console.log(`- Exit Surveys: ${result.totals.exit_surveys}`);
console.log(`- Messages: ${result.totals.messages}`);