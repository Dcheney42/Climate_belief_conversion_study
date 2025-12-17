// backend/src/routes/chat.js
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { renderSystemPrompt } from "../utils/systemPrompt.js";
import { openingLineFrom } from "../utils/openingLine.js";
import { enforceOnTopic, redirectLine, detectPoliticalDrift, detectBeliefDrift, detectActionRoleDrift } from "../utils/onTopic.js";

// Conversation flow tracking
const conversationStates = new Map(); // In-memory tracking for conversation states

// Conversation tracking functions
function initializeConversationState(conversationId) {
  if (!conversationStates.has(conversationId)) {
    conversationStates.set(conversationId, {
      stage: 'exploration', // exploration -> elaboration -> recap -> complete
      turnCount: 0,
      topicTurnCount: 0,
      lastTopic: null,
      minimalResponseCount: 0,
      substantiveResponseCount: 0,
      exhaustionSignals: 0,
      lastUserResponse: null,
      // Enhanced narrative tracking
      exploredTopics: new Set(), // Track what has been asked about
      lastAssistantResponse: null, // Track AI's last response for pattern detection
      narrativeUnderstanding: {
        mainStory: null, // User's core belief change narrative
        influences: [], // People/events that influenced them
        causeEffectRelationships: [], // Track understood relationships
        misunderstandingFlags: 0 // Track potential comprehension issues
      },
      responsePatterns: {
        lastOpeningPhrase: null, // Track opening phrases to ensure variation
        consecutiveSimilarResponses: 0 // Prevent formulaic responses
      }
    });
  }
  return conversationStates.get(conversationId);
}

function updateConversationState(conversationId, userText, assistantResponse = null) {
  const state = initializeConversationState(conversationId);
  state.turnCount++;
  
  // Detect current topic from user response (simplified)
  const currentTopic = extractTopic(userText);
  if (currentTopic === state.lastTopic) {
    state.topicTurnCount++;
  } else {
    state.topicTurnCount = 1;
    state.lastTopic = currentTopic;
  }
  
  // Track explored topics to prevent repetition
  state.exploredTopics.add(currentTopic);
  
  // Classify response as minimal or substantive
  if (isMinimalResponse(userText)) {
    state.minimalResponseCount++;
    state.substantiveResponseCount = 0; // Reset substantive counter
  } else {
    state.substantiveResponseCount++;
    state.minimalResponseCount = 0; // Reset minimal counter
  }
  
  // Track exhaustion signals
  if (isExhaustionSignal(userText)) {
    state.exhaustionSignals++;
  } else {
    state.exhaustionSignals = Math.max(0, state.exhaustionSignals - 1); // Decay
  }
  
  // Enhanced narrative understanding tracking
  updateNarrativeUnderstanding(state, userText);
  
  // Track assistant response patterns if provided
  if (assistantResponse) {
    updateResponsePatterns(state, assistantResponse);
  }
  
  state.lastUserResponse = userText;
  state.lastAssistantResponse = assistantResponse;
  
  // Auto-advance stages based on conversation progress
  if (state.stage === 'exploration' && shouldAdvanceToElaboration(state)) {
    state.stage = 'elaboration';
    console.log('🔄 Auto-advancing to elaboration stage');
  } else if (state.stage === 'elaboration' && shouldAdvanceToRecap(state)) {
    state.stage = 'recap';
    console.log('🔄 Auto-advancing to recap stage');
  }
  
  return state;
}

// Enhanced narrative understanding tracking
function updateNarrativeUnderstanding(state, userText) {
  const text = userText.toLowerCase();
  
  // Extract potential influences and their direction
  if (text.includes('uncle') || text.includes('family') || text.includes('friend')) {
    const influence = extractInfluenceFromText(userText);
    if (influence && !state.narrativeUnderstanding.influences.some(i => i.person === influence.person)) {
      state.narrativeUnderstanding.influences.push(influence);
      console.log('📝 Tracked new influence:', influence);
    }
  }
  
  // Detect cause-effect relationships
  if (text.includes('because') || text.includes('so') || text.includes('since') || text.includes('made me')) {
    const relationship = extractCauseEffectFromText(userText);
    if (relationship) {
      state.narrativeUnderstanding.causeEffectRelationships.push(relationship);
      console.log('📝 Tracked cause-effect relationship:', relationship);
    }
  }
  
  // Update main story if this seems to be the core narrative
  if (isMainStoryContent(userText)) {
    state.narrativeUnderstanding.mainStory = userText;
    console.log('📝 Updated main story understanding');
  }
}

// Track assistant response patterns to prevent repetition
function updateResponsePatterns(state, assistantResponse) {
  if (!assistantResponse) return;
  
  // Extract opening phrase pattern
  const openingPhrase = extractOpeningPhrase(assistantResponse);
  if (openingPhrase) {
    if (openingPhrase === state.responsePatterns.lastOpeningPhrase) {
      state.responsePatterns.consecutiveSimilarResponses++;
      console.log('⚠️ Detected repetitive opening phrase:', openingPhrase);
    } else {
      state.responsePatterns.consecutiveSimilarResponses = 0;
    }
    state.responsePatterns.lastOpeningPhrase = openingPhrase;
  }
}

// Helper functions for narrative analysis
function extractInfluenceFromText(text) {
  const lowerText = text.toLowerCase();
  let person = null;
  let direction = null;
  
  if (lowerText.includes('uncle')) person = 'uncle';
  else if (lowerText.includes('friend')) person = 'friend';
  else if (lowerText.includes('family')) person = 'family member';
  
  if (person) {
    // Determine direction of influence
    if (lowerText.includes('made me reject') || lowerText.includes('got sick of') ||
        lowerText.includes('started believing the opposite') || lowerText.includes('turned me off')) {
      direction = 'away_from';
    } else if (lowerText.includes('convinced me') || lowerText.includes('helped me believe') ||
               lowerText.includes('made me think')) {
      direction = 'toward';
    }
    
    return { person, direction, text: text.substring(0, 100) };
  }
  return null;
}

function extractCauseEffectFromText(text) {
  // Simple extraction of cause-effect patterns
  const simplified = text.substring(0, 150);
  return { relationship: simplified, timestamp: Date.now() };
}

function isMainStoryContent(text) {
  const words = text.split(' ').length;
  return words > 10 && (
    text.toLowerCase().includes('changed') ||
    text.toLowerCase().includes('believe') ||
    text.toLowerCase().includes('think')
  );
}

function extractOpeningPhrase(response) {
  const match = response.match(/^([^.!?]*[.!?])/);
  return match ? match[1].trim().substring(0, 50) : null;
}

function extractTopic(userText) {
  // Simple topic extraction - look for key themes
  const text = userText.toLowerCase();
  if (text.includes('bushfire') || text.includes('fire')) return 'bushfires';
  if (text.includes('news') || text.includes('media')) return 'news';
  if (text.includes('evidence') || text.includes('research')) return 'evidence';
  if (text.includes('people') || text.includes('family') || text.includes('friend')) return 'social';
  return 'general';
}

function isMinimalResponse(userText) {
  const text = userText.trim().toLowerCase();
  const wordCount = text.split(/\s+/).length;
  
  // Patterns that indicate minimal responses
  const minimalPatterns = [
    /^(yeah|yes|no|nah|ok|okay|sure|maybe|i guess|dunno|don't know)$/i,
    /^(that's all|nothing else|no more|can't think of anything)$/i,
    /^(i've said everything|that's it|finished|done)$/i
  ];
  
  return wordCount <= 3 || minimalPatterns.some(pattern => pattern.test(text));
}

function isExhaustionSignal(userText) {
  const text = userText.trim().toLowerCase();
  const exhaustionPatterns = [
    /that's all i've got/i,
    /nothing else to say/i,
    /can't think of anything/i,
    /i've said everything/i,
    /^no$/i,
    /^nah$/i,
    /^finish$/i,
    /^done$/i,
    /^finished$/i
  ];
  
  return exhaustionPatterns.some(pattern => pattern.test(text));
}

function shouldAdvanceToElaboration(state) {
  // Advance to elaboration after sufficient exploration or if user is showing fatigue
  // Increased thresholds to allow more natural conversation development
  return (state.substantiveResponseCount >= 3 && state.turnCount >= 8) ||
         (state.minimalResponseCount >= 5 && state.turnCount >= 8);
}

function shouldAdvanceToRecap(state) {
  // Advance to recap stage if user shows completion signals or after sufficient conversation
  // Increased thresholds to allow more natural conversation development
  return state.exhaustionSignals >= 4 ||
         state.minimalResponseCount >= 6 ||
         (state.turnCount >= 15 && state.substantiveResponseCount >= 3);
}

function shouldTriggerSummary(state) {
  // Trigger summary if in recap stage and user is indicating completion
  // Increased thresholds to allow more natural conversation development
  return state.stage === 'recap' ||
         state.exhaustionSignals >= 5 ||
         state.minimalResponseCount >= 8 ||
         (state.topicTurnCount >= 8 && state.stage !== 'exploration');
}

// Enhanced termination detection
function isTerminationRequest(userText) {
  const text = userText.trim();
  
  // Enhanced termination patterns
  const terminationPatterns = [
    /\b(end the chat|finish|done|wrap up|that's all|finished|end this)\b/i,
    /\bi'm (done|finished)\b/i,
    /\b(wrap|end|finish) (this|the conversation|up)\b/i,
    /\bthat's all i('ve| have) got\b/i
  ];
  
  return terminationPatterns.some(pattern => pattern.test(text));
}

// Repeated "no" detection
function isRepeatedNegative(userText, state) {
  const text = userText.trim().toLowerCase();
  return (text === 'no' || text === 'nah') &&
         state.lastUserResponse &&
         (state.lastUserResponse.trim().toLowerCase() === 'no' ||
          state.lastUserResponse.trim().toLowerCase() === 'nah');
}

// Replace these stubs with your real DB/model calls
async function getParticipantProfile(userId) {
  return await global.db.participants.getProfile(userId);
}
async function saveConversation(userId, conversationId, messages) {
  return await global.db.conversations.save(userId, conversationId, messages);
}
async function loadMessages(conversationId) {
  return await global.db.conversations.load(conversationId);
}
async function appendMessage(conversationId, message) {
  return await global.db.conversations.append(conversationId, message);
}

// Enhanced function to reliably get userId from conversationId
async function getUserIdFromConversation(conversationId) {
  try {
    console.log(`🔍 Getting userId for conversation: ${conversationId}`);
    
    // Try database first
    if (global.db?.conversations) {
      const conversation = await global.db.conversations.getMetadata(conversationId);
      if (conversation?.userId || conversation?.participantId) {
        const userId = conversation.userId || conversation.participantId;
        console.log(`✅ Found userId in database: ${userId}`);
        return userId;
      }
    }
    
    // Fallback to file-based lookup
    const conversationFile = `${conversationId}.json`;
    const conversationPath = path.join(process.cwd(), 'data', 'conversations', conversationFile);
    if (fs.existsSync(conversationPath)) {
      const conversationData = JSON.parse(fs.readFileSync(conversationPath, 'utf8'));
      if (conversationData.participantId || conversationData.userId) {
        const userId = conversationData.participantId || conversationData.userId;
        console.log(`✅ Found userId in file metadata: ${userId}`);
        return userId;
      }
    }
    
    console.warn(`⚠️ No userId found for conversation: ${conversationId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error getting userId for conversation ${conversationId}:`, error.message);
    return null;
  }
}

// Enhanced function to ensure system prompt is reconstructed with user profile
async function reconstructSystemPrompt(conversationId, userId = null, conversationState = null) {
  try {
    // Get userId if not provided
    if (!userId) {
      userId = await getUserIdFromConversation(conversationId);
    }
    
    if (!userId) {
      console.warn(`⚠️ Cannot reconstruct system prompt - no userId for conversation: ${conversationId}`);
      return null;
    }
    
    console.log(`🔄 Reconstructing system prompt for user: ${userId}, conversation: ${conversationId}`);
    
    // Get fresh participant profile
    const profile = await getParticipantProfile(userId);
    if (!profile) {
      console.warn(`⚠️ Cannot reconstruct system prompt - no profile found for user: ${userId}`);
      return null;
    }
    
    // Add conversation state info to profile if available
    const enhancedProfile = {
      ...profile,
      ...(conversationState && {
        conversation_stage: conversationState.stage,
        turn_count: conversationState.turnCount,
        topic_turn_count: conversationState.topicTurnCount,
        current_topic: conversationState.lastTopic
      })
    };
    
    // Generate fresh system prompt
    const systemPrompt = renderSystemPrompt(enhancedProfile);
    
    console.log(`✅ System prompt reconstructed for user: ${userId}`);
    console.log(`🔍 Profile used:`, JSON.stringify({
      views_changed: profile.views_changed,
      change_description: profile.change_description,
      change_confidence: profile.change_confidence
    }, null, 2));
    
    return systemPrompt;
  } catch (error) {
    console.error(`❌ Error reconstructing system prompt:`, error.message);
    return null;
  }
}
async function applyQuickUpdate(conversationId, updateText) {
  // Accept: update: field=value; field=value
  const pairs = updateText.split(/;|,/).map(s => s.trim()).filter(Boolean);
  const updates = {};
  for (const p of pairs) {
    const m = p.match(/^([\w_]+)\s*=\s*(.+)$/);
    if (m) updates[m[1]] = m[2];
  }
  if (Object.keys(updates).length) {
    await global.db.participants.updateFromConversation(conversationId, updates);
  }
  return updates;
}
// Wire this to your real LLM
async function callModel(messages) {
  return await global.llm.chat(messages); // must return { content: string }
}

// Summary generation functions for safety net
function hasExistingSummary(messages) {
  // Check if conversation already has a structured summary from the chatbot
  if (!messages || messages.length === 0) return false;
  
  // Look for assistant messages that contain bullet points or summary indicators
  const assistantMessages = messages.filter(msg => msg.role === 'assistant');
  
  for (const msg of assistantMessages.slice(-5)) { // Check last 5 assistant messages
    const content = msg.content || '';
    
    // Check for bullet point patterns
    if (content.includes('•') || content.includes('*') || content.includes('-')) {
      // Check if it has summary-like structure (multiple points)
      const bulletMatches = content.match(/[•\*\-]/g);
      if (bulletMatches && bulletMatches.length >= 2) {
        console.log('✓ Found existing summary with bullet points');
        return true;
      }
    }
    
    // Check for summary keywords
    if (content.toLowerCase().includes('summarize') ||
        content.toLowerCase().includes('summary') ||
        content.toLowerCase().includes('key themes') ||
        content.toLowerCase().includes('based on our conversation')) {
      console.log('✓ Found existing summary with keywords');
      return true;
    }
  }
  
  console.log('✗ No existing summary found in conversation');
  return false;
}

function generateFallbackSummary(messages, profile) {
  // Generate a basic summary from participant messages and profile
  const userMessages = messages.filter(msg => msg.role === 'user' &&
    msg.content &&
    msg.content.trim().length > 10 &&
    !msg.content.toLowerCase().includes('end the chat'));
  
  const summaryPoints = [];
  
  // Add profile-based summary point if available
  if (profile?.change_description) {
    summaryPoints.push(`You described how your climate change views changed: "${profile.change_description}"`);
  }
  
  // Analyze user messages for key themes
  const themes = {
    evidence: false,
    personal: false,
    social: false,
    media: false,
    change_process: false
  };
  
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase();
    
    if (content.includes('evidence') || content.includes('research') || content.includes('study') || content.includes('data')) {
      themes.evidence = true;
    }
    
    if (content.includes('experience') || content.includes('personal') || content.includes('saw') || content.includes('noticed') || content.includes('felt')) {
      themes.personal = true;
    }
    
    if (content.includes('people') || content.includes('family') || content.includes('friend') || content.includes('others')) {
      themes.social = true;
    }
    
    if (content.includes('media') || content.includes('news') || content.includes('article') || content.includes('tv')) {
      themes.media = true;
    }
    
    if (content.includes('change') || content.includes('shift') || content.includes('different') || content.includes('realized')) {
      themes.change_process = true;
    }
  });
  
  // Generate theme-based summary points
  if (themes.evidence) {
    summaryPoints.push('You discussed the role of evidence and research in shaping your views');
  }
  
  if (themes.personal) {
    summaryPoints.push('You shared personal experiences that influenced your thinking');
  }
  
  if (themes.social) {
    summaryPoints.push('You talked about how other people influenced your perspective');
  }
  
  if (themes.media) {
    summaryPoints.push('You mentioned media sources that affected your views');
  }
  
  if (themes.change_process) {
    summaryPoints.push('You described the process of how your beliefs evolved');
  }
  
  // Ensure we have at least 2 points
  if (summaryPoints.length < 2) {
    summaryPoints.push('You engaged in a conversation about your climate change belief journey');
    if (summaryPoints.length < 2) {
      summaryPoints.push('You shared your perspective on what influences belief change');
    }
  }
  
  // Limit to 5 points max
  const finalPoints = summaryPoints.slice(0, 5);
  
  console.log('Generated fallback summary with points:', finalPoints);
  return finalPoints;
}

async function ensureConversationSummary(conversationId, userId) {
  try {
    const messages = await loadMessages(conversationId);
    
    // Check if conversation already has a proper summary
    if (hasExistingSummary(messages)) {
      console.log('Conversation already has summary, no action needed');
      return;
    }
    
    // Get participant profile for context
    const profile = await getParticipantProfile(userId);
    
    // Generate fallback summary
    const summaryPoints = generateFallbackSummary(messages, profile);
    
    // Format as bullet points with proper spacing
    const summaryText = `Thank you for sharing your story with me. Let me summarize the key themes from our conversation:

${summaryPoints.map(point => `• ${point}`).join('\n\n')}

This covers the main points we discussed about your belief change journey.`;

    // Add the summary as a final assistant message
    await appendMessage(conversationId, {
      role: "assistant",
      content: summaryText,
      generated_summary: true // Flag to indicate this was auto-generated
    });
    
    console.log('✓ Generated and saved fallback summary for conversation:', conversationId);
    
  } catch (error) {
    console.error('Error ensuring conversation summary:', error);
    // Don't throw - this is a safety net, not critical path
  }
}

// Enhanced stage-specific instructions for the AI with narrative intelligence
function getStageInstructions(conversationState) {
  const {
    stage,
    turnCount,
    topicTurnCount,
    minimalResponseCount,
    exhaustionSignals,
    exploredTopics,
    narrativeUnderstanding,
    responsePatterns
  } = conversationState;
  
  let instructions = `\nCURRENT CONVERSATION CONTEXT:
- Stage: ${stage}
- Turn count: ${turnCount}
- Topic turn count: ${topicTurnCount}
- Minimal responses: ${minimalResponseCount}
- Exhaustion signals: ${exhaustionSignals}
- Explored topics: ${Array.from(exploredTopics || new Set()).join(', ')}
- Tracked influences: ${narrativeUnderstanding?.influences?.length || 0}
- Consecutive similar responses: ${responsePatterns?.consecutiveSimilarResponses || 0}

NARRATIVE UNDERSTANDING STATE:`;

  // Add narrative context if available
  if (narrativeUnderstanding?.influences?.length > 0) {
    instructions += `\n- Key influences identified: ${narrativeUnderstanding.influences.map(i => `${i.person} (${i.direction || 'unknown direction'})`).join(', ')}`;
  }
  
  if (narrativeUnderstanding?.mainStory) {
    instructions += `\n- Main story understanding: ${narrativeUnderstanding.mainStory.substring(0, 100)}...`;
  }

  instructions += `\n\nSTAGE-SPECIFIC GUIDANCE:`;

  switch (stage) {
    case 'exploration':
      instructions += `
- You are in the EXPLORATION stage
- Focus on understanding their belief change story
- Ask ONE open-ended question that invites narrative
- Pay careful attention to cause-effect relationships in their responses
- CRITICAL: Before responding, verify you understand what they actually said
- Avoid repetitive questions on the same topic
- If topic turn count >= 3, try a different angle or topic
- If user gives minimal responses (2+), consider advancing to elaboration`;
      break;
      
    case 'elaboration':
      instructions += `
- You are in the ELABORATION stage
- Help them reflect on key aspects of their change
- Ask about what stands out as most significant
- Compare their current vs previous views
- Build on the influences and relationships you've already identified
- If user shows exhaustion (2+ signals), prepare for summary
- If minimal responses >= 3, advance to recap`;
      break;
      
    case 'recap':
      instructions += `
- You are in the RECAP stage
- User is indicating completion readiness
- Summarize their story with bullet points using the narrative understanding you've built
- Use UP TO FIVE distinct key themes
- Include the influences and cause-effect relationships you've tracked
- Ask for confirmation and corrections
- Include ##INTERVIEW_COMPLETE## marker after confirmed summary`;
      break;
      
    default:
      instructions += `
- Standard interview protocol applies
- Focus on their personal belief change narrative`;
  }
  
  // Enhanced warnings with narrative intelligence
  if (topicTurnCount >= 3) {
    instructions += `
    
⚠️ REPETITION WARNING: You've been on the same topic for ${topicTurnCount} turns.
Try a different angle or move to a new topic to advance the conversation.
Available unexplored angles: Ask about timing, emotions, specific moments, comparison with past beliefs.`;
  }
  
  if (responsePatterns?.consecutiveSimilarResponses >= 2) {
    instructions += `
    
⚠️ RESPONSE PATTERN WARNING: You've used similar opening phrases ${responsePatterns.consecutiveSimilarResponses} times.
MUST vary your response style. Last opening phrase: "${responsePatterns.lastOpeningPhrase}"
Use different anchoring: "You mentioned...", "From what you describe...", "I understand that...", "That experience with..."`;
  }
  
  if (minimalResponseCount >= 2) {
    instructions += `
    
⚠️ USER FATIGUE: User has given ${minimalResponseCount} minimal responses.
Consider advancing to next stage or summarizing if sufficient content gathered.`;
  }
  
  if (exhaustionSignals >= 2) {
    instructions += `
    
⚠️ EXHAUSTION DETECTED: User showing completion signals (${exhaustionSignals}).
Prepare to summarize and conclude the interview using the narrative understanding you've built.`;
  }
  
  return instructions;
}

const router = express.Router();

router.post("/start", async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const conversationId = req.body.conversationId || crypto.randomUUID();

    if (!userId) {
      console.error("❌ No userId provided for chat start");
      return res.status(400).json({ error: "User ID is required to start chat" });
    }

    console.log("🔍 Chat start - userId:", userId, "conversationId:", conversationId);
    
    // Initialize conversation state
    const conversationState = initializeConversationState(conversationId);
    
    // Get participant profile
    const profile = await getParticipantProfile(userId);
    if (!profile) {
      console.error("❌ No profile found for userId:", userId);
      return res.status(404).json({ error: "Participant profile not found" });
    }
    
    console.log("✅ Retrieved profile:", JSON.stringify(profile, null, 2));
    
    // Generate system prompt and opening line
    const systemPrompt = renderSystemPrompt(profile);
    const openingLine = openingLineFrom(profile);
    console.log("✅ Generated opening line:", openingLine);

    const messages = [
      { role: "system", content: systemPrompt, userId }, // Store userId with system message
      { role: "assistant", content: openingLine }
    ];

    // Save conversation with userId metadata
    await saveConversation(userId, conversationId, messages);
    
    // Return without system message (client doesn't need to see it)
    const clientMessages = messages.filter(msg => msg.role !== 'system');
    res.json({ conversationId, messages: clientMessages });
  } catch (err) {
    console.error("❌ chat/start error:", err);
    res.status(500).json({ error: "Failed to start chat" });
  }
});

router.post("/reply", async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    const userText = message;
    const history = await loadMessages(conversationId);

    console.log("🔍 DEBUG: History loaded, message count:", history.length);
    console.log("🔍 DEBUG: First message role:", history[0]?.role);
    console.log("🔍 DEBUG: First message preview:", history[0]?.content?.substring(0, 100));

    // Initialize conversation state tracking
    const conversationState = updateConversationState(conversationId, userText);
    console.log("🔍 Conversation state:", conversationState);

    // Enhanced termination detection
    if (isTerminationRequest(userText) || isRepeatedNegative(userText, conversationState)) {
      // Add user message
      await appendMessage(conversationId, { role: "user", content: userText });
      
      // Extract userId using robust function
      const userId = req.user?.id || req.body.userId || await getUserIdFromConversation(conversationId);
      
      if (userId) {
        console.log('⚠️ Termination detected, ensuring summary exists for user:', userId);
        await ensureConversationSummary(conversationId, userId);
      } else {
        console.warn('Could not determine userId for summary generation on termination');
      }
      
      // Add final assistant message
      const finalReply = "Thank you for sharing your story with me. I appreciate your time and insights about your belief change experience.";
      await appendMessage(conversationId, { role: "assistant", content: finalReply });
      
      // Clean up conversation state
      conversationStates.delete(conversationId);
      
      // Return with sessionEnded flag
      return res.json({ reply: finalReply, sessionEnded: true });
    }

    // Check if we should auto-trigger summary based on conversation state
    if (shouldTriggerSummary(conversationState)) {
      console.log('🔄 Auto-triggering summary based on conversation state');
      
      // Add user message first
      await appendMessage(conversationId, { role: "user", content: userText });
      
      // Extract userId using robust function
      const userId = req.user?.id || req.body.userId || await getUserIdFromConversation(conversationId);
      
      if (userId) {
        await ensureConversationSummary(conversationId, userId);
        
        // Generate a transition message to summary
        const transitionReply = "I can see we've covered quite a bit about your belief change journey. Let me provide a summary of what you've shared so we can wrap up.";
        await appendMessage(conversationId, { role: "assistant", content: transitionReply });
        
        // Clean up conversation state
        conversationStates.delete(conversationId);
        
        return res.json({ reply: transitionReply, sessionEnded: true });
      }
    }

    // Quick corrections
    if (/^\s*update\s*:/i.test(userText)) {
      const updates = await applyQuickUpdate(conversationId, userText.replace(/^\s*update\s*:/i, "").trim());
      const ack = Object.keys(updates).length
        ? "Got it, I've updated that. Could you continue by explaining why your view changed (or stayed the same)?"
        : "I didn't detect any valid updates. Please use format: update: field=value; field=value";
      await appendMessage(conversationId, { role: "assistant", content: ack });
      return res.json({ reply: ack, updated: updates });
    }

    // Get userId using robust extraction function
    const userId = req.user?.id || req.body.userId || await getUserIdFromConversation(conversationId);
    
    if (!userId) {
      console.error('❌ Unable to determine user ID for conversation:', conversationId);
      throw new Error('Unable to determine user ID for system prompt generation');
    }
    
    // Reconstruct system prompt with fresh profile data
    const systemPrompt = await reconstructSystemPrompt(conversationId, userId, conversationState);
    
    if (!systemPrompt) {
      console.error('❌ Failed to reconstruct system prompt for user:', userId);
      throw new Error('Failed to reconstruct system prompt');
    }
    
    console.log("✅ Successfully reconstructed system prompt for user:", userId);
    console.log("🔍 Conversation stage:", conversationState.stage);
    console.log("🔍 System prompt preview:", systemPrompt.substring(0, 100) + "...");
    
    // Filter out any existing system messages from history to avoid duplication
    const historyWithoutSystem = history.filter(msg => msg.role !== 'system');
    
    // Add stage-aware instructions to system prompt
    const stageInstructions = getStageInstructions(conversationState);
    const enhancedSystemPrompt = systemPrompt + "\n\n" + stageInstructions;
    
    // Construct messages array for model call
    const messagesForModel = [
      { role: "system", content: enhancedSystemPrompt },
      ...historyWithoutSystem,
      { role: "user", content: userText }
    ];

    // 🔍 DEBUG: Log conversation context being sent to model
    console.log("🔍 DEBUG: Messages being sent to LLM:");
    console.log("🔍 System prompt length:", systemPrompt.length);
    console.log("🔍 History messages count:", historyWithoutSystem.length);
    console.log("🔍 Last 3 history messages:", historyWithoutSystem.slice(-3).map(m => ({
      role: m.role,
      content: m.content?.substring(0, 100) + (m.content?.length > 100 ? "..." : "")
    })));
    console.log("🔍 Current user message:", userText);

    // Call model with fresh system prompt + conversation history + new user message
    const next = await callModel(messagesForModel);
    const modelReply = next?.content || "";

    // 🔍 DEBUG: Log raw model response
    console.log("🔍 DEBUG: Raw LLM response:");
    console.log("🔍 Response length:", modelReply.length);
    console.log("🔍 Response preview:", modelReply.substring(0, 200) + (modelReply.length > 200 ? "..." : ""));

    // Check for interview completion marker
    if (modelReply.includes("##INTERVIEW_COMPLETE##")) {
      // Remove the marker from the visible reply
      const visibleReply = modelReply.replace("##INTERVIEW_COMPLETE##", "").trim();
      
      await appendMessage(conversationId, { role: "user", content: userText });
      await appendMessage(conversationId, { role: "assistant", content: visibleReply });
      
      // Extract userId using robust function
      const userId = req.user?.id || req.body.userId || await getUserIdFromConversation(conversationId);
      
      if (userId) {
        console.log('✓ Interview complete marker detected, ensuring summary exists for user:', userId);
        await ensureConversationSummary(conversationId, userId);
      } else {
        console.warn('Could not determine userId for summary verification on interview complete');
      }
      
      // Return with sessionEnded flag to trigger automatic redirection
      return res.json({ reply: visibleReply, sessionEnded: true });
    }

    let safeReply = modelReply;
    let driftType = 'general';
    let driftDetected = false;
    
    // 🔍 DEBUG: Check for various types of drift
    const isOffTopic = !enforceOnTopic(modelReply);
    const isPoliticalDrift = detectPoliticalDrift(modelReply);
    const isActionRoleDrift = detectActionRoleDrift(modelReply);
    const isBeliefDrift = detectBeliefDrift(userText);
    
    console.log("🔍 DEBUG: Drift detection results:");
    console.log("🔍 Off-topic:", isOffTopic);
    console.log("🔍 Political drift:", isPoliticalDrift);
    console.log("🔍 Action/role drift:", isActionRoleDrift);
    console.log("🔍 Belief drift (user):", isBeliefDrift);
    
    if (isOffTopic) {
      console.log("🔍 DRIFT: Using general redirect - off-topic detected");
      safeReply = redirectLine();
      driftDetected = true;
    } else if (isPoliticalDrift) {
      console.log("🔍 DRIFT: Using political redirect");
      driftType = 'political';
      safeReply = redirectLine(driftType);
      driftDetected = true;
    } else if (isActionRoleDrift) {
      console.log("🔍 DRIFT: Using action/role redirect");
      // Chatbot is discussing roles/actions rather than belief change narrative
      driftType = 'action';
      safeReply = redirectLine(driftType);
      driftDetected = true;
    } else if (isBeliefDrift) {
      console.log("🔍 DRIFT: Using belief redirect (user indicated off-topic)");
      // User indicated we're off topic from belief change
      driftType = 'belief';
      safeReply = redirectLine(driftType);
      driftDetected = true;
    } else {
      console.log("🔍 No drift detected - using original model response");
    }
    
    // 🔍 DEBUG: Log final response selection
    console.log("🔍 DEBUG: Final response selection:");
    console.log("🔍 Drift detected:", driftDetected);
    console.log("🔍 Drift type:", driftType);
    console.log("🔍 Final response preview:", safeReply.substring(0, 150) + (safeReply.length > 150 ? "..." : ""));

    // Update conversation state with assistant response for pattern tracking
    updateConversationState(conversationId, userText, safeReply);
    
    await appendMessage(conversationId, { role: "user", content: userText });
    await appendMessage(conversationId, { role: "assistant", content: safeReply });

    res.json({ reply: safeReply });
  } catch (err) {
    console.error("chat/reply error", err);
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

export default router;