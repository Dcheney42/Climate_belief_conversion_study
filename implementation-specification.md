# Implementation Specification: Raw PostgreSQL Database Layer

## Summary

Based on the analysis of your climate change conversation research platform, I've designed a comprehensive plan to add raw PostgreSQL (`pg`) database patterns alongside your existing Prisma system. This will provide enhanced performance, monitoring, and deployment optimization for Render.

## Key Architecture Decisions

### 1. Dual Database Strategy
- **Existing**: Prisma ORM continues to handle type safety and migrations
- **New**: Raw PostgreSQL layer for performance-critical operations
- **Fallback**: File storage remains as ultimate backup (maintaining current reliability)

### 2. Data Structure Mapping
Based on your current participant data structure, I've designed three main tables:

**Participants Table:**
- Stores your complex nested JSON (demographics, belief_change, views_matrix, chatbot_interaction)
- Uses JSONB columns for efficient querying of nested data
- Maintains all 12 CCS scale variables (raw, scored, was_moved)
- Preserves complete original JSON structure in `raw_data` field

**Sessions Table:**
- Maps to your current conversation tracking
- Links to participants via `participant_id`
- Stores duration, timestamps, system prompts

**Messages Table:**
- Individual chat messages with role/content/timestamps
- Links to both sessions and participants for flexible querying
- Includes character count and turn numbering

### 3. Required Dependencies
```bash
npm install pg
```

## Implementation Components

### Phase 1: Core Database Module (`database.js`)
- PostgreSQL connection pool with SSL configuration
- `isDatabaseAvailable()` helper function
- `initializeDatabase()` with CREATE TABLE IF NOT EXISTS
- Graceful degradation when database unavailable

### Phase 2: CRUD Functions
All functions use parameterized queries ($1, $2, etc.) for SQL injection prevention:

**Participants:**
- `saveParticipant(data)` - INSERT ... ON CONFLICT ... DO UPDATE pattern
- `getParticipant(participantId)`
- `getAllParticipants()` - for exports

**Sessions:**
- `saveSession(data)` - handles your existing conversation structure
- `getSession(sessionId)`
- `getAllSessions()`

**Messages:**
- `saveMessage(data)` - individual message insertion
- `saveMessages(sessionId, messages)` - batch operations
- `getAllMessages()`

### Phase 3: Monitoring & Export Endpoints

**New Endpoints:**
- `GET /export/database` - Complete JSON export with download headers
- Enhanced `GET /health` - Database connection status
- `GET /api/database-stats` - Table counts and connection pool stats

### Phase 4: Server Integration

**Enhanced Startup:**
1. Validate required environment variables
2. Initialize database (create tables if needed)
3. Test connection and log status
4. Start Express server

**Graceful Shutdown:**
- Handle SIGTERM signal
- Close database connection pool properly
- Maintain current Prisma disconnect logic

## Environment Variables

Your `.env.example` should include:
```env
# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/dbname
NODE_ENV=production
OPENROUTER_API_KEY=your-key-here
PORT=3000

# Database Pool Settings (optional)
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT_MS=30000
```

## Integration Benefits

### Performance Improvements
- Connection pooling optimized for Render's environment
- Direct SQL for bulk exports (bypasses ORM overhead)
- JSONB indexing for fast queries on your complex participant data

### Enhanced Monitoring
- Real-time database health checks
- Connection pool statistics
- Query performance logging with ✅/❌ status indicators

### Render Deployment Optimization
- SSL configuration for production PostgreSQL
- Health check endpoints for Render monitoring
- Zero-downtime deployment support with graceful startup/shutdown

## Implementation Safety

### Backwards Compatibility
- All operations are idempotent (can run multiple times safely)
- Schema changes are additive only (CREATE TABLE IF NOT EXISTS)
- File storage fallback preserved
- Existing Prisma operations unaffected

### Error Handling
- Always fallback to file storage if database unavailable
- Comprehensive logging with status indicators
- Parameterized queries prevent SQL injection
- Connection pool management in try/finally blocks

## Data Mapping Strategy

Your current participant structure maps to PostgreSQL as follows:

```javascript
// Your current nested structure
{
  participant_id: "p_abc123",
  demographics: { age: 25, gender: "Female", education: "Bachelor" },
  belief_change: { has_changed_mind: true, current_view: "...", ai_summary: "..." },
  views_matrix: { 
    climate_change_views: { ccs_01_raw: 45, ccs_01_scored: 4.5, ... },
    political_views: { economic_issues: 5, social_issues: 3 }
  },
  chatbot_interaction: { messages: [...] },
  post_chat: { final_belief_confidence: 85 }
}

// Maps to PostgreSQL JSONB columns
INSERT INTO participants (
  participant_id,
  demographics,      -- JSON of { age, gender, education }
  belief_change,     -- JSON of belief tracking data
  views_matrix,      -- JSON of CCS scale + political views
  chatbot_interaction, -- JSON of messages array
  post_chat,         -- JSON of post-conversation data
  raw_data           -- Complete original JSON structure
) VALUES ($1, $2, $3, $4, $5, $6, $7);
```

## Next Steps

If you approve this specification, I recommend switching to **Code mode** to implement:

1. **Core Infrastructure**: `database.js` module with connection pooling
2. **Schema Setup**: Database table creation and indexing
3. **CRUD Implementation**: All save/get/getAll functions
4. **API Endpoints**: Export and monitoring endpoints
5. **Server Integration**: Enhanced startup and shutdown sequences

This implementation will provide significant performance improvements for data exports and monitoring while maintaining full backwards compatibility with your existing system.

## Questions for Finalization

1. **Implementation Priority**: Would you like to implement all components at once, or prioritize specific features first?

2. **Testing Strategy**: Should I include database connection testing utilities?

3. **Migration Approach**: Would you prefer to implement this as a separate module that can be enabled/disabled via environment variables?

Are you ready to proceed with implementation in Code mode?