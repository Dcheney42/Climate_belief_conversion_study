// Test script to validate conversation flow threshold changes
// This simulates the conversation scenario that was ending prematurely

import { conversationStateManager } from './backend/src/utils/conversationStateManager.js';

async function testConversationFlow() {
  console.log('🧪 Testing conversation flow with updated thresholds...\n');
  
  const conversationId = 'test-conversation-' + Date.now();
  
  // Simulate the problematic conversation sequence
  const conversationSteps = [
    { user: "Yeah my beliefs changed", turn: 1 },
    { user: "Yeah I think i got sick of all the negatve media about it while the weather at my place is getting better", turn: 2 },
    { user: "Whats?", turn: 3 }, // This was triggering minimal response
    { user: "yeah why am i like this?", turn: 4 },
    { user: "Ok cool. Umm yeah, the media is bad about it", turn: 5 },
    { user: "Yeah", turn: 6 }, // Another minimal response
    { user: "I guess so", turn: 7 }, // Another minimal response
    { user: "Maybe", turn: 8 }, // Another minimal response
    { user: "I don't know, just started thinking differently", turn: 9 },
    { user: "It was gradual I think", turn: 10 }
  ];
  
  console.log('Simulating conversation steps...\n');
  
  for (const step of conversationSteps) {
    console.log(`Turn ${step.turn}: User says "${step.user}"`);
    
    // Update conversation state
    const state = await conversationStateManager.updateConversationState(conversationId, step.user);
    
    console.log(`  📊 State: ${state.stage} stage, ${state.turnCount} turns, ${state.minimalResponseCount} minimal, ${state.exhaustionSignals} exhaustion`);
    
    // Check if conversation would advance stages
    const shouldAdvanceToElab = conversationStateManager.shouldAdvanceToElaboration(state);
    const shouldAdvanceToRecap = conversationStateManager.shouldAdvanceToRecap(state);
    const shouldTriggerSummary = conversationStateManager.shouldTriggerSummary(state);
    
    console.log(`  🔍 Stage checks: Elaboration=${shouldAdvanceToElab}, Recap=${shouldAdvanceToRecap}, Summary=${shouldTriggerSummary}`);
    
    if (shouldTriggerSummary) {
      console.log(`  ⚠️  CONVERSATION WOULD END HERE (Turn ${step.turn})`);
      break;
    }
    
    if (shouldAdvanceToRecap) {
      console.log(`  ↗️  Would advance to RECAP stage`);
      state.stage = 'recap';
    } else if (shouldAdvanceToElab && state.stage === 'exploration') {
      console.log(`  ↗️  Would advance to ELABORATION stage`);
      state.stage = 'elaboration';
    }
    
    console.log('');
  }
  
  // Get final state
  const finalState = await conversationStateManager.getConversationState(conversationId);
  
  console.log('📋 Final Results:');
  console.log(`   Stage: ${finalState.stage}`);
  console.log(`   Turn Count: ${finalState.turnCount}`);
  console.log(`   Minimal Responses: ${finalState.minimalResponseCount}`);
  console.log(`   Exhaustion Signals: ${finalState.exhaustionSignals}`);
  console.log(`   Should Trigger Summary: ${conversationStateManager.shouldTriggerSummary(finalState)}`);
  
  console.log('\n✅ Test completed. Conversation should now continue longer before ending.');
  
  // Clean up
  await conversationStateManager.deleteConversationState(conversationId);
}

// Test original thresholds for comparison
function testOriginalThresholds() {
  console.log('\n🧪 Testing ORIGINAL thresholds for comparison...\n');
  
  // Original threshold logic
  function originalShouldAdvanceToElaboration(state) {
    return (state.substantiveResponseCount >= 3 && state.turnCount >= 5) ||
           (state.minimalResponseCount >= 2 && state.turnCount >= 4);
  }
  
  function originalShouldTriggerSummary(state) {
    return state.stage === 'recap' ||
           state.exhaustionSignals >= 3 ||
           state.minimalResponseCount >= 4 ||
           (state.topicTurnCount >= 4 && state.stage !== 'exploration');
  }
  
  // Simulate the same conversation with original thresholds
  let mockState = {
    stage: 'exploration',
    turnCount: 0,
    minimalResponseCount: 0,
    substantiveResponseCount: 0,
    exhaustionSignals: 0,
    topicTurnCount: 1,
    lastTopic: 'general'
  };
  
  const steps = [
    "Yeah my beliefs changed",
    "Yeah I think i got sick of all the negatve media about it while the weather at my place is getting better", 
    "Whats?", // minimal
    "yeah why am i like this?", 
    "Ok cool. Umm yeah, the media is bad about it"
  ];
  
  for (let i = 0; i < steps.length; i++) {
    const text = steps[i];
    mockState.turnCount++;
    
    // Simple minimal response check
    const isMinimal = text.trim().split(/\s+/).length <= 3;
    if (isMinimal) {
      mockState.minimalResponseCount++;
      mockState.substantiveResponseCount = 0;
    } else {
      mockState.substantiveResponseCount++;
      mockState.minimalResponseCount = 0;
    }
    
    console.log(`Turn ${i + 1}: "${text}" (minimal: ${isMinimal})`);
    console.log(`  State: ${mockState.minimalResponseCount} minimal, ${mockState.turnCount} turns`);
    
    if (originalShouldAdvanceToElaboration(mockState)) {
      console.log('  ↗️  Would advance to ELABORATION with original thresholds');
      mockState.stage = 'elaboration';
    }
    
    if (originalShouldTriggerSummary(mockState)) {
      console.log(`  ⚠️  CONVERSATION WOULD END HERE with original thresholds (Turn ${i + 1})`);
      break;
    }
  }
}

// Run tests
async function runTests() {
  try {
    await testConversationFlow();
    testOriginalThresholds();
  } catch (error) {
    console.error('Test error:', error);
  }
}

runTests();