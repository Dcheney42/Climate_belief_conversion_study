// backend/src/routes/chat.js
import express from "express";
import crypto from "node:crypto";
import { renderSystemPrompt } from "../utils/systemPrompt.js";
import { openingLineFrom } from "../utils/openingLine.js";
import { enforceOnTopic, redirectLine, detectPoliticalDrift, detectBeliefDrift, detectActionRoleDrift } from "../utils/onTopic.js";

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

const router = express.Router();

router.post("/start", async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const conversationId = req.body.conversationId || crypto.randomUUID();

    console.log("🔍 Chat start - userId:", userId);
    const profile = await getParticipantProfile(userId);
    console.log("🔍 Retrieved profile:", JSON.stringify(profile, null, 2));
    
    const systemPrompt = renderSystemPrompt(profile);
    const openingLine = openingLineFrom(profile);
    console.log("🔍 Generated opening line:", openingLine);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "assistant", content: openingLine }
    ];

    await saveConversation(userId, conversationId, messages);
    res.json({ conversationId, messages });
  } catch (err) {
    console.error("chat/start error", err);
    res.status(500).json({ error: "Failed to start chat" });
  }
});

router.post("/reply", async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    const userText = message;
    const history = await loadMessages(conversationId);

    // Check for early-end phrase
    if (/\bend the chat\b/i.test(userText.trim())) {
      // Add user message
      await appendMessage(conversationId, { role: "user", content: userText });
      
      // Extract userId to ensure conversation has a summary before ending
      const userId = req.user?.id || req.body.userId ||
        history.find(msg => msg.userId)?.userId ||
        history.find(msg => msg.role === 'system')?.userId;
      
      if (userId) {
        console.log('⚠️ Early chat end detected, ensuring summary exists for user:', userId);
        await ensureConversationSummary(conversationId, userId);
      } else {
        console.warn('Could not determine userId for summary generation on early end');
      }
      
      // Add final assistant message
      const finalReply = "Okay — ending the chat now. Thanks for participating!";
      await appendMessage(conversationId, { role: "assistant", content: finalReply });
      
      // Return with sessionEnded flag
      return res.json({ reply: finalReply, sessionEnded: true });
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

    const next = await callModel([...history, { role: "user", content: userText }]);
    const modelReply = next?.content || "";

    // Check for interview completion marker
    if (modelReply.includes("##INTERVIEW_COMPLETE##")) {
      // Remove the marker from the visible reply
      const visibleReply = modelReply.replace("##INTERVIEW_COMPLETE##", "").trim();
      
      await appendMessage(conversationId, { role: "user", content: userText });
      await appendMessage(conversationId, { role: "assistant", content: visibleReply });
      
      // Extract userId to ensure conversation has a summary (though it should already have one)
      const userId = req.user?.id || req.body.userId ||
        history.find(msg => msg.userId)?.userId ||
        history.find(msg => msg.role === 'system')?.userId;
      
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
    
    // Check for various types of drift
    if (!enforceOnTopic(modelReply)) {
      safeReply = redirectLine();
    } else if (detectPoliticalDrift(modelReply)) {
      driftType = 'political';
      safeReply = redirectLine(driftType);
    } else if (detectActionRoleDrift(modelReply)) {
      // Chatbot is discussing roles/actions rather than belief change narrative
      driftType = 'action';
      safeReply = redirectLine(driftType);
    } else if (detectBeliefDrift(userText)) {
      // User indicated we're off topic from belief change
      driftType = 'belief';
      safeReply = redirectLine(driftType);
    }

    await appendMessage(conversationId, { role: "user", content: userText });
    await appendMessage(conversationId, { role: "assistant", content: safeReply });

    res.json({ reply: safeReply });
  } catch (err) {
    console.error("chat/reply error", err);
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

export default router;