async function testFallbackEndpoints() {
    console.log('Testing fallback chat endpoints...');
    
    try {
        // Test /chat/start endpoint
        console.log('\n1. Testing /chat/start endpoint...');
        const startResponse = await fetch('http://localhost:3000/chat/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: 'test-user-123' })
        });
        
        if (!startResponse.ok) {
            console.log('Start response status:', startResponse.status);
            const errorText = await startResponse.text();
            console.log('Start error:', errorText);
            return;
        }
        
        const startData = await startResponse.json();
        console.log('Start response:', startData);
        
        if (!startData.conversationId) {
            console.log('No conversationId in response');
            return;
        }
        
        // Test /chat/reply endpoint
        console.log('\n2. Testing /chat/reply endpoint...');
        const replyResponse = await fetch('http://localhost:3000/chat/reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                conversationId: startData.conversationId, 
                message: 'Hello, I want to talk about climate change.' 
            })
        });
        
        if (!replyResponse.ok) {
            console.log('Reply response status:', replyResponse.status);
            const errorText = await replyResponse.text();
            console.log('Reply error:', errorText);
            return;
        }
        
        const replyData = await replyResponse.json();
        console.log('Reply response:', replyData);
        
        console.log('\n✅ Fallback endpoints are working correctly!');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testFallbackEndpoints();