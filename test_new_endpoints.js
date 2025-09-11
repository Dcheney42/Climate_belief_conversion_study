const http = require('http');

function testEndpoint(path, description) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log(`\n${description}:`);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${data}`);
                resolve();
            });
        });

        req.on('error', (e) => {
            console.log(`\n${description}:`);
            console.log(`Error: ${e.message}`);
            resolve();
        });

        req.end();
    });
}

async function runTests() {
    console.log('Testing new endpoints...');
    
    await testEndpoint('/health', 'Health endpoint test');
    await testEndpoint('/debug/last-session', 'Debug last session test');
    
    console.log('\nTests completed!');
}

runTests();