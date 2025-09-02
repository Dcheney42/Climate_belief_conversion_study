const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

// Enhanced chat router will be imported and mounted below

// Chat duration constant - 5 minutes
const CHAT_DURATION_MS = Number(process.env.CHAT_DURATION_MS ?? 5 * 60 * 1000);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Data storage directories
const dataDir = path.join(__dirname, 'data');
const participantsDir = path.join(dataDir, 'participants');
const conversationsDir = path.join(dataDir, 'conversations');
const exportsDir = path.join(dataDir, 'exports');

// Create data directories if they don't exist
[dataDir, participantsDir, conversationsDir, exportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Ensure core data directories exist with logging
[participantsDir, conversationsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created data dir:', dir);
  }
});

// In-memory storage for active conversations
const activeConversations = new Map();

// Global database and LLM shims for new chat functionality
global.db = global.db || {
  participants: {
    async getProfile(userId) {
      const filename = path.join(participantsDir, `${userId}.json`);
      const participant = readJson(filename);
      if (!participant) return null;
      
      // Map existing fields to expected structure for chat system
      return {
        views_changed: participant.viewsChanged || "unspecified",
        change_direction: participant.changeDirection || "unspecified",
        prior_belief_cc_happening: participant.priorClimateBelief,
        prior_belief_human_cause: "unspecified", // Not collected yet
        current_belief_cc_happening: participant.currentClimateBelief,
        current_belief_human_cause: "unspecified", // Not collected yet
        changed_belief_flag: participant.viewsChanged === 'Yes'
      };
    },
    async updateFromConversation(conversationId, updates) {
      const filename = path.join(conversationsDir, `${conversationId}.json`);
      const conv = readJson(filename);
      if (!conv) return;
      
      const participantFile = path.join(participantsDir, `${conv.participantId}.json`);
      const participant = readJson(participantFile);
      if (!participant) return;
      
      // Update participant with new fields
      Object.assign(participant, updates);
      participant.updatedAt = new Date().toISOString();
      writeJson(participantFile, participant);
    }
  },
  conversations: {
    async save(userId, conversationId, messages) {
      const conversationData = {
        id: conversationId,
        participantId: userId,
        startedAt: new Date().toISOString(),
        endedAt: null,
        durationSeconds: null,
        messages: messages
      };
      const filename = path.join(conversationsDir, `${conversationId}.json`);
      writeJson(filename, conversationData);
    },
    async load(conversationId) {
      const filename = path.join(conversationsDir, `${conversationId}.json`);
      const c = readJson(filename);
      return c?.messages || [];
    },
    async append(conversationId, message) {
      const filename = path.join(conversationsDir, `${conversationId}.json`);
      const c = readJson(filename);
      if (!c) return;
      
      const newMsgs = [...(c.messages || []), message];
      c.messages = newMsgs;
      writeJson(filename, c);
    }
  }
};

global.llm = global.llm || {
  async chat(messages) {
    // Use existing OpenAI integration
    if (!process.env.OPENAI_API_KEY) {
      return { content: "I'm here to help you explore your thoughts about climate change. Could you tell me more about your perspective?" };
    }
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      });
      
      return { content: completion.choices[0]?.message?.content?.trim() || "Could you tell me more about your thoughts?" };
    } catch (error) {
      console.error('LLM error:', error);
      return { content: "Could you tell me more about your thoughts on climate change?" };
    }
  }
};

// Utility functions
function writeJson(filePath, obj) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing JSON file:', error);
        return false;
    }
}

function readJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        return null;
    }
}

// Routes
// Enhanced chat router mounting with better error handling
(async () => {
  try {
    // Try to import and mount the enhanced chat router
    const module = await import('./backend/src/routes/chat.js');
    const chatRouter = module.default;
    
    if (chatRouter) {
      app.use("/chat", chatRouter);
      console.log('✅ Enhanced chat router successfully mounted at /chat');
    } else {
      throw new Error('Chat router module did not export default router');
    }
  } catch (error) {
    console.error('❌ Failed to load enhanced chat router:', error.message);
    console.log('🔄 Using fallback chat endpoints');
    
    // Fallback chat endpoints when enhanced router is unavailable
    app.post('/chat/start', async (req, res) => {
      try {
        const { userId } = req.body || {};
        const participantId = userId || uuidv4();
        const conversationId = uuidv4();

        const now = new Date().toISOString();
        const initial = {
          id: conversationId,
          participantId,
          startedAt: now,
          endedAt: null,
          durationSeconds: 0,
          messages: []
        };

        const filename = path.join(conversationsDir, `${conversationId}.json`);
        writeJson(filename, initial);

        activeConversations.set(conversationId, { startedAt: now });

        // Use enhanced opening line logic even in fallback
        const profile = await global.db.participants.getProfile(participantId);
        const { openingLineFrom } = await import('./backend/src/utils/openingLine.js');
        const opening = openingLineFrom(profile);
        
        initial.messages.push({ role: "assistant", content: opening });
        writeJson(filename, initial);

        res.json({ conversationId, messages: initial.messages });
      } catch (err) {
        console.error('fallback /chat/start error', err);
        res.status(500).json({ error: 'Failed to start chat' });
      }
    });

    // Reply endpoint with enhanced system prompt
    app.post('/chat/reply', async (req, res) => {
      try {
        const { conversationId, message } = req.body || {};
        if (!conversationId || !message || !message.trim()) {
          return res.status(400).json({ error: 'conversationId and message are required' });
        }

        const activeConv = activeConversations.get(conversationId);
        if (!activeConv) {
          return res.status(404).json({ error: 'Conversation not found or ended' });
        }

        const now = new Date();
        const startTime = new Date(activeConv.startedAt);
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        if (elapsedSeconds >= (CHAT_DURATION_MS / 1000)) {
          activeConversations.delete(conversationId);
          return res.status(410).json({ error: 'Conversation time limit exceeded' });
        }

        // Early-end phrase
        if (shouldEndNow(message)) {
          const filename = path.join(conversationsDir, `${conversationId}.json`);
          const conv = readJson(filename) || {};
          conv.messages = conv.messages || [];
          conv.messages.push({ role: "user", content: message });
          const finalReply = "Okay — ending the chat now. Thanks for participating!";
          conv.messages.push({ role: "assistant", content: finalReply });
          conv.endedAt = now.toISOString();
          conv.durationSeconds = Math.floor((now - startTime) / 1000);
          writeJson(filename, conv);
          activeConversations.delete(conversationId);
          return res.json({ reply: finalReply, sessionEnded: true });
        }

        // Normal AI reply with enhanced system prompt
        const filename = path.join(conversationsDir, `${conversationId}.json`);
        const conv = readJson(filename) || {};
        conv.messages = conv.messages || [];
        conv.messages.push({ role: "user", content: message });

        // Get participant profile and use enhanced system prompt
        const profile = await global.db.participants.getProfile(conv.participantId);
        const { renderSystemPrompt } = await import('./backend/src/utils/systemPrompt.js');
        const enhancedSystemPrompt = renderSystemPrompt(profile);

        const aiReply = await generateAIResponse(conv.messages, enhancedSystemPrompt);
        conv.messages.push({ role: "assistant", content: aiReply });
        writeJson(filename, conv);

        res.json({ reply: aiReply });
      } catch (err) {
        console.error('fallback /chat/reply error', err);
        res.status(500).json({ error: 'Failed to generate reply' });
      }
    });
  }
})();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/consent', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consent.html'));
});

app.get('/survey', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'survey.html'));
});

app.get('/chat/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/exit-survey', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'exit-survey.html'));
});

app.get('/disqualified', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'disqualified.html'));
});

app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    chatRouterMounted: Boolean(chatRouter),
    activeConversations: activeConversations.size
  });
});

// Debug endpoint to check data files
app.get('/debug/data', (req, res) => {
    try {
        const participants = fs.existsSync(participantsDir) ? fs.readdirSync(participantsDir) : [];
        const conversations = fs.existsSync(conversationsDir) ? fs.readdirSync(conversationsDir) : [];
        const exports = fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir) : [];
        
        res.json({
            dataFolderExists: fs.existsSync(dataDir),
            participantFiles: participants,
            conversationFiles: conversations,
            exportFiles: exports,
            totalFiles: participants.length + conversations.length + exports.length,
            directories: {
                dataDir,
                participantsDir,
                conversationsDir,
                exportsDir
            },
            activeConversations: Array.from(activeConversations.keys()),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Survey submission endpoint
app.post('/survey/submit', (req, res) => {
    try {
        const {
            prolific_id,
            age,
            gender,
            education,
            political_orientation,
            prior_belief,
            current_belief,
            confidence_level,
            views_changed,
            change_direction,
            consent
        } = req.body;
        
        console.log('Received survey submission:', req.body);
        console.log('DEBUG: Starting validation process...');
        
        // Validate required field: views_changed
        if (!views_changed || !['Yes', 'No'].includes(views_changed)) {
            console.log('DEBUG: views_changed validation FAILED - views_changed:', views_changed);
            return res.status(400).json({ error: 'Please indicate whether your views on climate change have changed' });
        }
        console.log('DEBUG: views_changed validation PASSED');
        
        // If views changed = Yes, validate change_direction
        if (views_changed === 'Yes') {
            if (!change_direction || !['From climate sceptic to climate believer', 'From climate believer to climate sceptic'].includes(change_direction)) {
                console.log('DEBUG: change_direction validation FAILED - change_direction:', change_direction);
                return res.status(400).json({ error: 'Please indicate which best describes your change in belief' });
            }
            console.log('DEBUG: change_direction validation PASSED');
        }
        
        // Validate consent
        if (!consent) {
            return res.status(400).json({ error: 'Consent is required' });
        }
        
        // Optional field validations (only validate if provided)
        if (age && (age < 16 || age > 120)) {
            console.log('DEBUG: Age validation FAILED - age:', age);
            return res.status(400).json({ error: 'Age must be between 16 and 120' });
        }
        
        if (gender && !['Woman', 'Man', 'Non-binary', 'Other', 'Prefer not to say'].includes(gender)) {
            return res.status(400).json({ error: 'Valid gender identity is required' });
        }
        
        if (education && !['Less than high school', 'High school', 'Vocational/TAFE', 'Bachelor', 'Honours', 'Masters', 'Doctorate', 'Prefer not to say'].includes(education)) {
            return res.status(400).json({ error: 'Valid education level is required' });
        }
        
        if (political_orientation && (political_orientation === 'prefer_not_to_say' || (political_orientation >= 1 && political_orientation <= 7))) {
            // Valid - either prefer_not_to_say or 1-7
        } else if (political_orientation && (political_orientation < 1 || political_orientation > 7)) {
            return res.status(400).json({ error: 'Political affiliation must be between 1 and 7 or prefer not to say' });
        }
        
        if (prior_belief && (prior_belief === 'prefer_not_to_say' || (prior_belief >= 1 && prior_belief <= 7))) {
            // Valid - either prefer_not_to_say or 1-7
        } else if (prior_belief && (prior_belief < 1 || prior_belief > 7)) {
            return res.status(400).json({ error: 'Prior climate belief must be between 1 and 7 or prefer not to say' });
        }
        
        if (current_belief && (current_belief === 'prefer_not_to_say' || (current_belief >= 1 && current_belief <= 7))) {
            // Valid - either prefer_not_to_say or 1-7
        } else if (current_belief && (current_belief < 1 || current_belief > 7)) {
            return res.status(400).json({ error: 'Current climate belief must be between 1 and 7 or prefer not to say' });
        }
        
        if (confidence_level && (confidence_level < 1 || confidence_level > 7)) {
            return res.status(400).json({ error: 'Confidence level must be between 1 and 7' });
        }
        
        // Generate participant ID
        const participantId = uuidv4();
        const now = new Date().toISOString();
        
        // Create participant data with new structure
        const participantData = {
            id: participantId,
            createdAt: now,
            updatedAt: now,
            
            // Factual demographics (optional)
            age: age ? parseInt(age) : null,
            gender: gender || null,
            education: education || null,
            
            // Attitudinal measures (1-7 scale, optional)
            politicalAffiliation: political_orientation ? (political_orientation === 'prefer_not_to_say' ? null : parseInt(political_orientation)) : null,
            priorClimateBelief: prior_belief ? (prior_belief === 'prefer_not_to_say' ? null : parseInt(prior_belief)) : null,
            currentClimateBelief: current_belief ? (current_belief === 'prefer_not_to_say' ? null : parseInt(current_belief)) : null,
            confidenceLevel: confidence_level ? parseInt(confidence_level) : null,
            
            // Required belief change questions
            viewsChanged: views_changed,
            changeDirection: views_changed === 'Yes' ? change_direction : null,
            
            // Consent
            consentAnonymised: Boolean(consent),
            
            // Legacy fields for backwards compatibility
            prolificId: prolific_id || null,
            consentGiven: Boolean(consent)
        };
        
        // Save participant data (always save regardless of eligibility)
        const filename = path.join(participantsDir, `${participantId}.json`);
        if (!writeJson(filename, participantData)) {
            throw new Error('Failed to save participant data');
        }
        
        console.log('Participant saved successfully:', participantId);
        
        res.json({
            participantId
        });
        
    } catch (error) {
        console.error('Error processing survey:', error);
        res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
});

// Start a new conversation
app.post('/api/conversations/start', (req, res) => {
    try {
        const { participantId } = req.body;
        
        if (!participantId) {
            return res.status(400).json({ error: 'participantId is required' });
        }
        
        // Check if participant exists
        const participantFile = path.join(participantsDir, `${participantId}.json`);
        const participant = readJson(participantFile);
        if (!participant) {
            return res.status(404).json({ error: 'Participant not found' });
        }
        
        // Generate conversation ID
        const conversationId = uuidv4();
        const now = new Date().toISOString();
        
        // System prompt for the conversation
        const systemPrompt = `You are an AI assistant facilitating a conversation about climate change. Your role is to engage thoughtfully and ask follow-up questions to help the participant explore their views. Do not try to persuade or change their mind - instead, focus on understanding their perspective and encouraging reflection. Keep responses conversational and under 150 words.`;
        
        // Create conversation data
        const conversationData = {
            id: conversationId,
            participantId: participantId,
            startedAt: now,
            endedAt: null,
            durationSeconds: null,
            systemPrompt: systemPrompt,
            messages: []
        };
        
        // Save conversation data
        const filename = path.join(conversationsDir, `${conversationId}.json`);
        if (!writeJson(filename, conversationData)) {
            throw new Error('Failed to create conversation');
        }
        
        // Track in memory
        activeConversations.set(conversationId, {
            participantId,
            startedAt: now,
            lastActivity: now
        });
        
        console.log('Conversation started:', conversationId, 'for participant:', participantId);
        
        res.json({ conversationId });
        
    } catch (error) {
        console.error('Error starting conversation:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Helper function to detect early-end phrase
function shouldEndNow(text) {
    if (!text) return false;
    // case-insensitive, allow surrounding punctuation/whitespace
    return /\bend the chat\b/i.test(text.trim());
}

// Send a message in a conversation
app.post('/api/conversations/:id/message', async (req, res) => {
    try {
        const conversationId = req.params.id;
        const { content } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        
        // Check if conversation is active
        const activeConv = activeConversations.get(conversationId);
        if (!activeConv) {
            return res.status(404).json({ error: 'Conversation not found or ended' });
        }
        
        // Check 5-minute time limit (300 seconds)
        const now = new Date();
        const startTime = new Date(activeConv.startedAt);
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        
        if (elapsedSeconds >= (CHAT_DURATION_MS / 1000)) {
            // End conversation due to time limit
            activeConversations.delete(conversationId);
            return res.status(410).json({ error: 'Conversation time limit exceeded' });
        }
        
        // Check for early-end phrase
        if (shouldEndNow(content)) {
            // Load conversation data
            const filename = path.join(conversationsDir, `${conversationId}.json`);
            const conversationData = readJson(filename);
            if (!conversationData) {
                return res.status(404).json({ error: 'Conversation data not found' });
            }
            
            // Add user message
            const userMessage = {
                role: 'user',
                content: content.trim(),
                timestamp: now.toISOString()
            };
            conversationData.messages.push(userMessage);
            
            // Add final assistant message
            const finalMessage = {
                role: 'assistant',
                content: 'Okay — ending the chat now. Thanks for participating!',
                timestamp: new Date().toISOString()
            };
            conversationData.messages.push(finalMessage);
            
            // End conversation
            const durationSeconds = Math.floor((now - startTime) / 1000);
            conversationData.endedAt = now.toISOString();
            conversationData.durationSeconds = durationSeconds;
            
            // Save conversation
            if (!writeJson(filename, conversationData)) {
                throw new Error('Failed to save conversation');
            }
            
            // Remove from active conversations
            activeConversations.delete(conversationId);
            
            console.log('Conversation ended by phrase:', conversationId, 'Duration:', durationSeconds, 'seconds');
            
            return res.json({
                reply: finalMessage.content,
                sessionEnded: true
            });
        }
        
        // Load conversation data
        const filename = path.join(conversationsDir, `${conversationId}.json`);
        const conversationData = readJson(filename);
        if (!conversationData) {
            return res.status(404).json({ error: 'Conversation data not found' });
        }
        
        // Add user message
        const userMessage = {
            role: 'user',
            content: content.trim(),
            timestamp: now.toISOString()
        };
        conversationData.messages.push(userMessage);
        
        // Call OpenAI API (mock implementation for now - replace with actual OpenAI call)
        const assistantReply = await generateAIResponse(conversationData.messages, conversationData.systemPrompt);
        
        // Add assistant message
        const assistantMessage = {
            role: 'assistant',
            content: assistantReply,
            timestamp: new Date().toISOString()
        };
        conversationData.messages.push(assistantMessage);
        
        // Update last activity
        activeConv.lastActivity = now.toISOString();
        
        // Save updated conversation
        if (!writeJson(filename, conversationData)) {
            throw new Error('Failed to save conversation');
        }
        
        res.json({ reply: assistantReply });
        
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// End a conversation
app.post('/api/conversations/:id/end', (req, res) => {
    try {
        const conversationId = req.params.id;
        
        // Check if conversation is active
        const activeConv = activeConversations.get(conversationId);
        if (!activeConv) {
            return res.status(404).json({ error: 'Conversation not found or already ended' });
        }
        
        // Load conversation data
        const filename = path.join(conversationsDir, `${conversationId}.json`);
        const conversationData = readJson(filename);
        if (!conversationData) {
            return res.status(404).json({ error: 'Conversation data not found' });
        }
        
        // Calculate duration
        const now = new Date();
        const startTime = new Date(conversationData.startedAt);
        const durationSeconds = Math.floor((now - startTime) / 1000);
        
        // Update conversation data
        conversationData.endedAt = now.toISOString();
        conversationData.durationSeconds = durationSeconds;
        
        // Save updated conversation
        if (!writeJson(filename, conversationData)) {
            throw new Error('Failed to save conversation end data');
        }
        
        // Remove from active conversations
        activeConversations.delete(conversationId);
        
        console.log('Conversation ended:', conversationId, 'Duration:', durationSeconds, 'seconds');
        
        res.json({ ok: true });
        
    } catch (error) {
        console.error('Error ending conversation:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get participant data endpoint
app.get('/api/participant/:id', (req, res) => {
    try {
        const participantId = req.params.id;
        
        // Read participant file
        const filename = path.join(participantsDir, `${participantId}.json`);
        const participantData = readJson(filename);
        
        if (!participantData) {
            return res.status(404).json({ error: 'Participant not found' });
        }
        
        res.json(participantData);
        
    } catch (error) {
        console.error('Error getting participant data:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// End survey submission endpoint
app.post('/api/end-survey', (req, res) => {
    try {
        const {
            participant_id,
            earlierConfidence,
            confidenceChanged,
            newConfidence,
            changeReason
        } = req.body;
        
        console.log('Received end survey submission:', req.body);
        
        // Validate required fields
        if (!participant_id) {
            return res.status(400).json({ error: 'Participant ID is required' });
        }
        
        // All confidence-related fields are now optional - no validation required
        // Optional validation for data integrity (only if provided)
        if (earlierConfidence && (earlierConfidence < 1 || earlierConfidence > 7)) {
            return res.status(400).json({ error: 'Earlier confidence must be between 1 and 7 if provided' });
        }
        
        if (confidenceChanged && !['no', 'yes'].includes(confidenceChanged)) {
            return res.status(400).json({ error: 'Confidence changed must be "no" or "yes" if provided' });
        }
        
        if (newConfidence && (newConfidence < 1 || newConfidence > 7)) {
            return res.status(400).json({ error: 'New confidence must be between 1 and 7 if provided' });
        }
        
        // Generate survey ID
        const surveyId = uuidv4();
        const now = new Date().toISOString();
        
        // Create end survey data with optional fields
        const endSurveyData = {
            id: surveyId,
            participantId: participant_id,
            createdAt: now,
            
            // Optional survey responses
            earlierConfidence: earlierConfidence ? parseInt(earlierConfidence) : null,
            confidenceChanged: confidenceChanged || null,
            newConfidence: (confidenceChanged === 'yes' && newConfidence) ? parseInt(newConfidence) : null,
            changeReason: (confidenceChanged === 'yes' && changeReason) ? changeReason.trim() : null
        };
        
        // Save end survey data
        const filename = path.join(dataDir, 'end-surveys', `${surveyId}.json`);
        
        // Create end-surveys directory if it doesn't exist
        const endSurveysDir = path.join(dataDir, 'end-surveys');
        if (!fs.existsSync(endSurveysDir)) {
            fs.mkdirSync(endSurveysDir, { recursive: true });
        }
        
        if (!writeJson(filename, endSurveyData)) {
            throw new Error('Failed to save end survey data');
        }
        
        console.log('End survey saved successfully:', surveyId);
        
        res.json({ ok: true, id: surveyId });
        
    } catch (error) {
        console.error('Error processing end survey:', error);
        res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
});

// Admin export endpoints
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!process.env.ADMIN_TOKEN) {
    console.warn('ADMIN_TOKEN not configured; blocking admin endpoints by default.');
    return res.status(403).json({ error: 'Admin token not configured' });
  }
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Export JSON data
app.get('/api/admin/export.json', requireAdmin, (req, res) => {
    try {
        const participants = [];
        const conversations = [];
        
        // Read all participant files
        if (fs.existsSync(participantsDir)) {
            const participantFiles = fs.readdirSync(participantsDir);
            for (const file of participantFiles) {
                if (file.endsWith('.json')) {
                    const participant = readJson(path.join(participantsDir, file));
                    if (participant) {
                        participants.push(participant);
                    }
                }
            }
        }
        
        // Read all conversation files
        if (fs.existsSync(conversationsDir)) {
            const conversationFiles = fs.readdirSync(conversationsDir);
            for (const file of conversationFiles) {
                if (file.endsWith('.json')) {
                    const conversation = readJson(path.join(conversationsDir, file));
                    if (conversation) {
                        conversations.push(conversation);
                    }
                }
            }
        }
        
        res.json({ participants, conversations });
        
    } catch (error) {
        console.error('Error exporting JSON data:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Export CSV data
app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
    try {
        // Create participants lookup
        const participantLookup = new Map();
        if (fs.existsSync(participantsDir)) {
            const participantFiles = fs.readdirSync(participantsDir);
            for (const file of participantFiles) {
                if (file.endsWith('.json')) {
                    const participant = readJson(path.join(participantsDir, file));
                    if (participant) {
                        participantLookup.set(participant.id, participant);
                    }
                }
            }
        }
        
        // CSV header
        const csvRows = [
            'participantId,conversationId,timestamp,role,content,age,gender,country,education,politicalOrientation,priorBelief,currentBelief'
        ];
        
        // Process conversations
        if (fs.existsSync(conversationsDir)) {
            const conversationFiles = fs.readdirSync(conversationsDir);
            for (const file of conversationFiles) {
                if (file.endsWith('.json')) {
                    const conversation = readJson(path.join(conversationsDir, file));
                    if (conversation && conversation.messages) {
                        const participant = participantLookup.get(conversation.participantId);
                        
                        for (const message of conversation.messages) {
                            const row = [
                                escapeCsv(conversation.participantId || ''),
                                escapeCsv(conversation.id || ''),
                                escapeCsv(message.timestamp || ''),
                                escapeCsv(message.role || ''),
                                escapeCsv(message.content || ''),
                                participant ? (participant.age || '') : '',
                                participant ? escapeCsv(participant.gender || '') : '',
                                participant ? escapeCsv(participant.country || '') : '',
                                participant ? escapeCsv(participant.education || '') : '',
                                participant ? escapeCsv(participant.politicalOrientation || '') : '',
                                participant ? escapeCsv(participant.priorBelief || '') : '',
                                participant ? escapeCsv(participant.currentBelief || '') : ''
                            ].join(',');
                            
                            csvRows.push(row);
                        }
                    }
                }
            }
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="conversation_export.csv"');
        res.send(csvRows.join('\n'));
        
    } catch (error) {
        console.error('Error exporting CSV data:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

function escapeCsv(str) {
    if (typeof str !== 'string') return str;
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Initialize OpenAI client (works with OpenRouter too)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_KEY?.startsWith('sk-or-')
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1'
});

// Real OpenAI API integration
async function generateAIResponse(messages, systemPrompt) {
    try {
        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key not configured. Using fallback response.');
            return "I'm here to help you explore your thoughts about climate change. Could you tell me more about your perspective?";
        }

        // Convert conversation messages to OpenAI format
        const openaiMessages = [
            {
                role: "system",
                content: systemPrompt
            }
        ];

        // Add conversation history
        for (const msg of messages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                openaiMessages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }

        console.log('Sending request to OpenAI with', openaiMessages.length, 'messages');

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: openaiMessages,
            max_tokens: 150,
            temperature: 0.7,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        });

        const response = completion.choices[0]?.message?.content?.trim();
        
        if (!response) {
            throw new Error('No response received from OpenAI');
        }

        console.log('OpenAI response received:', response.substring(0, 100) + '...');
        return response;

    } catch (error) {
        console.error('Error calling OpenAI API:', error.message);
        
        // Intelligent fallback response system
        console.log('Using fallback response due to OpenAI error');
        return generateIntelligentFallback(messages);
    }
}

// Intelligent fallback response generator
function generateIntelligentFallback(messages) {
    // Get the last user message
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    const userInput = lastUserMessage ? lastUserMessage.content.toLowerCase().trim() : '';
    
    // Check for gibberish/nonsensical input
    if (isGibberish(userInput)) {
        return "I'd like to understand your perspective better. Could you share your thoughts about climate change in a way that helps me follow along?";
    }
    
    // Check for conversation control words
    if (isConversationControl(userInput)) {
        return "No problem at all. Is there anything else about climate change you'd like to explore or discuss?";
    }
    
    // Check for very short responses
    if (userInput.length < 10) {
        return "I'd love to hear more about your thoughts. Could you elaborate on your perspective about climate change?";
    }
    
    // Check conversation length to vary responses
    const conversationLength = messages.filter(msg => msg.role === 'user').length;
    
    if (conversationLength === 1) {
        // First response - welcoming
        return "To start: could you describe what led you to change your mind about climate change?";
    } else if (conversationLength <= 3) {
        // Early conversation - exploring
        const earlyResponses = [
            "That's helpful context. What specific experiences or information were most influential in shaping that view?",
            "I can see this is something you've thought about. Could you tell me more about what factors were most important to you?",
            "Thank you for sharing that perspective. Are there particular aspects of this issue that you find most compelling?"
        ];
        return earlyResponses[Math.floor(Math.random() * earlyResponses.length)];
    } else {
        // Later conversation - deeper exploration
        const laterResponses = [
            "That's a thoughtful point. How do you think others who disagree might respond to that argument?",
            "I appreciate you explaining your viewpoint. What questions do you think are most important to consider about this issue?",
            "That's interesting. How has your thinking evolved as you've learned more about this topic?",
            "Thank you for that insight. What would you say to someone who holds the opposite view?"
        ];
        return laterResponses[Math.floor(Math.random() * laterResponses.length)];
    }
}

// Helper function to detect gibberish input
function isGibberish(input) {
    // Check for very short random strings
    if (input.length < 5 && !/\b(yes|no|maybe|ok|sure)\b/.test(input)) {
        return true;
    }
    
    // Check for repeated characters (like "aaaaa" or "ededed")
    if (/(.)\1{3,}/.test(input) || /(.{1,3})\1{2,}/.test(input)) {
        return true;
    }
    
    // Check for lack of vowels (excluding common abbreviations)
    const consonantOnly = /^[bcdfghjklmnpqrstvwxyz\s]+$/i.test(input) && input.length > 3;
    if (consonantOnly) {
        return true;
    }
    
    // Check for random keysmashing patterns
    const keysmash = /^[qwertyuiopasdfghjklzxcvbnm]{4,}$/i.test(input.replace(/\s/g, ''));
    if (keysmash && !/\b(real|word|here|there|when|what|where|why|how)\b/i.test(input)) {
        return true;
    }
    
    return false;
}

// Helper function to detect conversation control messages
function isConversationControl(input) {
    const controlWords = [
        'nevermind', 'never mind', 'forget it', 'skip', 'next', 'move on',
        'stop', 'quit', 'end', 'done', 'finished', 'exit', 'bye', 'goodbye'
    ];
    
    return controlWords.some(word => input.includes(word));
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server on http://localhost:${PORT}`);
});
