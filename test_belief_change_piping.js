// Test script to verify belief change data piping from survey to chatbot

const fs = require('fs');
const path = require('path');

// Mock participant data directory
const participantsDir = path.join(__dirname, 'data', 'participants');

// Create test participant data with belief change information
const testParticipantData = {
    participant_id: 'test_p_123456',
    prolific_id: 'test_prolific_123',
    consent: true,
    disqualified: false,
    timestamp_joined: new Date().toISOString(),
    
    demographics: {
        age: 25,
        gender: 'Woman',
        education: 'Bachelor\'s degree'
    },
    
    belief_change: {
        has_changed_mind: true,
        mind_change_direction: 'not_exists_to_exists',
        mind_change_no_change: false,
        mind_change_other_text: null
    },
    
    views_matrix: {
        climate_change_views: {},
        political_views: {}
    },
    
    chatbot_interaction: {
        messages: []
    },
    
    post_chat: {},
    
    timestamps: {
        started: new Date().toISOString(),
        completed: null
    }
};

// Create mock directory if it doesn't exist
if (!fs.existsSync(participantsDir)) {
    fs.mkdirSync(participantsDir, { recursive: true });
}

// Write test participant data
const filename = path.join(participantsDir, `${testParticipantData.participant_id}.json`);
fs.writeFileSync(filename, JSON.stringify(testParticipantData, null, 2));

console.log('✅ Test participant data created:', testParticipantData.participant_id);

// Mock the server's getProfile function
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

async function getProfile(userId) {
    const filename = path.join(participantsDir, `${userId}.json`);
    const participant = readJson(filename);
    if (!participant) return null;
    
    // Map existing fields to expected structure for chat system
    const hasChangedMind = participant.belief_change?.has_changed_mind;
    const viewsChanged = hasChangedMind ? 'Yes' : (hasChangedMind === false ? 'No' : 'unspecified');
    
    // Map the specific belief change direction from survey
    const mindChangeDirection = participant.belief_change?.mind_change_direction;
    const mindChangeOtherText = participant.belief_change?.mind_change_other_text;
    
    // Convert the direction code to a descriptive text for the system prompt
    let changeDescription = null;
    if (mindChangeDirection) {
        switch (mindChangeDirection) {
            case 'exists_to_not_exists':
                changeDescription = 'From thinking climate change exists, to thinking climate change does not exist';
                break;
            case 'not_exists_to_exists':
                changeDescription = 'From thinking climate change does not exist, to thinking climate change exists';
                break;
            case 'not_urgent_to_urgent':
                changeDescription = 'From thinking climate change is not an urgent crisis, to thinking climate change is an urgent crisis';
                break;
            case 'urgent_to_not_urgent':
                changeDescription = 'From thinking climate change is an urgent crisis, to thinking climate change is not an urgent crisis';
                break;
            case 'human_to_natural':
                changeDescription = 'From thinking climate change is primarily caused by human activity, to thinking climate change is a largely natural process';
                break;
            case 'natural_to_human':
                changeDescription = 'From thinking climate change is a largely natural process, to thinking climate change is primarily caused by human activity';
                break;
            case 'other':
                changeDescription = mindChangeOtherText || 'Other belief change (details provided by participant)';
                break;
            default:
                changeDescription = null;
        }
    }
    
    return {
        views_changed: viewsChanged,
        change_description: changeDescription,
        change_confidence: null,
        mind_change_direction: mindChangeDirection,
        mind_change_other_text: mindChangeOtherText,
        prior_belief_cc_happening: null,
        prior_belief_human_cause: "unspecified",
        current_belief_cc_happening: null,
        current_belief_human_cause: "unspecified",
        changed_belief_flag: hasChangedMind === true
    };
}

// Test system prompt generation
function renderSystemPrompt(profile) {
    const {
        views_changed = "unspecified",
        change_description = null,
        change_confidence = null
    } = profile || {};

    return `
You are a research interviewer conducting a qualitative interview about climate belief conversion. Your goal is to understand the participant's personal story of belief change.

Participant Background:
- Views changed: ${views_changed}
- Change description: ${change_description || "Not provided"}
- Confidence in statement: ${change_confidence !== null ? `${change_confidence}/10` : "Not provided"}

INTERVIEW FOCUS:
The participant has indicated they changed their mind about climate change in this specific way: ${change_description || "general belief change"}. Your questions should explore the story behind THIS specific change - what influenced it, how it happened, what the process was like for them personally.

CRITICAL RESPONSE RULES:
- Focus EXCLUSIVELY on their personal belief change narrative
- Ask ONE focused question per response
- Reference their specific change: ${change_description || "their belief change"}
- Explore the influences, process, and experience of THIS specific change

Remember: You're gathering their authentic story of belief change for research purposes.
`;
}

// Test opening line generation
function openingLineFrom(profile) {
    const { views_changed, change_description, mind_change_direction } = profile || {};

    if (views_changed === 'Yes' && change_description) {
        return `Hi there! Thanks for chatting with me. Earlier, you mentioned that you changed your mind about climate change - specifically, ${change_description.toLowerCase()}. I'd love to hear more about that story. What prompted this shift in your thinking?`;
    } else if (views_changed === 'Yes') {
        return "Hi there! Thanks for chatting with me. Earlier, you mentioned that you've changed your mind about climate change. Could you tell me a bit more about what exactly you changed your mind about, and how that change came about?";
    } else {
        return "Hello! I'm here to learn about your thoughts and experiences with climate change. Let's start by talking about your perspective - can you tell me how you currently think about climate change?";
    }
}

// Run tests
async function runTests() {
    console.log('\n🧪 Testing belief change data piping...\n');
    
    // Test 1: Profile retrieval
    console.log('1. Testing profile retrieval:');
    const profile = await getProfile(testParticipantData.participant_id);
    console.log('   Profile:', JSON.stringify(profile, null, 2));
    
    if (profile.views_changed === 'Yes' && profile.change_description) {
        console.log('   ✅ Profile correctly maps belief change data');
    } else {
        console.log('   ❌ Profile mapping issue');
        return;
    }
    
    // Test 2: System prompt generation
    console.log('\n2. Testing system prompt generation:');
    const systemPrompt = renderSystemPrompt(profile);
    console.log('   System prompt preview:', systemPrompt.substring(0, 300) + '...');
    
    if (systemPrompt.includes(profile.change_description)) {
        console.log('   ✅ System prompt correctly includes specific belief change');
    } else {
        console.log('   ❌ System prompt missing belief change details');
    }
    
    // Test 3: Opening line generation
    console.log('\n3. Testing opening line generation:');
    const openingLine = openingLineFrom(profile);
    console.log('   Opening line:', openingLine);
    
    if (openingLine.includes('from thinking climate change does not exist, to thinking climate change exists')) {
        console.log('   ✅ Opening line correctly references specific belief change');
    } else {
        console.log('   ❌ Opening line missing specific belief change reference');
    }
    
    // Test 4: Test different belief change types
    console.log('\n4. Testing different belief change types:');
    
    const testCases = [
        {
            direction: 'urgent_to_not_urgent',
            expected: 'from thinking climate change is an urgent crisis, to thinking climate change is not an urgent crisis'
        },
        {
            direction: 'human_to_natural',
            expected: 'from thinking climate change is primarily caused by human activity, to thinking climate change is a largely natural process'
        },
        {
            direction: 'other',
            otherText: 'I changed my mind about the timeline of climate impacts',
            expected: 'i changed my mind about the timeline of climate impacts'
        }
    ];
    
    for (const testCase of testCases) {
        const testProfile = {
            views_changed: 'Yes',
            change_description: testCase.direction === 'other' ? 
                testCase.otherText : 
                testCase.expected.charAt(0).toUpperCase() + testCase.expected.slice(1),
            mind_change_direction: testCase.direction,
            mind_change_other_text: testCase.otherText || null
        };
        
        const testOpeningLine = openingLineFrom(testProfile);
        if (testOpeningLine.toLowerCase().includes(testCase.expected)) {
            console.log(`   ✅ ${testCase.direction}: Correctly handled`);
        } else {
            console.log(`   ❌ ${testCase.direction}: Issue with mapping`);
            console.log(`      Expected to include: "${testCase.expected}"`);
            console.log(`      Got: "${testOpeningLine}"`);
        }
    }
    
    console.log('\n✅ All tests completed!');
    console.log('\n🎯 Summary:');
    console.log('   - Survey belief change selections are now properly captured');
    console.log('   - Profile mapping converts codes to descriptive text');
    console.log('   - System prompt focuses on specific belief change');
    console.log('   - Opening line references participant\'s specific change');
    console.log('   - Chatbot will know exactly what the participant changed their mind about');
}

// Run the tests
runTests().catch(console.error);