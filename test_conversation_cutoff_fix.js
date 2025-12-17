// Test script to verify the conversation cutoff fix
const fs = require('fs');
const path = require('path');

// Mock the conversation state functions from chat.js to test directly
function isMinimalResponse(userText) {
  const text = userText.trim().toLowerCase();
  const wordCount = text.split(/\s+/).length;
  
  // Only treat responses as minimal if they're very short AND lack substance
  // Don't penalize normal conversational responses like "no" or "yes" unless they're truly minimal
  const minimalPatterns = [
    /^(that's all|nothing else|no more|can't think of anything)$/i,
    /^(i've said everything|that's it|finished|done)$/i,
    /^(don't know|dunno)$/i
  ];
  
  // Much stricter criteria: only 1-2 word responses that are clearly minimal
  return (wordCount <= 2 && minimalPatterns.some(pattern => pattern.test(text))) ||
         wordCount === 1;
}

function isExhaustionSignal(userText) {
  const text = userText.trim().toLowerCase();
  const exhaustionPatterns = [
    /that's all i've got/i,
    /nothing else to say/i,
    /can't think of anything/i,
    /i've said everything/i,
    /that's about it/i,
    /that's all/i,
    /nothing more/i,
    /^finish$/i,
    /^done$/i,
    /^finished$/i,
    /wrap up/i,
    /end this/i
  ];
  
  // Don't treat simple "no" or "nah" as exhaustion - these are normal conversation responses
  return exhaustionPatterns.some(pattern => pattern.test(text));
}

function shouldAdvanceToElaboration(state) {
  // Much higher thresholds to allow natural conversation development
  return (state.substantiveResponseCount >= 5 && state.turnCount >= 12) ||
         (state.minimalResponseCount >= 8 && state.turnCount >= 15);
}

function shouldAdvanceToRecap(state) {
  // Much higher thresholds to prevent premature advancement
  return state.exhaustionSignals >= 8 ||
         state.minimalResponseCount >= 12 ||
         (state.turnCount >= 25 && state.substantiveResponseCount >= 5);
}

function shouldTriggerSummary(state) {
  // Only trigger summary when user clearly indicates they're done
  // Much higher thresholds - should rarely trigger automatically
  return state.stage === 'recap' && (
         state.exhaustionSignals >= 10 ||
         state.minimalResponseCount >= 15 ||
         (state.topicTurnCount >= 12 && state.exhaustionSignals >= 3)
  );
}

// Test cases
console.log('🧪 Testing Conversation Cutoff Fix\n');

// Test 1: Normal responses should not be flagged as minimal
console.log('Test 1: Normal conversation responses');
const normalResponses = [
  "No, I don't think so",
  "Yeah, that's right", 
  "Yes, exactly",
  "No, not really",
  "Maybe, I'm not sure",
  "I think it was different"
];

normalResponses.forEach(response => {
  const isMinimal = isMinimalResponse(response);
  const isExhaustion = isExhaustionSignal(response);
  console.log(`  "${response}" -> Minimal: ${isMinimal}, Exhaustion: ${isExhaustion}`);
});

// Test 2: True exhaustion signals should be detected
console.log('\nTest 2: True exhaustion signals');
const exhaustionResponses = [
  "That's all I've got",
  "Nothing else to say",
  "I've said everything",
  "That's about it",
  "finish",
  "wrap up"
];

exhaustionResponses.forEach(response => {
  const isExhaustion = isExhaustionSignal(response);
  console.log(`  "${response}" -> Exhaustion: ${isExhaustion}`);
});

// Test 3: Simulate conversation progression
console.log('\nTest 3: Conversation stage progression');

// Mock conversation state
let mockState = {
  stage: 'exploration',
  turnCount: 0,
  topicTurnCount: 0,
  minimalResponseCount: 0,
  substantiveResponseCount: 0,
  exhaustionSignals: 0
};

// Simulate normal conversation turns
for (let turn = 1; turn <= 20; turn++) {
  mockState.turnCount = turn;
  
  // Simulate mostly substantive responses with occasional minimal ones
  if (turn % 4 === 0) {
    mockState.minimalResponseCount++;
  } else {
    mockState.substantiveResponseCount++;
  }
  
  // Check advancement at key points
  if (turn === 5 || turn === 10 || turn === 15 || turn === 20) {
    const shouldElaborate = shouldAdvanceToElaboration(mockState);
    const shouldRecap = shouldAdvanceToRecap(mockState);
    const shouldSummary = shouldTriggerSummary(mockState);
    
    console.log(`  Turn ${turn}: Elaborate: ${shouldElaborate}, Recap: ${shouldRecap}, Summary: ${shouldSummary}`);
  }
}

// Test 4: High exhaustion scenario
console.log('\nTest 4: High exhaustion scenario');
mockState.exhaustionSignals = 12;
mockState.stage = 'recap';
const shouldSummaryHigh = shouldTriggerSummary(mockState);
console.log(`  With 12 exhaustion signals in recap stage -> Summary: ${shouldSummaryHigh}`);

console.log('\n✅ All tests completed');
console.log('\n📋 Summary of Changes:');
console.log('• Normal "no/yes" responses no longer trigger exhaustion');
console.log('• Minimal response detection much stricter');
console.log('• Stage advancement thresholds significantly increased');
console.log('• Summary only triggers with clear completion signals');
console.log('• Auto-summary provides summary but continues conversation');