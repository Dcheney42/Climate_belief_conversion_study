async function testHealthCheck() {
    console.log('Testing health check endpoint...');
    
    try {
        const response = await fetch('http://localhost:3000/healthz');
        
        if (!response.ok) {
            console.log('Health check failed with status:', response.status);
            return;
        }
        
        const data = await response.json();
        console.log('Health check response:', data);
        
        // Validate expected fields
        const expectedFields = ['ok', 'time', 'chatRouterMounted', 'activeConversations'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length > 0) {
            console.log('Missing fields:', missingFields);
        } else {
            console.log('✅ Health check endpoint working correctly!');
            console.log(`- Server is healthy: ${data.ok}`);
            console.log(`- Current time: ${data.time}`);
            console.log(`- Chat router mounted: ${data.chatRouterMounted}`);
            console.log(`- Active conversations: ${data.activeConversations}`);
        }
        
    } catch (error) {
        console.error('Health check test failed:', error);
    }
}

testHealthCheck();