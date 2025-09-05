const axios = require('axios');

async function testAISummary() {
    const baseUrl = 'http://localhost:3000/api/generate-summary';
    
    console.log('Testing AI Summary Endpoint...\n');
    
    // Test 1: Empty boxes (should return empty string)
    console.log('Test 1: Both boxes empty');
    try {
        const response1 = await axios.post(baseUrl, {
            currentViews: '',
            elaboration: ''
        });
        console.log('Result:', JSON.stringify(response1.data));
        console.log('Expected: Empty summary\n');
    } catch (error) {
        console.log('Error:', error.response?.data || error.message);
    }
    
    // Test 2: Short answer (should return as-is)
    console.log('Test 2: Short answer');
    try {
        const response2 = await axios.post(baseUrl, {
            currentViews: 'Climate change is real',
            elaboration: ''
        });
        console.log('Result:', JSON.stringify(response2.data));
        console.log('Expected: Should return the short text as-is\n');
    } catch (error) {
        console.log('Error:', error.response?.data || error.message);
    }
    
    // Test 3: Longer text (should create assertion)
    console.log('Test 3: Longer text that needs summarizing');
    try {
        const response3 = await axios.post(baseUrl, {
            currentViews: 'I used to think climate change was not that serious, but after reading several scientific studies and watching documentaries about the effects of global warming, I now believe it is one of the most pressing issues of our time.',
            elaboration: 'The evidence from ice core data and temperature records convinced me that human activities are the primary driver of recent climate change.'
        });
        console.log('Result:', JSON.stringify(response3.data));
        console.log('Expected: Single sentence assertion about their belief\n');
    } catch (error) {
        console.log('Error:', error.response?.data || error.message);
    }
    
    // Test 4: Only elaboration filled
    console.log('Test 4: Only elaboration box filled');
    try {
        const response4 = await axios.post(baseUrl, {
            currentViews: '',
            elaboration: 'Scientific evidence shows that climate change is happening faster than previously predicted and requires immediate action.'
        });
        console.log('Result:', JSON.stringify(response4.data));
        console.log('Expected: Single sentence assertion based on elaboration only\n');
    } catch (error) {
        console.log('Error:', error.response?.data || error.message);
    }
}

testAISummary().catch(console.error);