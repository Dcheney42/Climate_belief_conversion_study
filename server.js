const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
require('dotenv').config();

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

// In-memory storage for active conversations
const activeConversations = new Map();

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
            country, 
            education, 
            political_orientation, 
            prior_belief, 
            current_belief 
        } = req.body;
        
        console.log('Received survey submission:', req.body);
        
        // Generate participant ID
        const participantId = uuidv4();
        const now = new Date().toISOString();
        
        // Create participant data
        const participantData = {
            id: participantId,
            createdAt: now,
            consentGiven: true,
            prolificId: prolific_id || null,
            age: age ? parseInt(age) : null,
            gender: gender || null,
            country: country || null,
            education: education || null,
            politicalOrientation: political_orientation || null,
            priorBelief: prior_belief || null,
            currentBelief: current_belief || null
        };
        
        // Save participant data
        const filename = path.join(participantsDir, `${participantId}.json`);
        if (!writeJson(filename, participantData)) {
            throw new Error('Failed to save participant data');
        }
        
        console.log('Participant saved successfully:', participantId);
        
        res.json({ participantId });
        
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
        
        // Check 10-minute time limit (600 seconds)
        const now = new Date();
        const startTime = new Date(activeConv.startedAt);
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        
        if (elapsedSeconds >= 600) {
            // End conversation due to time limit
            activeConversations.delete(conversationId);
            return res.status(410).json({ error: 'Conversation time limit exceeded' });
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

// Admin export endpoints
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    const adminToken = process.env.ADMIN_TOKEN || 'changeme';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    if (token !== adminToken) {
        return res.status(403).json({ error: 'Invalid authentication token' });
    }
    
    next();
}

// Export JSON data
app.get('/api/admin/export.json', authenticateAdmin, (req, res) => {
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
app.get('/api/admin/export.csv', authenticateAdmin, (req, res) => {
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

// Mock AI response function (replace with actual OpenAI implementation)
async function generateAIResponse(messages, systemPrompt) {
    // This is a placeholder - you should implement actual OpenAI API call here
    const responses = [
        "That's an interesting perspective. What specific experiences or information helped shape that view?",
        "I can see you feel strongly about this. Could you tell me more about what led you to that conclusion?",
        "Thank you for sharing that. Are there particular aspects of this topic that you find most compelling?",
        "That's a thoughtful point. How do you think others who disagree might respond to that argument?",
        "I appreciate you explaining your viewpoint. What questions do you think are most important to consider about this issue?"
    ];
    
    // Simple mock response selection
    return responses[Math.floor(Math.random() * responses.length)];
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server on http://localhost:${PORT}`);
});
