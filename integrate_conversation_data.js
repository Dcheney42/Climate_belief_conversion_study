// Script to integrate conversation data back into participant files
const fs = require('fs');
const path = require('path');

// Utility functions
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

function integrateConversationData() {
    console.log('🔄 Integrating conversation data into participant files');
    console.log('==================================================\n');
    
    try {
        // Define data directories
        const dataDir = path.join(__dirname, 'data');
        const participantsDir = path.join(dataDir, 'participants');
        const conversationsDir = path.join(dataDir, 'conversations');
        
        if (!fs.existsSync(participantsDir) || !fs.existsSync(conversationsDir)) {
            console.error('Required directories do not exist');
            return false;
        }
        
        let participantsUpdated = 0;
        let conversationsProcessed = 0;
        
        console.log('📖 Reading conversation files...');
        
        // Read all conversation files
        const conversationFiles = fs.readdirSync(conversationsDir);
        console.log(`   Found ${conversationFiles.length} conversation files`);
        
        for (const file of conversationFiles) {
            if (file.endsWith('.json')) {
                const conversation = readJson(path.join(conversationsDir, file));
                if (conversation && conversation.participantId && conversation.messages) {
                    conversationsProcessed++;
                    
                    // Find the corresponding participant file
                    const participantFile = path.join(participantsDir, `${conversation.participantId}.json`);
                    const participant = readJson(participantFile);
                    
                    if (participant) {
                        // Transform conversation messages to match desired structure
                        const transformedMessages = conversation.messages
                            .filter(msg => msg.role === 'user' || msg.role === 'assistant') // Filter out system messages
                            .map(msg => ({
                                sender: msg.role === 'user' ? 'participant' : 'chatbot',
                                text: msg.content,
                                timestamp: msg.timestamp || conversation.startedAt
                            }));
                        
                        // Update chatbot interaction section if messages exist
                        if (transformedMessages.length > 0) {
                            if (!participant.chatbot_interaction) {
                                participant.chatbot_interaction = {};
                            }
                            participant.chatbot_interaction.messages = transformedMessages;
                            
                            // Generate chatbot summary from conversation messages and add to belief_change
                            const participantMessages = transformedMessages
                                .filter(msg => msg.sender === 'participant')
                                .map(msg => msg.text)
                                .join(' ');
                            
                            if (participantMessages.trim() && !participant.belief_change?.chatbot_summary) {
                                if (!participant.belief_change) {
                                    participant.belief_change = {};
                                }
                                participant.belief_change.chatbot_summary = `Participant discussed: ${participantMessages.substring(0, 200)}${participantMessages.length > 200 ? '...' : ''}`;
                            }
                            
                            // Update timestamp
                            participant.updatedAt = new Date().toISOString();
                            
                            // Save updated participant data
                            if (writeJson(participantFile, participant)) {
                                participantsUpdated++;
                                console.log(`   ✅ Updated ${participant.participant_id} with ${transformedMessages.length} conversation messages`);
                            } else {
                                console.error(`   ❌ Failed to update ${participant.participant_id}`);
                            }
                        } else {
                            console.log(`   ⚠️  No conversation messages found for ${participant.participant_id}`);
                        }
                    } else {
                        console.error(`   ❌ Participant file not found for ${conversation.participantId}`);
                    }
                }
            }
        }
        
        console.log('\n📊 Integration Summary:');
        console.log(`   • ${conversationsProcessed} conversations processed`);
        console.log(`   • ${participantsUpdated} participant files updated`);
        console.log('   • Conversation messages integrated into participant files');
        console.log('   • Chatbot summaries generated where needed');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error integrating conversation data:', error.message);
        return false;
    }
}

// Export for use as module or run directly
if (require.main === module) {
    const success = integrateConversationData();
    process.exit(success ? 0 : 1);
}

module.exports = { integrateConversationData };