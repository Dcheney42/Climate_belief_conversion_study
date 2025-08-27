async function testBeliefValidation() {
    console.log('Testing improved belief validation...');
    
    const testCases = [
        // Valid cases
        { prior_belief: 1, current_belief: 7, expected: 'valid', description: 'Valid integers 1-7' },
        { prior_belief: 2, current_belief: 5, expected: 'valid', description: 'Valid integers 1-7' },
        
        // Invalid cases - non-integers
        { prior_belief: 1.5, current_belief: 7, expected: 'invalid', description: 'Float prior belief' },
        { prior_belief: 1, current_belief: 7.2, expected: 'invalid', description: 'Float current belief' },
        
        // Invalid cases - out of range
        { prior_belief: 0, current_belief: 7, expected: 'invalid', description: 'Prior belief too low' },
        { prior_belief: 1, current_belief: 8, expected: 'invalid', description: 'Current belief too high' },
        { prior_belief: -1, current_belief: 5, expected: 'invalid', description: 'Negative prior belief' },
        
        // Invalid cases - strings
        { prior_belief: "1", current_belief: "7", expected: 'valid', description: 'String numbers (should convert)' },
        { prior_belief: "abc", current_belief: 7, expected: 'invalid', description: 'Non-numeric string' },
        { prior_belief: 1, current_belief: null, expected: 'invalid', description: 'Null current belief' },
    ];
    
    for (const testCase of testCases) {
        try {
            console.log(`\nTesting: ${testCase.description}`);
            
            const response = await fetch('http://localhost:3000/survey/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    age: 25,
                    gender: 'Man',
                    country: 'Australia',
                    education: 'Bachelor',
                    political_orientation: 4,
                    prior_belief: testCase.prior_belief,
                    current_belief: testCase.current_belief,
                    consent: true
                })
            });
            
            const result = await response.json();
            
            if (testCase.expected === 'valid') {
                if (response.ok) {
                    console.log('✅ PASS: Valid input accepted');
                } else {
                    console.log('❌ FAIL: Valid input rejected:', result);
                }
            } else {
                if (!response.ok && response.status === 400) {
                    console.log('✅ PASS: Invalid input properly rejected:', result.error);
                } else {
                    console.log('❌ FAIL: Invalid input not rejected properly:', result);
                }
            }
            
        } catch (error) {
            console.error('❌ Test error:', error);
        }
    }
    
    console.log('\n✅ Belief validation testing completed!');
}

testBeliefValidation();