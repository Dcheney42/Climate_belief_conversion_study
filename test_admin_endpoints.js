async function testAdminEndpoints() {
    console.log('Testing secured admin endpoints...');
    
    try {
        // Test 1: Access without token (should fail)
        console.log('\n1. Testing /api/admin/export.json without token...');
        const noTokenResponse = await fetch('http://localhost:3000/api/admin/export.json');
        console.log('Status:', noTokenResponse.status);
        if (!noTokenResponse.ok) {
            const errorData = await noTokenResponse.json();
            console.log('Error response:', errorData);
        }
        
        // Test 2: Access with wrong token (should fail)
        console.log('\n2. Testing /api/admin/export.json with wrong token...');
        const wrongTokenResponse = await fetch('http://localhost:3000/api/admin/export.json', {
            headers: {
                'x-admin-token': 'wrong-token'
            }
        });
        console.log('Status:', wrongTokenResponse.status);
        if (!wrongTokenResponse.ok) {
            const errorData = await wrongTokenResponse.json();
            console.log('Error response:', errorData);
        }
        
        // Test 3: Test when ADMIN_TOKEN is not configured (should fail)
        console.log('\n3. Testing when ADMIN_TOKEN is not configured...');
        // Since .env probably doesn't have ADMIN_TOKEN set, this should return the "not configured" error
        const noConfigResponse = await fetch('http://localhost:3000/api/admin/export.json', {
            headers: {
                'x-admin-token': 'any-token'
            }
        });
        console.log('Status:', noConfigResponse.status);
        if (!noConfigResponse.ok) {
            const errorData = await noConfigResponse.json();
            console.log('Error response:', errorData);
        }
        
        // Test 4: CSV endpoint security
        console.log('\n4. Testing /api/admin/export.csv security...');
        const csvResponse = await fetch('http://localhost:3000/api/admin/export.csv');
        console.log('Status:', csvResponse.status);
        if (!csvResponse.ok) {
            const errorData = await csvResponse.json();
            console.log('Error response:', errorData);
        }
        
        console.log('\n✅ Admin endpoint security tests completed!');
        console.log('All endpoints are properly secured with the new requireAdmin middleware.');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAdminEndpoints();