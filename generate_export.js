// Script to generate consolidated export file for all survey data
const fs = require('fs');
const path = require('path');

// Import utility functions from server
function writeJson(filePath, obj) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing JSON file:', error);
        return false;
    }
}

function readJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        return null;
    }
}

function generateConsolidatedExport() {
    console.log('🚀 Generating Consolidated Survey Data Export');
    console.log('============================================\n');
    
    try {
        // Define data directories
        const dataDir = path.join(__dirname, 'data');
        const participantsDir = path.join(dataDir, 'participants');
        const conversationsDir = path.join(dataDir, 'conversations');
        const exportsDir = path.join(dataDir, 'exports');
        
        // Ensure exports directory exists
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
            console.log('📁 Created exports directory');
        }
        
        const participants = [];
        const conversations = [];
        const messages = [];
        let totalMessages = 0;
        
        console.log('📖 Reading participant data...');
        
        // Read all participant files
        if (fs.existsSync(participantsDir)) {
            const participantFiles = fs.readdirSync(participantsDir);
            console.log(`   Found ${participantFiles.length} participant files`);
            
            for (const file of participantFiles) {
                if (file.endsWith('.json')) {
                    const participant = readJson(path.join(participantsDir, file));
                    if (participant) {
                        // Ensure participant has complete structure and all variables are captured
                        const completeParticipant = {
                            // Core identification
                            participant_id: participant.participant_id,
                            prolific_id: participant.prolific_id,
                            consent: participant.consent,
                            disqualified: participant.disqualified || false,
                            timestamp_joined: participant.timestamp_joined,
                            
                            // Demographics - ensure all fields are captured
                            demographics: {
                                age: participant.demographics?.age || null,
                                gender: participant.demographics?.gender || null,
                                education: participant.demographics?.education || null
                            },
                            
                            // Belief change - ensure all fields are captured
                            belief_change: {
                                has_changed_mind: participant.belief_change?.has_changed_mind || false,
                                current_view: participant.belief_change?.current_view || null,
                                elaboration: participant.belief_change?.elaboration || null,
                                ai_summary: participant.belief_change?.ai_summary || null,
                                ai_confidence_slider: participant.belief_change?.ai_confidence_slider || null,
                                ai_summary_accuracy: participant.belief_change?.ai_summary_accuracy || null,
                                chatbot_summary: participant.belief_change?.chatbot_summary || null,
                                chatbot_summary_validation: participant.belief_change?.chatbot_summary_validation || null,
                                chatbot_summary_bullets: participant.belief_change?.chatbot_summary_bullets || null
                            },
                            
                            // Views matrix - ensure ALL climate change scale variables are captured
                            views_matrix: {
                                climate_change_views: {
                                    // CCS raw values (ccs_01_raw through ccs_12_raw)
                                    ccs_01_raw: participant.views_matrix?.climate_change_views?.ccs_01_raw || null,
                                    ccs_02_raw: participant.views_matrix?.climate_change_views?.ccs_02_raw || null,
                                    ccs_03_raw: participant.views_matrix?.climate_change_views?.ccs_03_raw || null,
                                    ccs_04_raw: participant.views_matrix?.climate_change_views?.ccs_04_raw || null,
                                    ccs_05_raw: participant.views_matrix?.climate_change_views?.ccs_05_raw || null,
                                    ccs_06_raw: participant.views_matrix?.climate_change_views?.ccs_06_raw || null,
                                    ccs_07_raw: participant.views_matrix?.climate_change_views?.ccs_07_raw || null,
                                    ccs_08_raw: participant.views_matrix?.climate_change_views?.ccs_08_raw || null,
                                    ccs_09_raw: participant.views_matrix?.climate_change_views?.ccs_09_raw || null,
                                    ccs_10_raw: participant.views_matrix?.climate_change_views?.ccs_10_raw || null,
                                    ccs_11_raw: participant.views_matrix?.climate_change_views?.ccs_11_raw || null,
                                    ccs_12_raw: participant.views_matrix?.climate_change_views?.ccs_12_raw || null,
                                    // CCS scored values (ccs_01_scored through ccs_12_scored)
                                    ccs_01_scored: participant.views_matrix?.climate_change_views?.ccs_01_scored || null,
                                    ccs_02_scored: participant.views_matrix?.climate_change_views?.ccs_02_scored || null,
                                    ccs_03_scored: participant.views_matrix?.climate_change_views?.ccs_03_scored || null,
                                    ccs_04_scored: participant.views_matrix?.climate_change_views?.ccs_04_scored || null,
                                    ccs_05_scored: participant.views_matrix?.climate_change_views?.ccs_05_scored || null,
                                    ccs_06_scored: participant.views_matrix?.climate_change_views?.ccs_06_scored || null,
                                    ccs_07_scored: participant.views_matrix?.climate_change_views?.ccs_07_scored || null,
                                    ccs_08_scored: participant.views_matrix?.climate_change_views?.ccs_08_scored || null,
                                    ccs_09_scored: participant.views_matrix?.climate_change_views?.ccs_09_scored || null,
                                    ccs_10_scored: participant.views_matrix?.climate_change_views?.ccs_10_scored || null,
                                    ccs_11_scored: participant.views_matrix?.climate_change_views?.ccs_11_scored || null,
                                    ccs_12_scored: participant.views_matrix?.climate_change_views?.ccs_12_scored || null,
                                    // CCS metadata (was_moved flags)
                                    ccs_01_was_moved: participant.views_matrix?.climate_change_views?.ccs_01_was_moved || null,
                                    ccs_02_was_moved: participant.views_matrix?.climate_change_views?.ccs_02_was_moved || null,
                                    ccs_03_was_moved: participant.views_matrix?.climate_change_views?.ccs_03_was_moved || null,
                                    ccs_04_was_moved: participant.views_matrix?.climate_change_views?.ccs_04_was_moved || null,
                                    ccs_05_was_moved: participant.views_matrix?.climate_change_views?.ccs_05_was_moved || null,
                                    ccs_06_was_moved: participant.views_matrix?.climate_change_views?.ccs_06_was_moved || null,
                                    ccs_07_was_moved: participant.views_matrix?.climate_change_views?.ccs_07_was_moved || null,
                                    ccs_08_was_moved: participant.views_matrix?.climate_change_views?.ccs_08_was_moved || null,
                                    ccs_09_was_moved: participant.views_matrix?.climate_change_views?.ccs_09_was_moved || null,
                                    ccs_10_was_moved: participant.views_matrix?.climate_change_views?.ccs_10_was_moved || null,
                                    ccs_11_was_moved: participant.views_matrix?.climate_change_views?.ccs_11_was_moved || null,
                                    ccs_12_was_moved: participant.views_matrix?.climate_change_views?.ccs_12_was_moved || null,
                                    // Attention check
                                    attention_check_value: participant.views_matrix?.climate_change_views?.attention_check_value || null,
                                    attention_check_passed: participant.views_matrix?.climate_change_views?.attention_check_passed || null,
                                    attention_check_was_moved: participant.views_matrix?.climate_change_views?.attention_check_was_moved || null,
                                    // Mean scores
                                    ccs_mean_scored: participant.views_matrix?.climate_change_views?.ccs_mean_scored || null,
                                    ccs_occurrence_mean: participant.views_matrix?.climate_change_views?.ccs_occurrence_mean || null,
                                    ccs_causation_mean: participant.views_matrix?.climate_change_views?.ccs_causation_mean || null,
                                    ccs_seriousness_mean: participant.views_matrix?.climate_change_views?.ccs_seriousness_mean || null,
                                    ccs_efficacy_mean: participant.views_matrix?.climate_change_views?.ccs_efficacy_mean || null,
                                    ccs_trust_mean: participant.views_matrix?.climate_change_views?.ccs_trust_mean || null,
                                    // Display order
                                    ccs_row_order: participant.views_matrix?.climate_change_views?.ccs_row_order || null
                                },
                                political_views: {
                                    economic_issues: participant.views_matrix?.political_views?.economic_issues || null,
                                    social_issues: participant.views_matrix?.political_views?.social_issues || null,
                                    political_views_order: participant.views_matrix?.political_views?.political_views_order || null,
                                    economic_issues_answered: participant.views_matrix?.political_views?.economic_issues_answered || null,
                                    social_issues_answered: participant.views_matrix?.political_views?.social_issues_answered || null
                                }
                            },
                            
                            // Chatbot interaction - ensure messages are captured
                            chatbot_interaction: {
                                messages: participant.chatbot_interaction?.messages || []
                            },
                            
                            // Post chat data
                            post_chat: {
                                final_belief_confidence: participant.post_chat?.final_belief_confidence || null,
                                chatbot_summary_accuracy: participant.post_chat?.chatbot_summary_accuracy || null
                            },
                            
                            // Timestamps
                            timestamps: {
                                started: participant.timestamps?.started || participant.timestamp_joined,
                                completed: participant.timestamps?.completed || null
                            },
                            
                            // Legacy fields for backwards compatibility
                            id: participant.id || participant.participant_id,
                            createdAt: participant.createdAt || participant.timestamp_joined,
                            updatedAt: participant.updatedAt || participant.timestamp_joined
                        };
                        
                        participants.push(completeParticipant);
                        
                        // Extract messages from participant chatbot interactions
                        if (completeParticipant.chatbot_interaction && completeParticipant.chatbot_interaction.messages) {
                            const msgCount = completeParticipant.chatbot_interaction.messages.length;
                            totalMessages += msgCount;
                            console.log(`   ${completeParticipant.participant_id}: ${msgCount} messages`);
                            
                            // Add messages to messages array with additional metadata
                            completeParticipant.chatbot_interaction.messages.forEach((msg, index) => {
                                messages.push({
                                    id: messages.length + 1,
                                    participant_id: completeParticipant.participant_id,
                                    sender: msg.sender,
                                    message: msg.text,
                                    text: msg.text, // Include both for compatibility
                                    character_count: msg.text ? msg.text.length : 0,
                                    timestamp: msg.timestamp,
                                    message_index: index + 1
                                });
                            });
                        }
                    }
                }
            }
        }
        
        console.log('📖 Reading conversation data...');
        
        // Read all conversation files for additional metadata
        if (fs.existsSync(conversationsDir)) {
            const conversationFiles = fs.readdirSync(conversationsDir);
            console.log(`   Found ${conversationFiles.length} conversation files`);
            
            for (const file of conversationFiles) {
                if (file.endsWith('.json')) {
                    const conversation = readJson(path.join(conversationsDir, file));
                    if (conversation) {
                        conversations.push({
                            id: conversations.length + 1,
                            conversation_id: conversation.id,
                            participant_id: conversation.participantId,
                            started_at: conversation.startedAt,
                            ended_at: conversation.endedAt,
                            duration_seconds: conversation.durationSeconds,
                            message_count: conversation.messages ? conversation.messages.length : 0,
                            status: conversation.endedAt ? 'completed' : 'active'
                        });
                    }
                }
            }
        }
        
        // Create consolidated export structure matching your example
        const exportData = {
            exported_at: new Date().toISOString(),
            totals: {
                participants: participants.length,
                conversations: conversations.length,
                messages: totalMessages,
                completed_surveys: participants.filter(p => p.timestamps && p.timestamps.completed).length,
                disqualified_participants: participants.filter(p => p.disqualified === true).length
            },
            data: {
                participants: participants,
                conversations: conversations,
                messages: messages
            }
        };
        
        // Save to exports directory
        const exportFilename = `research-data-export-${new Date().toISOString().split('T')[0]}.json`;
        const exportPath = path.join(exportsDir, exportFilename);
        
        if (writeJson(exportPath, exportData)) {
            console.log(`✅ Export generated successfully!`);
            console.log(`📄 File: ${exportPath}`);
            console.log(`📊 Summary:`);
            console.log(`   • ${participants.length} participants`);
            console.log(`   • ${conversations.length} conversations`);
            console.log(`   • ${totalMessages} total messages`);
            console.log(`   • ${exportData.totals.completed_surveys} completed surveys`);
            console.log(`   • ${exportData.totals.disqualified_participants} disqualified participants`);
            
            return exportPath;
        } else {
            throw new Error('Failed to write export file');
        }
        
    } catch (error) {
        console.error('❌ Error generating export:', error.message);
        return null;
    }
}

// Export for use as module or run directly
if (require.main === module) {
    generateConsolidatedExport();
}

module.exports = { generateConsolidatedExport };