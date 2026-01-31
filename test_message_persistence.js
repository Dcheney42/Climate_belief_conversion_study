/**
 * Regression test for message persistence fix
 * 
 * This test verifies that ALL chat messages (both participant and bot) are saved
 * to the participant file after each turn, not just at conversation end.
 * 
 * Run with: node test_message_persistence.js
 */

const path = require('path');
const fs = require('fs');

// Test configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const participantsDir = path.join(__dirname, 'data', 'participants');
const conversationsDir = path.join(__dirname, 'data', 'conversations');

// Color codes for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a chat message and return the response
 */
async function sendMessage(conversationId, message) {
    const response = await fetch(`${BASE_URL}/api/conversations/${conversationId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
}

/**
 * Read participant file and return message count
 */
function getParticipantMessageCount(participantId) {
    const participantFile = path.join(participantsDir, `${participantId}.json`);
    
    if (!fs.existsSync(participantFile)) {
        return 0;
    }
    
    const data = JSON.parse(fs.readFileSync(participantFile, 'utf8'));
    return data.chatbot_interaction?.messages?.length || 0;
}

/**
 * Read participant file and return full message list with metadata
 */
function getParticipantMessages(participantId) {
    const participantFile = path.join(participantsDir, `${participantId}.json`);
    
    if (!fs.existsSync(participantFile)) {
        return [];
    }
    
    const data = JSON.parse(fs.readFileSync(participantFile, 'utf8'));
    return data.chatbot_interaction?.messages || [];
}

/**
 * Read conversation file and return message count
 */
function getConversationMessageCount(conversationId) {
    const conversationFile = path.join(conversationsDir, `${conversationId}.json`);
    
    if (!fs.existsSync(conversationFile)) {
        return 0;
    }
    
    const data = JSON.parse(fs.readFileSync(conversationFile, 'utf8'));
    return data.messages?.length || 0;
}

/**
 * Create a test participant
 */
async function createTestParticipant() {
    log('\n📝 Creating test participant...', 'cyan');
    
    const response = await fetch(`${BASE_URL}/survey/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prolific_id: `test_${Date.now()}`,
            age: '25',
            gender: 'Prefer not to say',
            education: 'Bachelor\'s degree',
            economic_issues: '5',
            social_issues: '5',
            mind_change_direction: 'not_urgent_to_urgent',
            consent: true,
            ccs_01_raw: 50,
            ccs_01_scored: 50,
            ccs_mean_scored: 50
        })
    });
    
    if (!response.ok) {
        throw new Error(`Failed to create participant: ${response.status}`);
    }
    
    const data = await response.json();
    log(`✅ Created participant: ${data.participantId}`, 'green');
    return data.participantId;
}

/**
 * Start a conversation
 */
async function startConversation(participantId) {
    log('\n🚀 Starting conversation...', 'cyan');
    
    const response = await fetch(`${BASE_URL}/api/conversations/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId })
    });
    
    if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.status}`);
    }
    
    const data = await response.json();
    log(`✅ Started conversation: ${data.conversationId}`, 'green');
    return data.conversationId;
}

/**
 * Main test function
 */
async function runTest() {
    log('='.repeat(80), 'blue');
    log('MESSAGE PERSISTENCE REGRESSION TEST', 'blue');
    log('='.repeat(80), 'blue');
    
    let participantId, conversationId;
    const testMessages = [
        'I used to think climate change wasn\'t urgent, but I changed my mind.',
        'Scientific evidence was really convincing to me.',
        'I read several peer-reviewed studies that changed my perspective.'
    ];
    
    try {
        // Step 1: Create participant
        participantId = await createTestParticipant();
        
        // Step 2: Start conversation
        conversationId = await startConversation(participantId);
        
        // Step 3: Send messages and verify incremental persistence
        log('\n💬 Testing incremental message persistence...', 'cyan');
        
        for (let i = 0; i < testMessages.length; i++) {
            const turnNumber = i + 1;
            log(`\n--- Turn ${turnNumber} ---`, 'yellow');
            
            // Send message
            const userMessage = testMessages[i];
            log(`👤 Participant: "${userMessage.substring(0, 50)}..."`, 'reset');
            
            const response = await sendMessage(conversationId, userMessage);
            log(`🤖 Bot: "${response.reply.substring(0, 50)}..."`, 'reset');
            
            // Small delay to ensure file write completes
            await sleep(100);
            
            // Verify participant file has been updated
            const participantMsgCount = getParticipantMessageCount(participantId);
            const conversationMsgCount = getConversationMessageCount(conversationId);
            
            // Expected count: 2 messages per turn (user + assistant)
            // No opening line should be included in participant file
            const expectedCount = turnNumber * 2;
            
            log(`📊 Participant file messages: ${participantMsgCount}`, 'reset');
            log(`📊 Conversation file messages: ${conversationMsgCount}`, 'reset');
            log(`📊 Expected participant messages: ${expectedCount}`, 'reset');
            
            if (participantMsgCount === expectedCount) {
                log(`✅ PASS: Incremental save successful after turn ${turnNumber}`, 'green');
            } else {
                log(`❌ FAIL: Expected ${expectedCount} messages but found ${participantMsgCount}`, 'red');
                throw new Error(`Incremental persistence failed at turn ${turnNumber}`);
            }
        }
        
        // Step 4: Verify message structure and metadata
        log('\n🔍 Verifying message structure...', 'cyan');
        const messages = getParticipantMessages(participantId);
        
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const checks = {
                'has conversationId': !!msg.conversationId,
                'has messageId': !!msg.messageId,
                'has turn number': typeof msg.turn === 'number',
                'has sender': !!msg.sender,
                'has role': !!msg.role,
                'has text': !!msg.text,
                'has timestamp': !!msg.timestamp,
                'has metadata': !!msg.metadata
            };
            
            const allChecksPassed = Object.values(checks).every(v => v);
            
            if (allChecksPassed) {
                log(`✅ Message ${i + 1}: All fields present`, 'green');
            } else {
                log(`❌ Message ${i + 1}: Missing fields`, 'red');
                for (const [check, passed] of Object.entries(checks)) {
                    if (!passed) {
                        log(`   ⚠️  Missing: ${check}`, 'yellow');
                    }
                }
            }
        }
        
        // Step 5: Verify alternating participant/bot pattern
        log('\n🔍 Verifying message ordering...', 'cyan');
        let orderCorrect = true;
        for (let i = 0; i < messages.length; i++) {
            const expectedSender = i % 2 === 0 ? 'participant' : 'chatbot';
            const actualSender = messages[i].sender;
            
            if (actualSender !== expectedSender) {
                log(`❌ Message ${i + 1}: Expected ${expectedSender}, got ${actualSender}`, 'red');
                orderCorrect = false;
            }
        }
        
        if (orderCorrect) {
            log(`✅ PASS: Message ordering correct (alternating participant/bot)`, 'green');
        } else {
            throw new Error('Message ordering is incorrect');
        }
        
        // Step 6: End conversation and verify final state
        log('\n🏁 Ending conversation and verifying final state...', 'cyan');
        
        const endResponse = await fetch(`${BASE_URL}/api/conversations/${conversationId}/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!endResponse.ok) {
            throw new Error(`Failed to end conversation: ${endResponse.status}`);
        }
        
        await sleep(100);
        
        const finalMsgCount = getParticipantMessageCount(participantId);
        log(`📊 Final message count: ${finalMsgCount}`, 'reset');
        
        if (finalMsgCount === testMessages.length * 2) {
            log(`✅ PASS: Final message count matches expected`, 'green');
        } else {
            log(`❌ FAIL: Expected ${testMessages.length * 2} messages, got ${finalMsgCount}`, 'red');
            throw new Error('Final message count mismatch');
        }
        
        // SUCCESS!
        log('\n' + '='.repeat(80), 'green');
        log('✅ ALL TESTS PASSED', 'green');
        log('='.repeat(80), 'green');
        log('\nTest Summary:', 'cyan');
        log(`  • Test turns: ${testMessages.length}`, 'reset');
        log(`  • Messages sent: ${testMessages.length * 2} (participant + bot)`, 'reset');
        log(`  • Incremental saves: ${testMessages.length}`, 'reset');
        log(`  • Final verification: PASS`, 'green');
        log('\n✨ Message persistence is working correctly!', 'green');
        
        return true;
        
    } catch (error) {
        log('\n' + '='.repeat(80), 'red');
        log('❌ TEST FAILED', 'red');
        log('='.repeat(80), 'red');
        log(`\nError: ${error.message}`, 'red');
        
        if (error.stack) {
            log('\nStack trace:', 'yellow');
            log(error.stack, 'reset');
        }
        
        return false;
    }
}

// Run the test
if (require.main === module) {
    runTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            log(`\n💥 Unexpected error: ${error.message}`, 'red');
            process.exit(1);
        });
}

module.exports = { runTest };
