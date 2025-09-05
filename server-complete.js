const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data storage directories
const dataDir = path.join(__dirname, 'data');
const participantsDir = path.join(dataDir, 'participants');
const conversationsDir = path.join(dataDir, 'conversations');

// Create data directories if they don't exist
[dataDir, participantsDir, conversationsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Simplified survey endpoint
app.post('/survey/submit', (req, res) => {
    try {
        console.log('=== SURVEY SUBMISSION ===');
        console.log('Body:', req.body);
        
        const { views_changed } = req.body;
        
        // Only validate the essential field
        if (!views_changed || !['Yes', 'No'].includes(views_changed)) {
            console.log('Validation failed');
            return res.status(400).json({ error: 'Please indicate whether your views changed' });
        }
        
        console.log('Validation passed');
        
        // Generate participant ID
        const participantId = uuidv4();
        console.log('Generated participant ID:', participantId);
        
        // Save minimal participant data
        const participantData = {
            id: participantId,
            createdAt: new Date().toISOString(),
            ...req.body
        };
        
        const filename = path.join(participantsDir, `${participantId}.json`);
        fs.writeFileSync(filename, JSON.stringify(participantData, null, 2));
        
        console.log('Participant saved successfully');
        console.log('Sending response...');
        
        res.json({ participantId });
        
        console.log('Response sent!');
        
    } catch (error) {
        console.error('Error in survey endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Simple AI summary endpoint (fallback only)
app.post('/api/generate-summary', (req, res) => {
    try {
        const { text } = req.body;
        console.log('Generating fallback summary for:', text?.substring(0, 50) + '...');
        
        // Simple fallback summary
        const summary = "The participant shared their perspective on climate change and the factors that influenced their viewpoint.";
        
        res.json({ summary });
    } catch (error) {
        console.error('Error generating summary:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});

// Chat endpoints
app.post('/chat/start', (req, res) => {
    try {
        console.log('Starting chat for participant:', req.body);
        
        const conversationId = 'conv-' + Date.now();
        const messages = [{
            role: 'assistant',
            content: 'Hello! I\'d like to learn more about your perspective on climate change. Could you tell me what led you to change your mind about this topic?'
        }];
        
        // Save conversation
        const conversationData = {
            id: conversationId,
            participantId: req.body.userId || 'unknown',
            startedAt: new Date().toISOString(),
            messages
        };
        
        const filename = path.join(conversationsDir, `${conversationId}.json`);
        fs.writeFileSync(filename, JSON.stringify(conversationData, null, 2));
        
        res.json({ conversationId, messages });
        
    } catch (error) {
        console.error('Error starting chat:', error);
        res.status(500).json({ error: 'Failed to start conversation' });
    }
});

app.post('/chat/reply', (req, res) => {
    try {
        const { conversationId, message } = req.body;
        console.log('Received message:', message);
        
        // Simple response logic
        const responses = [
            "That's interesting. Could you tell me more about what specifically influenced your thinking?",
            "I see. What role did personal experiences play in shaping your views?",
            "Thank you for sharing that. How do you think others might respond to your perspective?",
            "That's a thoughtful point. What questions do you think are most important about this issue?",
            "I appreciate you sharing that with me. What would you say to someone who disagrees with your view?"
        ];
        
        const reply = responses[Math.floor(Math.random() * responses.length)];
        
        // Update conversation file
        if (conversationId) {
            try {
                const filename = path.join(conversationsDir, `${conversationId}.json`);
                const conversationData = JSON.parse(fs.readFileSync(filename, 'utf8'));
                conversationData.messages.push(
                    { role: 'user', content: message, timestamp: new Date().toISOString() },
                    { role: 'assistant', content: reply, timestamp: new Date().toISOString() }
                );
                fs.writeFileSync(filename, JSON.stringify(conversationData, null, 2));
            } catch (fileError) {
                console.log('Could not update conversation file:', fileError.message);
            }
        }
        
        res.json({ reply });
        
    } catch (error) {
        console.error('Error in chat reply:', error);
        res.status(500).json({ error: 'Failed to generate reply' });
    }
});

// Static routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/belief-confidence', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'belief-confidence.html'));
});

app.get('/chat/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`Complete simplified server running on http://localhost:${PORT}`);
});