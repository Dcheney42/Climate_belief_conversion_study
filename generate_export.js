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
                        participants.push(participant);
                        
                        // Extract messages from participant chatbot interactions
                        if (participant.chatbot_interaction && participant.chatbot_interaction.messages) {
                            const msgCount = participant.chatbot_interaction.messages.length;
                            totalMessages += msgCount;
                            console.log(`   ${participant.participant_id}: ${msgCount} messages`);
                            
                            // Add messages to messages array with additional metadata
                            participant.chatbot_interaction.messages.forEach((msg, index) => {
                                messages.push({
                                    id: messages.length + 1,
                                    participant_id: participant.participant_id,
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