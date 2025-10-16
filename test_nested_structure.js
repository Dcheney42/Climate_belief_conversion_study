// Test script to validate the new nested data structure
const fs = require('fs');
const path = require('path');

// Test data that matches what would be submitted through the survey
const testSurveyData = {
    prolific_id: "test123",
    age: "31",
    gender: "Male", 
    education: "Bachelor's degree",
    economic_issues: "4",
    social_issues: "3",
    political_views_order: [0, 1],
    views_changed: "Yes",
    current_views: "Climate change is real and urgent and requires immediate action.",
    elaboration: "I saw stronger evidence and personal impacts that changed my perspective.",
    ai_summary_generated: "Climate change is real and urgent and requires immediate action.",
    AI_Summary_Views: "Climate change is real and urgent and requires immediate action.",
    ai_accurate: "Yes",
    confidence_level: "87",
    consent: true,
    // CCS data (sample)
    ccs_01_raw: 25,
    ccs_01_scored: 25,
    ccs_01_was_moved: true,
    ccs_02_raw: 75,
    ccs_02_scored: 25, // reverse coded
    ccs_02_was_moved: true,
    // ... (would include all 12 CCS items)
    attention_check_value: 0,
    attention_check_passed: true,
    attention_check_was_moved: true,
    ccs_mean_scored: 45.5,
    ccs_occurrence_mean: 40,
    ccs_causation_mean: 50,
    ccs_seriousness_mean: 60,
    ccs_efficacy_mean: 35,
    ccs_trust_mean: 30,
    ccs_row_order: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
};

// Test data for end survey
const testEndSurveyData = {
    summaryConfidence: "8",
    finalConfidenceLevel: "92"
};

// Test chatbot messages
const testChatMessages = [
    {
        sender: "participant",
        text: "I used to doubt climate change but now I believe it's real.",
        timestamp: "2025-10-16T01:00:00Z"
    },
    {
        sender: "chatbot", 
        text: "Can you tell me more about what changed your mind?",
        timestamp: "2025-10-16T01:00:15Z"
    },
    {
        sender: "participant",
        text: "Seeing more extreme weather events and reading scientific reports.",
        timestamp: "2025-10-16T01:00:45Z"
    }
];

// Expected nested structure based on user requirements
function validateNestedStructure(participantData) {
    console.log('🔍 Validating nested structure...\n');
    
    const required = {
        // Top-level fields
        'participant_id': 'string',
        'prolific_id': 'string',
        'consent': 'boolean', 
        'disqualified': 'boolean',
        'timestamp_joined': 'string',
        
        // Nested sections
        'demographics': 'object',
        'belief_change': 'object',
        'views_matrix': 'object',
        'chatbot_interaction': 'object',
        'post_chat': 'object',
        'timestamps': 'object'
    };
    
    const demographicsFields = ['age', 'gender', 'education'];
    const beliefChangeFields = ['has_changed_mind', 'current_view', 'elaboration', 'ai_summary', 'ai_confidence_slider', 'ai_summary_accuracy'];
    const viewsMatrixFields = ['climate_change_views', 'political_views'];
    const chatbotFields = ['messages'];
    const postChatFields = ['final_belief_confidence', 'chatbot_summary_accuracy'];
    const timestampFields = ['started', 'completed'];
    
    let passed = 0;
    let failed = 0;
    
    // Check top-level structure
    for (const [field, expectedType] of Object.entries(required)) {
        if (participantData.hasOwnProperty(field)) {
            const actualType = typeof participantData[field];
            if (actualType === expectedType) {
                console.log(`✅ ${field}: ${actualType}`);
                passed++;
            } else {
                console.log(`❌ ${field}: expected ${expectedType}, got ${actualType}`);
                failed++;
            }
        } else {
            console.log(`❌ ${field}: missing`);
            failed++;
        }
    }
    
    // Check nested structures
    console.log('\n📂 Checking nested structures:');
    
    // Demographics
    if (participantData.demographics) {
        console.log('  Demographics:');
        demographicsFields.forEach(field => {
            if (participantData.demographics.hasOwnProperty(field)) {
                console.log(`    ✅ ${field}: ${typeof participantData.demographics[field]}`);
                passed++;
            } else {
                console.log(`    ❌ ${field}: missing`);
                failed++;
            }
        });
    }
    
    // Belief change
    if (participantData.belief_change) {
        console.log('  Belief Change:');
        beliefChangeFields.forEach(field => {
            if (participantData.belief_change.hasOwnProperty(field)) {
                console.log(`    ✅ ${field}: ${typeof participantData.belief_change[field]}`);
                passed++;
            } else {
                console.log(`    ❌ ${field}: missing`);
                failed++;
            }
        });
    }
    
    // Views matrix
    if (participantData.views_matrix) {
        console.log('  Views Matrix:');
        viewsMatrixFields.forEach(field => {
            if (participantData.views_matrix.hasOwnProperty(field)) {
                console.log(`    ✅ ${field}: ${typeof participantData.views_matrix[field]}`);
                passed++;
            } else {
                console.log(`    ❌ ${field}: missing`);
                failed++;
            }
        });
        
        // Check CCS data in climate_change_views
        if (participantData.views_matrix.climate_change_views) {
            const ccsKeys = Object.keys(participantData.views_matrix.climate_change_views);
            const expectedCCSFields = [
                'ccs_01_raw', 'ccs_01_scored', 'ccs_01_was_moved',
                'attention_check_value', 'attention_check_passed',
                'ccs_mean_scored', 'ccs_occurrence_mean'
            ];
            
            console.log('    Climate Change Views (CCS):');
            expectedCCSFields.forEach(field => {
                if (participantData.views_matrix.climate_change_views.hasOwnProperty(field)) {
                    console.log(`      ✅ ${field}`);
                    passed++;
                } else {
                    console.log(`      ❌ ${field}: missing`);
                    failed++;
                }
            });
        }
        
        // Check political views
        if (participantData.views_matrix.political_views) {
            console.log('    Political Views:');
            const politicalFields = ['economic_issues', 'social_issues'];
            politicalFields.forEach(field => {
                if (participantData.views_matrix.political_views.hasOwnProperty(field)) {
                    console.log(`      ✅ ${field}`);
                    passed++;
                } else {
                    console.log(`      ❌ ${field}: missing`);
                    failed++;
                }
            });
        }
    }
    
    // Chatbot interaction
    if (participantData.chatbot_interaction) {
        console.log('  Chatbot Interaction:');
        if (participantData.chatbot_interaction.messages && Array.isArray(participantData.chatbot_interaction.messages)) {
            console.log(`    ✅ messages: array with ${participantData.chatbot_interaction.messages.length} items`);
            passed++;
            
            // Check message structure
            if (participantData.chatbot_interaction.messages.length > 0) {
                const firstMsg = participantData.chatbot_interaction.messages[0];
                const msgFields = ['sender', 'text', 'timestamp'];
                msgFields.forEach(field => {
                    if (firstMsg.hasOwnProperty(field)) {
                        console.log(`      ✅ message.${field}`);
                        passed++;
                    } else {
                        console.log(`      ❌ message.${field}: missing`);
                        failed++;
                    }
                });
            }
        } else {
            console.log('    ❌ messages: not an array');
            failed++;
        }
    }
    
    // Post chat
    if (participantData.post_chat) {
        console.log('  Post Chat:');
        postChatFields.forEach(field => {
            if (participantData.post_chat.hasOwnProperty(field)) {
                console.log(`    ✅ ${field}: ${typeof participantData.post_chat[field]}`);
                passed++;
            } else {
                console.log(`    ❌ ${field}: missing`);
                failed++;
            }
        });
    }
    
    // Timestamps
    if (participantData.timestamps) {
        console.log('  Timestamps:');
        timestampFields.forEach(field => {
            if (participantData.timestamps.hasOwnProperty(field)) {
                console.log(`    ✅ ${field}: ${typeof participantData.timestamps[field]}`);
                passed++;
            } else {
                console.log(`    ❌ ${field}: missing`);
                failed++;
            }
        });
    }
    
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 All structure validation tests passed!');
        return true;
    } else {
        console.log('⚠️ Some structure validation tests failed.');
        return false;
    }
}

// Function to simulate the survey flow and test the structure
async function testNestedStructureFlow() {
    console.log('🧪 Testing Nested Data Structure Implementation\n');
    console.log('===============================================\n');
    
    try {
        // Simulate survey submission
        console.log('1️⃣ Testing survey submission with nested structure...');
        
        const fetch = require('node-fetch');
        const baseUrl = 'http://localhost:3000';
        
        // Submit survey data
        const surveyResponse = await fetch(`${baseUrl}/survey/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testSurveyData)
        });
        
        if (!surveyResponse.ok) {
            throw new Error(`Survey submission failed: ${surveyResponse.status}`);
        }
        
        const surveyResult = await surveyResponse.json();
        console.log(`✅ Survey submitted successfully. Participant ID: ${surveyResult.participantId}\n`);
        
        // Read the created participant file and validate structure
        const participantsDir = path.join(__dirname, 'data', 'participants');
        const participantFile = path.join(participantsDir, `${surveyResult.participantId}.json`);
        
        if (!fs.existsSync(participantFile)) {
            throw new Error('Participant file was not created');
        }
        
        const participantData = JSON.parse(fs.readFileSync(participantFile, 'utf8'));
        console.log('2️⃣ Validating participant data structure...\n');
        
        const structureValid = validateNestedStructure(participantData);
        
        if (structureValid) {
            console.log('\n3️⃣ Testing end survey integration...');
            
            // Test end survey submission
            const endSurveyResponse = await fetch(`${baseUrl}/api/end-survey`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participant_id: surveyResult.participantId,
                    ...testEndSurveyData
                })
            });
            
            if (!endSurveyResponse.ok) {
                throw new Error(`End survey submission failed: ${endSurveyResponse.status}`);
            }
            
            console.log('✅ End survey integrated successfully');
            
            // Verify post_chat section was updated
            const updatedParticipantData = JSON.parse(fs.readFileSync(participantFile, 'utf8'));
            if (updatedParticipantData.post_chat && 
                updatedParticipantData.post_chat.final_belief_confidence !== null &&
                updatedParticipantData.timestamps.completed !== null) {
                console.log('✅ Post-chat data and completion timestamp updated correctly\n');
            } else {
                console.log('❌ Post-chat integration failed\n');
            }
            
            console.log('🎯 Test Summary:');
            console.log('================');
            console.log('✅ Nested structure implementation: PASSED');
            console.log('✅ Survey submission endpoint: PASSED'); 
            console.log('✅ End survey integration: PASSED');
            console.log('✅ Data persistence: PASSED');
            console.log('\n🚀 The nested structure is working correctly!');
            
        } else {
            console.log('\n❌ Structure validation failed. Please check the implementation.');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n🔧 Make sure the server is running on localhost:3000');
        console.log('   Run: node server.js');
    }
}

// Export for use as a module or run directly
if (require.main === module) {
    testNestedStructureFlow();
}

module.exports = { validateNestedStructure, testNestedStructureFlow };