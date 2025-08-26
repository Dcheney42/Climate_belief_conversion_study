// Test script to validate eligibility logic
console.log('=== ELIGIBILITY LOGIC TEST ===\n');

function testEligibility(prior, current) {
    const priorBeliefNum = parseInt(prior);
    const currentBeliefNum = parseInt(current);
    
    // Same logic as server.js
    const eligible = (priorBeliefNum < 4 && currentBeliefNum > 4) || (priorBeliefNum > 4 && currentBeliefNum < 4);
    
    return {
        prior: priorBeliefNum,
        current: currentBeliefNum,
        eligible,
        direction: priorBeliefNum < 4 && currentBeliefNum > 4 ? 'skeptical→believing' : 
                  priorBeliefNum > 4 && currentBeliefNum < 4 ? 'believing→skeptical' : 'no_change'
    };
}

// Test all combinations that SHOULD be eligible
console.log('🔍 TESTING ELIGIBLE COMBINATIONS (should all return TRUE):\n');

// Skeptical to Believing (prior < 4, current > 4)
const skepticalToBeliever = [
    [1, 5], [1, 6], [1, 7],
    [2, 5], [2, 6], [2, 7], 
    [3, 5], [3, 6], [3, 7]
];

// Believing to Skeptical (prior > 4, current < 4)
const believerToSkeptical = [
    [5, 1], [5, 2], [5, 3],
    [6, 1], [6, 2], [6, 3],
    [7, 1], [7, 2], [7, 3]
];

let allPassed = true;

console.log('📈 SKEPTICAL → BELIEVING:');
skepticalToBeliever.forEach(([prior, current]) => {
    const result = testEligibility(prior, current);
    const status = result.eligible ? '✅' : '❌ FAILED';
    console.log(`  Prior=${prior}, Current=${current} → ${status} (${result.direction})`);
    if (!result.eligible) allPassed = false;
});

console.log('\n📉 BELIEVING → SKEPTICAL:');
believerToSkeptical.forEach(([prior, current]) => {
    const result = testEligibility(prior, current);
    const status = result.eligible ? '✅' : '❌ FAILED';
    console.log(`  Prior=${prior}, Current=${current} → ${status} (${result.direction})`);
    if (!result.eligible) allPassed = false;
});

// Test some combinations that should NOT be eligible
console.log('\n🚫 TESTING INELIGIBLE COMBINATIONS (should all return FALSE):\n');

const shouldBeIneligible = [
    [1, 1], [1, 2], [1, 3], [1, 4], // staying skeptical or moving to neutral
    [2, 2], [2, 3], [2, 4],
    [3, 3], [3, 4], 
    [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], // from neutral
    [5, 4], [5, 5], [5, 6], [5, 7], // staying believing or moving to neutral
    [6, 4], [6, 5], [6, 6], [6, 7],
    [7, 4], [7, 5], [7, 6], [7, 7]
];

console.log('❌ SHOULD BE INELIGIBLE:');
shouldBeIneligible.forEach(([prior, current]) => {
    const result = testEligibility(prior, current);
    const status = !result.eligible ? '✅' : '❌ FAILED - Should be ineligible!';
    console.log(`  Prior=${prior}, Current=${current} → ${status}`);
    if (result.eligible) allPassed = false;
});

// Summary
console.log('\n=== SUMMARY ===');
if (allPassed) {
    console.log('🎉 ALL TESTS PASSED - Eligibility logic is correct!');
} else {
    console.log('💥 SOME TESTS FAILED - There are bugs in the eligibility logic!');
}

// Test the specific case from the user
console.log('\n=== USER\'S SPECIFIC CASE ===');
const userResult = testEligibility(2, 6);
console.log(`Prior=2, Current=6 → ${userResult.eligible ? '✅ SHOULD BE ELIGIBLE' : '❌ INCORRECTLY INELIGIBLE'}`);
console.log(`Direction: ${userResult.direction}`);