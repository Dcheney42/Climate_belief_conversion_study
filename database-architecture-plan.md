# Node.js PostgreSQL Database Architecture Plan

## Overview

This document outlines the implementation plan for adding raw PostgreSQL (`pg`) database patterns alongside the existing Prisma system for enhanced performance, monitoring, and Render deployment optimization.

## Current Architecture Analysis

### Existing Components
- **Framework**: Express.js with Node.js
- **ORM**: Prisma with PostgreSQL
- **Data Storage**: Dual-write system (JSON files + database)
- **Deployment**: Render with `render.yaml` configuration
- **Environment**: Already configured for production SSL and connection handling

### Current Data Structure
1. **Participants** - Complex nested JSON with demographics, belief tracking, CCS scale responses
2. **Sessions** - Conversation tracking with start/end times and duration
3. **Messages** - Individual chat messages with role, content, timestamps

## Implementation Plan

### Step 1: Environment Variables Update

Update `.env.example` to include new database configuration:

```env
# Existing variables
OPENAI_API_KEY=your-openai-key-here
ADMIN_TOKEN=change-me
PORT=3000
CHAT_DURATION_MS=300000

# New database variables for raw PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
NODE_ENV=production
OPENROUTER_API_KEY=your-openrouter-key-here

# Database connection settings
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=10000
```

### Step 2: Raw PostgreSQL Database Module (`database.js`)

Create a comprehensive database module with:

#### Connection Configuration
- PostgreSQL connection pool using `pg`
- SSL configuration: `ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false`
- Graceful degradation when database is unavailable
- Connection testing and status reporting

#### Schema Design
```sql
-- Participants table with JSONB for complex data
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

-- Sessions table for conversation tracking
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

-- Messages table for individual chat messages
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_participants_participant_id ON participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_participant_id ON sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_participant_id ON messages(participant_id);
```

### Step 3: CRUD Functions Implementation

#### Required Functions

**Database Management:**
- `isDatabaseAvailable()` - Test connection and return status
- `initializeDatabase()` - Create tables and indexes (idempotent)
- `closeDatabase()` - Graceful connection pool shutdown

**Participants:**
- `saveParticipant(data)` - INSERT ... ON CONFLICT ... DO UPDATE pattern
- `getParticipant(participantId)` - Retrieve single participant
- `getAllParticipants()` - Retrieve all for export

**Sessions:**
- `saveSession(data)` - Upsert session with JSONB handling
- `getSession(sessionId)` - Retrieve single session
- `getAllSessions()` - Retrieve all for export

**Messages:**
- `saveMessage(data)` - Save individual message
- `saveMessages(sessionId, messages)` - Batch save messages
- `getAllMessages()` - Retrieve all for export

**Statistics:**
- `getDatabaseStats()` - Return table counts and connection info

### Step 4: Key Implementation Patterns

#### Error Handling Pattern
```javascript
async function saveParticipant(data) {
    if (!isDatabaseAvailable()) {
        console.log('❌ Database unavailable, using fallback');
        return handleFallback(data);
    }
    
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO participants (participant_id, demographics, belief_change, views_matrix, raw_data)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (participant_id) 
            DO UPDATE SET 
                demographics = $2,
                belief_change = $3,
                views_matrix = $4,
                raw_data = $5,
                updated_at = NOW()
            RETURNING *
        `;
        
        const values = [
            data.participant_id,
            JSON.stringify(data.demographics || {}),
            JSON.stringify(data.belief_change || {}),
            JSON.stringify(data.views_matrix || {}),
            JSON.stringify(data)
        ];
        
        const result = await client.query(query, values);
        console.log('✅ Participant saved:', data.participant_id);
        return result.rows[0];
        
    } catch (error) {
        console.log('❌ Database save failed:', error.message);
        return handleFallback(data);
    } finally {
        client.release();
    }
}
```

#### JSONB Field Handling
- Always `JSON.stringify()` before insertion
- Parse JSONB fields after retrieval with safety checks
- Handle cases where data might already be parsed objects

### Step 5: New API Endpoints

#### Database Export Endpoint
```javascript
// GET /export/database
// Returns complete dataset as downloadable JSON
{
    exported_at: "2025-12-05T02:59:00.000Z",
    totals: {
        participants: 150,
        sessions: 142,
        messages: 1247
    },
    data: {
        participants: [...],
        sessions: [...],
        messages: [...]
    }
}
```

#### Enhanced Health Endpoints
```javascript
// GET /health - Enhanced with database status
{
    ok: true,
    timestamp: "2025-12-05T02:59:00.000Z",
    database: {
        available: true,
        connection_time_ms: 45
    },
    environment: "production"
}

// GET /api/database-stats - Detailed statistics
{
    tables: {
        participants: { count: 150, size_mb: 12.3 },
        sessions: { count: 142, size_mb: 8.7 },
        messages: { count: 1247, size_mb: 45.2 }
    },
    connection_pool: {
        total: 10,
        idle: 7,
        waiting: 0
    }
}
```

### Step 6: Server Integration

#### Startup Sequence Enhancement
```javascript
async function startServer() {
    // 1. Validate required environment variables
    validateEnvironment();
    
    // 2. Initialize database connection
    await database.initializeDatabase();
    
    // 3. Log database connection status
    const dbAvailable = await database.isDatabaseAvailable();
    console.log(`Database: ${dbAvailable ? '✅ Connected' : '❌ Unavailable'}`);
    
    // 4. Start Express server
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
```

#### Graceful Shutdown
```javascript
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully');
    await database.closeDatabase();
    process.exit(0);
});
```

### Step 7: Dual Database Strategy

#### Integration with Existing Prisma System
- Raw PostgreSQL functions run alongside Prisma ORM
- Both systems use the same `DATABASE_URL`
- Raw functions provide better performance for bulk operations
- Prisma continues to handle migrations and type safety
- File storage remains as ultimate fallback

#### Migration Strategy
1. Deploy new `database.js` module without disrupting existing system
2. Test raw PostgreSQL functions alongside current Prisma operations
3. Add new endpoints for enhanced monitoring and exports
4. Gradually optimize performance-critical operations to use raw SQL

## Dependencies Required

Add to `package.json`:
```json
{
  "dependencies": {
    "pg": "^8.11.3"
  }
}
```

## Schema Migration Safety

All database operations are designed to be:
- **Idempotent**: Can run multiple times safely
- **Non-destructive**: Only add tables/columns, never drop
- **Backwards compatible**: Works alongside existing Prisma schema

## Performance Benefits

1. **Connection Pooling**: Optimized for Render's environment
2. **Batch Operations**: Efficient bulk data processing
3. **Direct SQL**: Bypasses ORM overhead for exports
4. **JSONB Indexing**: Fast queries on nested data structures
5. **Streaming Exports**: Handle large datasets efficiently

## Monitoring and Observability

- Database connection health monitoring
- Query performance logging
- Error rate tracking with fallback activation
- Resource usage statistics (connection pool, query timing)
- Export operation monitoring

## Deployment Considerations

### Render-Specific Configuration
- SSL configuration for production PostgreSQL
- Environment variable validation
- Health check endpoints for Render monitoring
- Graceful startup/shutdown for zero-downtime deployments

### Error Handling Strategy
- Always provide fallback to file storage
- Comprehensive logging with status indicators (✅/❌)
- User-friendly error messages
- Automatic retry mechanisms for transient failures

## Implementation Priority

1. **High Priority**: Database module, CRUD functions, health endpoints
2. **Medium Priority**: Export endpoints, statistics functions
3. **Low Priority**: Performance optimization, advanced monitoring

This architecture provides the foundation for a robust, scalable, and production-ready database layer that enhances your existing Render deployment while maintaining backwards compatibility.