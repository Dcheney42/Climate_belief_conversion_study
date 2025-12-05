const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection pool
let pool = null;
let isInitialized = false;

// File storage fallback directories
const dataDir = path.join(__dirname, 'data');
const participantsDir = path.join(dataDir, 'participants');
const conversationsDir = path.join(dataDir, 'conversations');

// Initialize the database connection pool
function initializePool() {
    if (pool) {
        return pool;
    }

    if (!process.env.DATABASE_URL) {
        console.log('⚠️ DATABASE_URL not configured, database operations will use fallback');
        return null;
    }

    try {
        const config = {
            connectionString: process.env.DATABASE_URL,
            // SSL configuration for production (Render)
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            // Connection pool settings
            min: parseInt(process.env.DB_POOL_MIN) || 2,
            max: parseInt(process.env.DB_POOL_MAX) || 20,
            idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30000,
            connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS) || 10000,
        };

        pool = new Pool(config);

        // Log pool events
        pool.on('connect', () => {
            console.log('✅ Database pool: Client connected');
        });

        pool.on('error', (err) => {
            console.error('❌ Database pool error:', err.message);
        });

        console.log('✅ Database connection pool initialized');
        return pool;
    } catch (error) {
        console.error('❌ Failed to initialize database pool:', error.message);
        pool = null;
        return null;
    }
}

// Test database availability
async function isDatabaseAvailable() {
    if (!pool) {
        pool = initializePool();
    }
    
    if (!pool) {
        return false;
    }

    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        console.log('❌ Database availability check failed:', error.message);
        return false;
    }
}

// Initialize database schema
async function initializeDatabase() {
    if (isInitialized) {
        console.log('✅ Database schema already initialized');
        return true;
    }

    if (!await isDatabaseAvailable()) {
        console.log('⚠️ Database unavailable, skipping schema initialization');
        return false;
    }

    const client = await pool.connect();
    try {
        console.log('🗃️ Initializing database schema...');

        // Create participants table
        await client.query(`
            CREATE TABLE IF NOT EXISTS participants (
                id SERIAL PRIMARY KEY,
                participant_id VARCHAR(255) UNIQUE NOT NULL,
                prolific_id VARCHAR(255),
                demographics JSONB,
                belief_change JSONB,
                views_matrix JSONB,
                chatbot_interaction JSONB,
                post_chat JSONB,
                timestamps JSONB,
                raw_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Create sessions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                participant_id VARCHAR(255),
                started_at TIMESTAMP WITH TIME ZONE,
                ended_at TIMESTAMP WITH TIME ZONE,
                duration_seconds INTEGER,
                system_prompt TEXT,
                raw_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Create messages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                message_id VARCHAR(255) UNIQUE NOT NULL,
                session_id VARCHAR(255),
                participant_id VARCHAR(255),
                turn_number INTEGER,
                role VARCHAR(20),
                content TEXT,
                message_timestamp TIMESTAMP WITH TIME ZONE,
                character_count INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Create indexes for performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_participants_participant_id ON participants(participant_id);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_sessions_participant_id ON sessions(participant_id);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_participant_id ON messages(participant_id);
        `);

        isInitialized = true;
        console.log('✅ Database schema initialized successfully');
        return true;

    } catch (error) {
        console.error('❌ Database schema initialization failed:', error.message);
        return false;
    } finally {
        client.release();
    }
}

// Utility functions for file fallback
function writeJson(filePath, obj) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error writing JSON file:', error);
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
        console.error('❌ Error reading JSON file:', error);
        return null;
    }
}

function safeJsonStringify(obj) {
    if (typeof obj === 'string') {
        try {
            JSON.parse(obj);
            return obj; // Already a JSON string
        } catch (e) {
            return JSON.stringify(obj); // String that needs to be stringified
        }
    }
    return JSON.stringify(obj);
}

function safeJsonParse(str) {
    if (!str) return null;
    if (typeof str === 'object') return str; // Already parsed
    try {
        return JSON.parse(str);
    } catch (e) {
        return str;
    }
}

// CRUD Functions for Participants
async function saveParticipant(data) {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, using file fallback for participant save');
        const filename = path.join(participantsDir, `${data.participant_id}.json`);
        const success = writeJson(filename, data);
        console.log(`${success ? '✅' : '❌'} Participant ${data.participant_id} saved to file`);
        return success ? data : null;
    }

    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO participants (
                participant_id, prolific_id, demographics, belief_change, 
                views_matrix, chatbot_interaction, post_chat, timestamps, raw_data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (participant_id) 
            DO UPDATE SET 
                prolific_id = $2,
                demographics = $3,
                belief_change = $4,
                views_matrix = $5,
                chatbot_interaction = $6,
                post_chat = $7,
                timestamps = $8,
                raw_data = $9,
                updated_at = NOW()
            RETURNING *
        `;

        const values = [
            data.participant_id,
            data.prolific_id || null,
            safeJsonStringify(data.demographics || {}),
            safeJsonStringify(data.belief_change || {}),
            safeJsonStringify(data.views_matrix || {}),
            safeJsonStringify(data.chatbot_interaction || {}),
            safeJsonStringify(data.post_chat || {}),
            safeJsonStringify(data.timestamps || {}),
            safeJsonStringify(data)
        ];

        const result = await client.query(query, values);
        console.log('✅ Participant saved to database:', data.participant_id);
        
        // Also save to file as backup in development
        if (process.env.NODE_ENV !== 'production') {
            const filename = path.join(participantsDir, `${data.participant_id}.json`);
            writeJson(filename, data);
        }

        return result.rows[0];

    } catch (error) {
        console.error('❌ Database participant save failed:', error.message);
        // Fallback to file storage
        const filename = path.join(participantsDir, `${data.participant_id}.json`);
        const success = writeJson(filename, data);
        console.log(`${success ? '✅' : '❌'} Participant ${data.participant_id} saved to file fallback`);
        return success ? data : null;
    } finally {
        client.release();
    }
}

async function getParticipant(participantId) {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, using file fallback for participant get');
        const filename = path.join(participantsDir, `${participantId}.json`);
        const data = readJson(filename);
        console.log(`${data ? '✅' : '❌'} Participant ${participantId} retrieved from file`);
        return data;
    }

    const client = await pool.connect();
    try {
        const query = 'SELECT * FROM participants WHERE participant_id = $1';
        const result = await client.query(query, [participantId]);
        
        if (result.rows.length === 0) {
            console.log('❌ Participant not found in database:', participantId);
            return null;
        }

        const participant = result.rows[0];
        // Parse JSONB fields
        participant.demographics = safeJsonParse(participant.demographics);
        participant.belief_change = safeJsonParse(participant.belief_change);
        participant.views_matrix = safeJsonParse(participant.views_matrix);
        participant.chatbot_interaction = safeJsonParse(participant.chatbot_interaction);
        participant.post_chat = safeJsonParse(participant.post_chat);
        participant.timestamps = safeJsonParse(participant.timestamps);
        participant.raw_data = safeJsonParse(participant.raw_data);

        console.log('✅ Participant retrieved from database:', participantId);
        return participant;

    } catch (error) {
        console.error('❌ Database participant get failed:', error.message);
        // Fallback to file storage
        const filename = path.join(participantsDir, `${participantId}.json`);
        const data = readJson(filename);
        console.log(`${data ? '✅' : '❌'} Participant ${participantId} retrieved from file fallback`);
        return data;
    } finally {
        client.release();
    }
}

async function getAllParticipants() {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, using file fallback for participants getAll');
        try {
            if (!fs.existsSync(participantsDir)) {
                return [];
            }
            const files = fs.readdirSync(participantsDir)
                .filter(file => file.endsWith('.json'))
                .map(file => readJson(path.join(participantsDir, file)))
                .filter(data => data);
            console.log(`✅ Retrieved ${files.length} participants from files`);
            return files;
        } catch (error) {
            console.error('❌ File fallback failed for participants getAll:', error);
            return [];
        }
    }

    const client = await pool.connect();
    try {
        const query = 'SELECT * FROM participants ORDER BY created_at DESC';
        const result = await client.query(query);
        
        const participants = result.rows.map(participant => {
            // Parse JSONB fields
            participant.demographics = safeJsonParse(participant.demographics);
            participant.belief_change = safeJsonParse(participant.belief_change);
            participant.views_matrix = safeJsonParse(participant.views_matrix);
            participant.chatbot_interaction = safeJsonParse(participant.chatbot_interaction);
            participant.post_chat = safeJsonParse(participant.post_chat);
            participant.timestamps = safeJsonParse(participant.timestamps);
            participant.raw_data = safeJsonParse(participant.raw_data);
            return participant;
        });

        console.log(`✅ Retrieved ${participants.length} participants from database`);
        return participants;

    } catch (error) {
        console.error('❌ Database participants getAll failed:', error.message);
        // Fallback to file storage
        try {
            if (!fs.existsSync(participantsDir)) {
                return [];
            }
            const files = fs.readdirSync(participantsDir)
                .filter(file => file.endsWith('.json'))
                .map(file => readJson(path.join(participantsDir, file)))
                .filter(data => data);
            console.log(`✅ Retrieved ${files.length} participants from file fallback`);
            return files;
        } catch (fileError) {
            console.error('❌ File fallback failed for participants getAll:', fileError);
            return [];
        }
    } finally {
        client.release();
    }
}

// CRUD Functions for Sessions
async function saveSession(data) {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, using file fallback for session save');
        const filename = path.join(conversationsDir, `${data.id || data.session_id}.json`);
        const success = writeJson(filename, data);
        console.log(`${success ? '✅' : '❌'} Session ${data.id || data.session_id} saved to file`);
        return success ? data : null;
    }

    const client = await pool.connect();
    try {
        const sessionId = data.id || data.session_id;
        const query = `
            INSERT INTO sessions (
                session_id, participant_id, started_at, ended_at, 
                duration_seconds, system_prompt, raw_data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (session_id) 
            DO UPDATE SET 
                participant_id = $2,
                started_at = $3,
                ended_at = $4,
                duration_seconds = $5,
                system_prompt = $6,
                raw_data = $7,
                updated_at = NOW()
            RETURNING *
        `;

        const values = [
            sessionId,
            data.participantId || data.participant_id,
            data.startedAt ? new Date(data.startedAt) : null,
            data.endedAt ? new Date(data.endedAt) : null,
            data.durationSeconds || data.duration_seconds || null,
            data.systemPrompt || data.system_prompt || null,
            safeJsonStringify(data)
        ];

        const result = await client.query(query, values);
        
        // Save messages separately if they exist
        if (data.messages && data.messages.length > 0) {
            await saveMessages(sessionId, data.messages, data.participantId || data.participant_id);
        }

        console.log('✅ Session saved to database:', sessionId);
        
        // Also save to file as backup in development
        if (process.env.NODE_ENV !== 'production') {
            const filename = path.join(conversationsDir, `${sessionId}.json`);
            writeJson(filename, data);
        }

        return result.rows[0];

    } catch (error) {
        console.error('❌ Database session save failed:', error.message);
        // Fallback to file storage
        const filename = path.join(conversationsDir, `${data.id || data.session_id}.json`);
        const success = writeJson(filename, data);
        console.log(`${success ? '✅' : '❌'} Session ${data.id || data.session_id} saved to file fallback`);
        return success ? data : null;
    } finally {
        client.release();
    }
}

async function getSession(sessionId) {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, using file fallback for session get');
        const filename = path.join(conversationsDir, `${sessionId}.json`);
        const data = readJson(filename);
        console.log(`${data ? '✅' : '❌'} Session ${sessionId} retrieved from file`);
        return data;
    }

    const client = await pool.connect();
    try {
        const query = 'SELECT * FROM sessions WHERE session_id = $1';
        const result = await client.query(query, [sessionId]);
        
        if (result.rows.length === 0) {
            console.log('❌ Session not found in database:', sessionId);
            return null;
        }

        const session = result.rows[0];
        session.raw_data = safeJsonParse(session.raw_data);
        console.log('✅ Session retrieved from database:', sessionId);
        return session;

    } catch (error) {
        console.error('❌ Database session get failed:', error.message);
        // Fallback to file storage
        const filename = path.join(conversationsDir, `${sessionId}.json`);
        const data = readJson(filename);
        console.log(`${data ? '✅' : '❌'} Session ${sessionId} retrieved from file fallback`);
        return data;
    } finally {
        client.release();
    }
}

async function getAllSessions() {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, using file fallback for sessions getAll');
        try {
            if (!fs.existsSync(conversationsDir)) {
                return [];
            }
            const files = fs.readdirSync(conversationsDir)
                .filter(file => file.endsWith('.json'))
                .map(file => readJson(path.join(conversationsDir, file)))
                .filter(data => data);
            console.log(`✅ Retrieved ${files.length} sessions from files`);
            return files;
        } catch (error) {
            console.error('❌ File fallback failed for sessions getAll:', error);
            return [];
        }
    }

    const client = await pool.connect();
    try {
        const query = 'SELECT * FROM sessions ORDER BY created_at DESC';
        const result = await client.query(query);
        
        const sessions = result.rows.map(session => {
            session.raw_data = safeJsonParse(session.raw_data);
            return session;
        });

        console.log(`✅ Retrieved ${sessions.length} sessions from database`);
        return sessions;

    } catch (error) {
        console.error('❌ Database sessions getAll failed:', error.message);
        // Fallback to file storage
        try {
            if (!fs.existsSync(conversationsDir)) {
                return [];
            }
            const files = fs.readdirSync(conversationsDir)
                .filter(file => file.endsWith('.json'))
                .map(file => readJson(path.join(conversationsDir, file)))
                .filter(data => data);
            console.log(`✅ Retrieved ${files.length} sessions from file fallback`);
            return files;
        } catch (fileError) {
            console.error('❌ File fallback failed for sessions getAll:', fileError);
            return [];
        }
    } finally {
        client.release();
    }
}

// CRUD Functions for Messages
async function saveMessage(data) {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, skipping message save (messages stored with sessions in files)');
        return data;
    }

    const client = await pool.connect();
    try {
        const messageId = data.message_id || `${data.session_id}-msg-${data.turn_number || Date.now()}`;
        const query = `
            INSERT INTO messages (
                message_id, session_id, participant_id, turn_number, 
                role, content, message_timestamp, character_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (message_id) 
            DO UPDATE SET 
                role = $5,
                content = $6,
                message_timestamp = $7,
                character_count = $8
            RETURNING *
        `;

        const values = [
            messageId,
            data.session_id,
            data.participant_id,
            data.turn_number || null,
            data.role,
            data.content,
            data.timestamp ? new Date(data.timestamp) : new Date(),
            data.content ? data.content.length : 0
        ];

        const result = await client.query(query, values);
        console.log('✅ Message saved to database:', messageId);
        return result.rows[0];

    } catch (error) {
        console.error('❌ Database message save failed:', error.message);
        return data;
    } finally {
        client.release();
    }
}

async function saveMessages(sessionId, messages, participantId) {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, skipping messages save (messages stored with sessions in files)');
        return messages;
    }

    const client = await pool.connect();
    try {
        // Delete existing messages for this session first
        await client.query('DELETE FROM messages WHERE session_id = $1', [sessionId]);

        // Insert all messages
        const insertPromises = messages.map((msg, index) => {
            const messageId = `${sessionId}-msg-${index}`;
            const query = `
                INSERT INTO messages (
                    message_id, session_id, participant_id, turn_number, 
                    role, content, message_timestamp, character_count
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;

            const values = [
                messageId,
                sessionId,
                participantId,
                index,
                msg.role,
                msg.content,
                msg.timestamp ? new Date(msg.timestamp) : new Date(),
                msg.content ? msg.content.length : 0
            ];

            return client.query(query, values);
        });

        await Promise.all(insertPromises);
        console.log(`✅ ${messages.length} messages saved to database for session ${sessionId}`);
        return messages;

    } catch (error) {
        console.error('❌ Database messages save failed:', error.message);
        return messages;
    } finally {
        client.release();
    }
}

async function getAllMessages() {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, extracting messages from session files');
        // Extract messages from session files as fallback
        try {
            if (!fs.existsSync(conversationsDir)) {
                return [];
            }
            
            const messages = [];
            const files = fs.readdirSync(conversationsDir).filter(file => file.endsWith('.json'));
            
            for (const file of files) {
                const session = readJson(path.join(conversationsDir, file));
                if (session && session.messages) {
                    session.messages.forEach((msg, index) => {
                        messages.push({
                            message_id: `${session.id}-msg-${index}`,
                            session_id: session.id,
                            participant_id: session.participantId,
                            turn_number: index,
                            role: msg.role,
                            content: msg.content,
                            message_timestamp: msg.timestamp,
                            character_count: msg.content ? msg.content.length : 0
                        });
                    });
                }
            }
            
            console.log(`✅ Extracted ${messages.length} messages from session files`);
            return messages;
        } catch (error) {
            console.error('❌ File fallback failed for messages getAll:', error);
            return [];
        }
    }

    const client = await pool.connect();
    try {
        const query = 'SELECT * FROM messages ORDER BY session_id, turn_number';
        const result = await client.query(query);
        
        console.log(`✅ Retrieved ${result.rows.length} messages from database`);
        return result.rows;

    } catch (error) {
        console.error('❌ Database messages getAll failed:', error.message);
        return [];
    } finally {
        client.release();
    }
}

// Database statistics
async function getDatabaseStats() {
    if (!await isDatabaseAvailable()) {
        console.log('❌ Database unavailable, calculating stats from files');
        try {
            const participantCount = fs.existsSync(participantsDir) 
                ? fs.readdirSync(participantsDir).filter(f => f.endsWith('.json')).length 
                : 0;
            const sessionCount = fs.existsSync(conversationsDir) 
                ? fs.readdirSync(conversationsDir).filter(f => f.endsWith('.json')).length 
                : 0;

            return {
                source: 'files',
                tables: {
                    participants: { count: participantCount, size_mb: 0 },
                    sessions: { count: sessionCount, size_mb: 0 },
                    messages: { count: 0, size_mb: 0 }
                },
                connection_pool: {
                    total: 0,
                    idle: 0,
                    waiting: 0
                }
            };
        } catch (error) {
            console.error('❌ File stats calculation failed:', error);
            return null;
        }
    }

    const client = await pool.connect();
    try {
        // Get table counts
        const participantCount = await client.query('SELECT COUNT(*) FROM participants');
        const sessionCount = await client.query('SELECT COUNT(*) FROM sessions');
        const messageCount = await client.query('SELECT COUNT(*) FROM messages');

        // Get table sizes (PostgreSQL specific)
        const tableSizes = await client.query(`
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
            FROM pg_tables 
            WHERE tablename IN ('participants', 'sessions', 'messages')
            AND schemaname = 'public'
        `);

        const sizeMap = {};
        tableSizes.rows.forEach(row => {
            sizeMap[row.tablename] = {
                size_pretty: row.size,
                size_mb: Math.round(row.size_bytes / 1024 / 1024 * 100) / 100
            };
        });

        const stats = {
            source: 'database',
            tables: {
                participants: { 
                    count: parseInt(participantCount.rows[0].count),
                    size_mb: sizeMap.participants?.size_mb || 0
                },
                sessions: { 
                    count: parseInt(sessionCount.rows[0].count),
                    size_mb: sizeMap.sessions?.size_mb || 0
                },
                messages: { 
                    count: parseInt(messageCount.rows[0].count),
                    size_mb: sizeMap.messages?.size_mb || 0
                }
            },
            connection_pool: {
                total: pool.totalCount,
                idle: pool.idleCount,
                waiting: pool.waitingCount
            }
        };

        console.log('✅ Database statistics calculated');
        return stats;

    } catch (error) {
        console.error('❌ Database stats calculation failed:', error.message);
        return null;
    } finally {
        client.release();
    }
}

// Close database connections gracefully
async function closeDatabase() {
    if (pool) {
        try {
            await pool.end();
            console.log('✅ Database connection pool closed');
            pool = null;
            isInitialized = false;
        } catch (error) {
            console.error('❌ Error closing database pool:', error.message);
        }
    }
}

// Initialize the pool on module load
pool = initializePool();

// Export all functions
module.exports = {
    pool,
    isDatabaseAvailable,
    initializeDatabase,
    
    // Participant functions
    saveParticipant,
    getParticipant,
    getAllParticipants,
    
    // Session functions
    saveSession,
    getSession,
    getAllSessions,
    
    // Message functions
    saveMessage,
    saveMessages,
    getAllMessages,
    
    // Utility functions
    getDatabaseStats,
    closeDatabase
};