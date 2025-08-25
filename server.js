const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Data storage directories
const dataDir = path.join(__dirname, 'data');
const participantsDir = path.join(dataDir, 'participants');
const sessionsDir = path.join(dataDir, 'sessions');
const conversationsDir = path.join(dataDir, 'conversations');
const exportsDir = path.join(dataDir, 'exports');

// Create data directories if they don't exist
[dataDir, participantsDir, sessionsDir, conversationsDir, exportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// In-memory storage for active sessions
const activeParticipants = new Map();
const waitingQueues = {
    pro_climate: [],
    anti_climate: []
};
const activeSessions = new Map();

// Classification algorithm
function classifyParticipant(surveyResponses) {
    // Use the single Likert scale question from the new survey structure
    const climateScore = surveyResponses.climate_human_causation;
    
    // Classify based on the 7-point scale
    if (climateScore >= 5) {
        return { classification: 'pro_climate', score: climateScore };
    } else if (climateScore <= 3) {
        return { classification: 'anti_climate', score: climateScore };
    } else {
        return { classification: 'neutral', score: climateScore };
    }
}

// Save participant data
function saveParticipant(participantData) {
    const filename = path.join(participantsDir, `participant_${participantData.participant_id}.json`);
    fs.writeFileSync(filename, JSON.stringify(participantData, null, 2));
}

// Save session data
function saveSession(sessionData) {
    const filename = path.join(sessionsDir, `session_${sessionData.session_id}.json`);
    fs.writeFileSync(filename, JSON.stringify(sessionData, null, 2));
}

// Save conversation data
function saveConversation(conversationData) {
    const filename = path.join(conversationsDir, `conversation_${conversationData.session_id}.json`);
    fs.writeFileSync(filename, JSON.stringify(conversationData, null, 2));
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

app.get('/waiting', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waiting.html'));
});

app.get('/chat/:sessionId', (req, res) => {
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
    const sessions = fs.existsSync(sessionsDir) ? fs.readdirSync(sessionsDir) : [];
    const exports = fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir) : [];
    
    res.json({
      dataFolderExists: fs.existsSync(dataDir),
      participantFiles: participants,
      conversationFiles: conversations,
      sessionFiles: sessions,
      exportFiles: exports,
      totalFiles: participants.length + conversations.length + sessions.length + exports.length,
      directories: {
        dataDir,
        participantsDir,
        conversationsDir,
        sessionsDir,
        exportsDir
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// API endpoint to submit survey
app.post('/survey/submit', (req, res) => {
    try {
        const { prolific_id, survey_responses } = req.body;
        
        console.log('Received survey submission:');
        console.log('Prolific ID:', prolific_id);
        console.log('Survey responses:', JSON.stringify(survey_responses, null, 2));
        
        // Validate survey responses
        if (!survey_responses || typeof survey_responses !== 'object') {
            throw new Error('Invalid survey responses format');
        }
        
        if (!survey_responses.climate_human_causation) {
            throw new Error('Missing climate_human_causation response');
        }
        
        console.log('Validation passed, generating participant ID...');
        
        // Generate participant ID
        const participant_id = `p_${uuidv4().substring(0, 8)}`;
        console.log('Generated participant ID:', participant_id);
        
        // Classify participant
        console.log('Classifying participant...');
        const { classification, score } = classifyParticipant(survey_responses);
        console.log('Classification result:', { classification, score });
        
        // Create participant data
        console.log('Creating participant data...');
        const participantData = {
            participant_id,
            prolific_id,
            timestamp_joined: moment().toISOString(),
            classification,
            classification_score: score,
            survey_responses
        };
        
        // Save participant data
        console.log('Saving participant data...');
        saveParticipant(participantData);
        
        // Store in active participants
        console.log('Storing in active participants...');
        activeParticipants.set(participant_id, participantData);
        
        console.log('Sending response to client...');
        const responseData = {
            success: true,
            participant_id,
            classification,
            redirect: classification === 'neutral' ? '/exit-survey' : '/waiting'
        };
        console.log('Response data:', responseData);
        
        res.json(responseData);
        console.log('Response sent successfully');
        
    } catch (error) {
        console.error('Error processing survey:', error);
        console.error('Error stack:', error.stack);
        
        // Ensure we always send a response
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
});

// API endpoint to submit exit survey
app.post('/exit-survey', (req, res) => {
    try {
        const exitSurveyData = req.body;
        
        // Save exit survey data
        const filename = path.join(exportsDir, `exit_survey_${exitSurveyData.participant_id}.json`);
        fs.writeFileSync(filename, JSON.stringify(exitSurveyData, null, 2));
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error saving exit survey:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join waiting queue
    socket.on('join_queue', (data) => {
        const { participant_id } = data;
        const participant = activeParticipants.get(participant_id);
        
        if (!participant) {
            socket.emit('error', { message: 'Participant not found' });
            return;
        }
        
        // Add to appropriate queue
        if (participant.classification === 'pro_climate' || participant.classification === 'anti_climate') {
            waitingQueues[participant.classification].push({
                participant_id,
                socket_id: socket.id,
                timestamp: moment().toISOString()
            });
            
            socket.participant_id = participant_id;
            socket.classification = participant.classification;
            
            // Try to find a match
            tryToMatch();
            
            // Send queue status
            socket.emit('queue_status', {
                position: waitingQueues[participant.classification].length,
                waiting_for: participant.classification === 'pro_climate' ? 'anti_climate' : 'pro_climate'
            });
        }
    });
    
    // Join session room for chat
    socket.on('join_session', (data) => {
        const { session_id, participant_id } = data;
        const session = activeSessions.get(session_id);
        
        if (!session) {
            socket.emit('error', { message: 'Session not found or has ended' });
            return;
        }
        
        if (!session.participants.includes(participant_id)) {
            socket.emit('error', { message: 'You are not part of this session' });
            return;
        }
        
        // Check if session is still active (not ended due to timeout or disconnect)
        if (session.status === 'ended') {
            socket.emit('conversation_ended', { reason: 'session_ended' });
            return;
        }
        
        socket.join(session_id);
        socket.session_id = session_id;
        socket.participant_id = participant_id;
        
        // Mark participant as connected to session
        if (!session.connected_participants) {
            session.connected_participants = [];
        }
        if (!session.connected_participants.includes(participant_id)) {
            session.connected_participants.push(participant_id);
        }
        
        console.log(`Participant ${participant_id} joined session ${session_id}`);
        
        // If both participants are now connected, ensure session is active and send introductions
        if (session.connected_participants.length === 2) {
            session.status = 'active';
            console.log(`Session ${session_id} is now fully active with both participants`);
            
            // Send participant introductions and names to both participants
            const introductions = session.participants.map(pid => {
                const participant = activeParticipants.get(pid);
                if (participant) {
                    return {
                        participant_id: pid,
                        participant_name: `Participant ${participant.classification === 'pro_climate' ? 'A' : 'B'}`,
                        classification: participant.classification,
                        personal_views: participant.survey_responses.overall_perspective.substring(0, 200) + '...',
                        influencing_factors: participant.survey_responses.opinion_influences.substring(0, 150) + '...'
                    };
                }
                return null;
            }).filter(intro => intro !== null);
            
            // Create participant name mapping for messages
            const participantNames = {};
            introductions.forEach(intro => {
                participantNames[intro.participant_id] = intro.participant_name;
            });
            session.participant_names = participantNames;
            
            io.to(session_id).emit('session_joined', {
                participant_introductions: introductions,
                participant_names: participantNames
            });
        }
    });

    // Handle chat messages
    socket.on('send_message', (data) => {
        const { session_id, message } = data;
        const session = activeSessions.get(session_id);
        
        if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
        }
        
        // Check if conversation is still active
        const now = moment();
        const sessionStart = moment(session.timestamp_start);
        const elapsed = now.diff(sessionStart, 'seconds');
        
        if (elapsed >= 300) { // 5 minutes
            socket.emit('conversation_ended', { reason: 'time_limit' });
            return;
        }
        
        // Create message object
        const messageObj = {
            timestamp: now.toISOString(),
            sender: socket.participant_id,
            message: message.substring(0, 500), // Limit to 500 characters
            character_count: message.length
        };
        
        // Add to session conversation
        session.conversation.push(messageObj);
        
        // Broadcast to both participants
        io.to(session_id).emit('receive_message', messageObj);
        
        // Save conversation data
        saveConversation({
            session_id,
            conversation: session.conversation,
            conversation_metadata: {
                total_messages: session.conversation.length,
                last_updated: now.toISOString()
            }
        });
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
        const { session_id } = data;
        socket.to(session_id).emit('typing_start');
    });

    socket.on('typing_stop', (data) => {
        const { session_id } = data;
        socket.to(session_id).emit('typing_stop');
    });

    // Handle leaving session
    socket.on('leave_session', (data) => {
        const { session_id } = data;
        socket.to(session_id).emit('participant_disconnected');
        socket.leave(session_id);
    });

    // Handle early chat exit
    socket.on('leave_chat_early', (data) => {
        const { session_id } = data;
        const session = activeSessions.get(session_id);
        
        if (session && session.status === 'active') {
            // Notify other participant
            socket.to(session_id).emit('participant_left_early');
            
            // End the session
            endSession(session_id, 'participant_left_early');
        }
        
        socket.leave(session_id);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove from waiting queues
        if (socket.classification) {
            waitingQueues[socket.classification] = waitingQueues[socket.classification].filter(
                item => item.socket_id !== socket.id
            );
        }
        
        // Handle session disconnection - but give some time for reconnection
        if (socket.session_id && socket.participant_id) {
            const session = activeSessions.get(socket.session_id);
            if (session && session.status !== 'ended') {
                // Remove from connected participants
                if (session.connected_participants) {
                    session.connected_participants = session.connected_participants.filter(
                        pid => pid !== socket.participant_id
                    );
                }
                
                // Only notify and end session if this was a real disconnect (not page navigation)
                // Give 10 seconds for reconnection before notifying other participant
                setTimeout(() => {
                    const currentSession = activeSessions.get(socket.session_id);
                    if (currentSession && currentSession.status !== 'ended') {
                        // Check if participant reconnected
                        if (!currentSession.connected_participants ||
                            !currentSession.connected_participants.includes(socket.participant_id)) {
                            
                            // Notify other participant about disconnection
                            socket.to(socket.session_id).emit('participant_disconnected');
                            
                            // Give additional 20 seconds for reconnection before ending session
                            setTimeout(() => {
                                const finalSession = activeSessions.get(socket.session_id);
                                if (finalSession && finalSession.status !== 'ended') {
                                    if (!finalSession.connected_participants ||
                                        !finalSession.connected_participants.includes(socket.participant_id)) {
                                        endSession(socket.session_id, 'participant_disconnect');
                                    }
                                }
                            }, 20000);
                        }
                    }
                }, 10000);
            }
        }
    });
    
    function tryToMatch() {
        const proQueue = waitingQueues.pro_climate;
        const antiQueue = waitingQueues.anti_climate;
        
        if (proQueue.length > 0 && antiQueue.length > 0) {
            // Get first participant from each queue
            const proParticipant = proQueue.shift();
            const antiParticipant = antiQueue.shift();
            
            // Create session
            const session_id = `sess_${uuidv4().substring(0, 8)}`;
            const now = moment();
            
            const sessionData = {
                session_id,
                timestamp_start: now.toISOString(),
                participants: [proParticipant.participant_id, antiParticipant.participant_id],
                pairing_time_seconds: now.diff(moment(proParticipant.timestamp), 'seconds'),
                conversation: [],
                status: 'created',
                connected_participants: []
            };
            
            // Store session
            activeSessions.set(session_id, sessionData);
            saveSession(sessionData);
            
            // Get socket connections
            const proSocket = io.sockets.sockets.get(proParticipant.socket_id);
            const antiSocket = io.sockets.sockets.get(antiParticipant.socket_id);
            
            if (proSocket && antiSocket) {
                // Join both to session room
                proSocket.join(session_id);
                antiSocket.join(session_id);
                
                // Set session IDs
                proSocket.session_id = session_id;
                antiSocket.session_id = session_id;
                
                // Notify both participants
                proSocket.emit('match_found', { session_id });
                antiSocket.emit('match_found', { session_id });
                
                // Start 10-minute timer
                setTimeout(() => {
                    endSession(session_id, 'time_limit');
                }, 300000); // 5 minutes
                
                console.log(`Session ${session_id} started with participants ${proParticipant.participant_id} and ${antiParticipant.participant_id}`);
            }
        }
    }
    
    function endSession(session_id, reason) {
        const session = activeSessions.get(session_id);
        if (!session) return;
        
        const now = moment();
        const sessionStart = moment(session.timestamp_start);
        
        // Mark session as ended
        session.status = 'ended';
        
        // Update session data
        session.timestamp_end = now.toISOString();
        session.conversation_duration_seconds = now.diff(sessionStart, 'seconds');
        session.completion_status = reason === 'time_limit' ? 'completed' : 'incomplete';
        session.message_count = session.conversation.length;
        
        // Save final session data
        saveSession(session);
        
        // Save final conversation data
        if (session.conversation.length > 0) {
            const conversationData = {
                session_id,
                conversation: session.conversation,
                conversation_metadata: {
                    total_messages: session.conversation.length,
                    messages_per_participant: {},
                    conversation_duration_seconds: session.conversation_duration_seconds,
                    completion_reason: reason
                }
            };
            
            // Calculate messages per participant
            session.participants.forEach(pid => {
                conversationData.conversation_metadata.messages_per_participant[pid] =
                    session.conversation.filter(msg => msg.sender === pid).length;
            });
            
            saveConversation(conversationData);
        }
        
        // Notify participants
        io.to(session_id).emit('conversation_ended', { reason });
        
        // Remove from active sessions after a delay to allow participants to see the end message
        setTimeout(() => {
            activeSessions.delete(session_id);
        }, 5000);
        
        console.log(`Session ${session_id} ended: ${reason}`);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Climate Conversation Platform running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
});