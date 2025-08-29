// backend/src/routes/chat.js
import express from "express";
import crypto from "node:crypto";
import { renderSystemPrompt } from "../utils/systemPrompt.js";
import { openingLineFrom } from "../utils/openingLine.js";
import { enforceOnTopic, redirectLine } from "../utils/onTopic.js";

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

    const safeReply = enforceOnTopic(modelReply) ? modelReply : redirectLine();

    await appendMessage(conversationId, { role: "user", content: userText });
    await appendMessage(conversationId, { role: "assistant", content: safeReply });

    res.json({ reply: safeReply });
  } catch (err) {
    console.error("chat/reply error", err);
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

export default router;