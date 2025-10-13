const fs = require('fs');
const path = require('path');

// Read the existing combined data
function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return null;
    }
}

// Transform data to new unified structure
function transformToUnifiedStructure() {
    const exportTimestamp = new Date().toISOString();
    
    // Read the existing data
    const existingData = readJsonFile('research-data-export.json');
    if (!existingData) {
        console.error('Could not read existing data file');
        return null;
    }
    
    const participants = [];
    let participantCount = 0;
    
    // Transform each participant
    existingData.data.participants.forEach(participant => {
        participantCount++;
        
        // Find related data
        const conversations = existingData.data.conversations.filter(conv => 
            existingData.data.sessions.some(session => 
                session.session_id === conv.session_id && 
                session.participants.includes(participant.participant_id)
            )
        );
        
        const messages = existingData.data.messages.filter(msg => 
            conversations.some(conv => conv.session_id === msg.session_id)
        );
        
        const exitSurvey = existingData.data.exit_surveys.find(survey => 
            survey.participant_id === participant.participant_id
        );
        
        // Extract belief change data from survey responses and change direction
        const hasChangedMind = participant.survey_responses.views_changed === 'Yes';
        const changeDirection = participant.survey_responses.change_direction;
        
        let currentView = 'neutral';
        if (changeDirection) {
            if (changeDirection.includes('to climate believer')) {
                currentView = 'believer';
            } else if (changeDirection.includes('to climate sceptic')) {
                currentView = 'skeptic';
            }
        }
        
        // Extract AI summary from conversation messages (last assistant message that contains summary)
        let aiSummary = null;
        let elaboration = null;
        
        // Find elaboration from participant messages (non "end the chat" messages)
        const participantMessages = messages.filter(msg => 
            msg.sender === participant.participant_id && 
            msg.message !== 'end the chat' &&
            !msg.message.match(/^(fvfvf|gbggbhnbgb|rggegegeg|vfvfv?)$/i)
        );
        
        if (participantMessages.length > 0) {
            elaboration = participantMessages.map(msg => msg.message).join(' ');
        }
        
        // Find AI summary from assistant messages (look for summary patterns)
        const summaryMessage = messages.filter(msg => 
            msg.sender === 'assistant' && 
            (msg.message.includes('summary') || msg.message.includes('recap') || msg.message.includes('Here\'s what I heard'))
        ).pop(); // Get the last summary message
        
        if (summaryMessage) {
            aiSummary = summaryMessage.message;
        }
        
        // Transform chatbot interactions
        const chatbotInteraction = messages.map(msg => ({
            sender: msg.sender === 'assistant' ? 'chatbot' : 'participant',
            message: msg.message,
            timestamp: msg.timestamp,
            character_count: msg.character_count
        }));
        
        // Extract views matrix data from survey responses
        // Note: The current data doesn't seem to have the matrix responses, 
        // so we'll create placeholder structure
        const viewsMatrix = {
            climate_change: {
                // Climate change skepticism scale items
                ccs_01: null, // "I am hesitant to believe that climate change scientists tell the whole story"
                ccs_02: null, // "I believe that most claims about climate change are true" (reverse)
                ccs_03: null, // "I am not sure that climate change is actually occurring"
                ccs_04: null, // "The climate change we are observing is just a natural process"
                ccs_05: null, // "Humans are largely responsible for climate change" (reverse)
                ccs_06: null, // "I doubt that human activities cause climate change"
                ccs_07: null, // "I think climate change is a serious problem" (reverse)
                ccs_08: null, // "I believe that most of the concerns about climate change have been exaggerated"
                ccs_09: null, // "I am concerned about the consequences of climate change" (reverse)
                ccs_10: null, // "There is not much we can do that will help solve environmental problems"
                ccs_11: null, // "Trying to solve environmental problems is a waste of time"
                ccs_12: null, // "Human behavior has little effect on climate change"
                attention_check: null
            },
            political: {
                economic_issues: participant.survey_responses.political_affiliation || null,
                social_issues: null // Not available in current data
            }
        };
        
        // Create unified participant object
        const unifiedParticipant = {
            participant_id: participant.participant_id,
            prolific_id: participant.prolific_id,
            consent: participant.survey_responses.consent_given || false,
            disqualified: false, // Assuming not disqualified if they have data
            demographics: {
                age: participant.survey_responses.age || null,
                gender: participant.survey_responses.gender || null,
                education: participant.survey_responses.education || null
            },
            belief_change: {
                has_changed_mind: hasChangedMind,
                current_view: currentView,
                elaboration: elaboration,
                ai_summary: aiSummary,
                ai_confidence_slider: null, // Not available in current data
                ai_summary_accuracy: null // Not available in current data
            },
            views_matrix: viewsMatrix,
            chatbot_interaction: chatbotInteraction,
            post_chat: {
                final_belief_confidence: exitSurvey ? exitSurvey.survey_data.responses.final_confidence_level : null,
                chatbot_summary_accuracy: null // Not available in current data
            },
            timestamps: {
                started: participant.created_at,
                completed: exitSurvey ? exitSurvey.submitted_at : null
            }
        };
        
        participants.push(unifiedParticipant);
    });
    
    // Create final unified structure
    const unifiedData = {
        exported_at: exportTimestamp,
        totals: {
            participants: participantCount,
            with_conversations: participants.filter(p => p.chatbot_interaction.length > 0).length,
            with_exit_surveys: participants.filter(p => p.post_chat.final_belief_confidence !== null).length,
            belief_changers: participants.filter(p => p.belief_change.has_changed_mind).length
        },
        participants: participants
    };
    
    return unifiedData;
}

// Main execution
console.log('Starting unified data transformation...');
const unifiedData = transformToUnifiedStructure();

if (unifiedData) {
    // Ensure exports directory exists
    const exportsDir = 'exports';
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    // Write the unified data to exports folder
    const outputPath = path.join(exportsDir, 'research-data-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(unifiedData, null, 2));
    
    console.log(`\nUnified data transformation complete!`);
    console.log(`Unified data written to: ${outputPath}`);
    console.log(`\nSummary:`);
    console.log(`- Total Participants: ${unifiedData.totals.participants}`);
    console.log(`- With Conversations: ${unifiedData.totals.with_conversations}`);
    console.log(`- With Exit Surveys: ${unifiedData.totals.with_exit_surveys}`);
    console.log(`- Belief Changers: ${unifiedData.totals.belief_changers}`);
} else {
    console.error('Failed to transform data');
}