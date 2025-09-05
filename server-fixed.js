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

// Create data directories if they don't exist
[dataDir, participantsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Simple working survey endpoint
app.post('/survey/submit', (req, res) => {
    try {
        console.log('=== NEW SURVEY SUBMISSION ===');
        console.log('Body:', req.body);
        
        const { views_changed } = req.body;
        
        // Basic validation
        if (!views_changed || !['Yes', 'No'].includes(views_changed)) {
            console.log('Validation failed');
            return res.status(400).json({ error: 'Please indicate whether your views changed' });
        }
        
        console.log('Validation passed');
        
        // Generate participant ID
        const participantId = uuidv4();
        console.log('Generated participant ID:', participantId);
        
        // Save basic participant data
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

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Fixed server running on http://localhost:${PORT}`);
});