# Prisma Database Fix Implementation Plan

## Problem
- Custom database.js schema conflicts with Prisma schema
- Column name mismatches: `session_id` vs `id`, `participant_id` vs `participantId`
- Export endpoint failing due to schema initialization errors

## Current Prisma Schema Analysis
Based on `prisma/schema.prisma`:
```prisma
model Session {
  id            String    @id @default(cuid())
  participantId String?
  startedAt     DateTime?
  completedAt   DateTime?
  appVersion    String?
  raw           Json      // Stores complete session JSON
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  messages              Message[]
  individualDifferences IndividualDifferences?
  
  @@map("sessions")
}

model Message {
  id        String    @id @default(cuid())
  sessionId String
  turn      Int?
  role      String?   // "user", "assistant", "system"
  content   String?
  timestamp DateTime?
  tokensIn  Int?
  tokensOut Int?
  
  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@index([sessionId])
  @@map("messages")
}

model IndividualDifferences {
  id                String  @id @default(cuid())
  sessionId         String  @unique
  raw               Json    // Stores original nested participant object
  
  // Denormalized columns for common queries
  political7        Int?    // Political orientation (1-7 scale)
  confidence0_100   Int?    // Confidence level (0-100)
  age               Int?
  gender            String?
  education         String?
  viewsChanged      String? // "Yes", "No"
  
  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@map("individual_differences")
}
```

## Solution: Prisma-Based Database Layer

### 1. New database.js Structure
```javascript
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client
let prisma = null;
let isInitialized = false;

// File storage fallback directories
const dataDir = path.join(__dirname, 'data');
const participantsDir = path.join(dataDir, 'participants');
const conversationsDir = path.join(dataDir, 'conversations');

// Initialize Prisma client
function initializePrisma() {
    if (prisma) return prisma;
    
    if (!process.env.DATABASE_URL) {
        console.log('⚠️ DATABASE_URL not configured, using file fallback');
        return null;
    }
    
    try {
        prisma = new PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
        });
        console.log('✅ Prisma client initialized');
        return prisma;
    } catch (error) {
        console.error('❌ Failed to initialize Prisma client:', error.message);
        return null;
    }
}

// Test database availability
async function isDatabaseAvailable() {
    if (!prisma) {
        prisma = initializePrisma();
    }
    
    if (!prisma) return false;
    
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch (error) {
        console.log('❌ Database availability check failed:', error.message);
        return false;
    }
}
```

### 2. Data Mapping Strategy

#### Participants Data
- Store in `IndividualDifferences` table using `raw` JSON column
- Use `sessionId` to link to sessions
- Map participant data structure to Prisma format

#### Sessions Data  
- Store in `Session` table using `raw` JSON column
- Use Prisma's `id` field (not custom `session_id`)
- Map conversation data appropriately

#### Messages Data
- Store in `Message` table
- Link to sessions via `sessionId` foreign key
- Convert message format to match Prisma schema

### 3. Export Function Updates

#### getAllParticipants()
```javascript
async function getAllParticipants() {
    if (!await isDatabaseAvailable()) {
        // File fallback logic
        return getParticipantsFromFiles();
    }
    
    try {
        const individualDifferences = await prisma.individualDifferences.findMany({
            include: {
                session: {
                    include: {
                        messages: true
                    }
                }
            }
        });
        
        // Transform Prisma data back to expected format
        return individualDifferences.map(transformPrismaToParticipant);
    } catch (error) {
        console.error('❌ Prisma participants query failed:', error.message);
        return getParticipantsFromFiles(); // Fallback
    }
}
```

#### getAllSessions()
```javascript
async function getAllSessions() {
    if (!await isDatabaseAvailable()) {
        return getSessionsFromFiles();
    }
    
    try {
        const sessions = await prisma.session.findMany({
            include: {
                messages: true,
                individualDifferences: true
            },
            orderBy: { createdAt: 'desc' }
        });
        
        return sessions.map(transformPrismaToSession);
    } catch (error) {
        console.error('❌ Prisma sessions query failed:', error.message);
        return getSessionsFromFiles(); // Fallback
    }
}
```

#### getAllMessages()
```javascript
async function getAllMessages() {
    if (!await isDatabaseAvailable()) {
        return getMessagesFromFiles();
    }
    
    try {
        const messages = await prisma.message.findMany({
            orderBy: [
                { sessionId: 'asc' },
                { turn: 'asc' }
            ]
        });
        
        return messages.map(transformPrismaToMessage);
    } catch (error) {
        console.error('❌ Prisma messages query failed:', error.message);
        return getMessagesFromFiles(); // Fallback
    }
}
```

### 4. Data Transformation Functions

#### Transform Prisma to Expected Format
```javascript
function transformPrismaToParticipant(individualDiff) {
    const raw = individualDiff.raw;
    const session = individualDiff.session;
    
    return {
        participant_id: raw.participant_id || session.id,
        prolific_id: raw.prolific_id,
        demographics: raw.demographics,
        belief_change: raw.belief_change,
        views_matrix: raw.views_matrix,
        chatbot_interaction: {
            messages: session.messages.map(transformPrismaToMessage)
        },
        post_chat: raw.post_chat,
        timestamps: raw.timestamps,
        // Legacy compatibility
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
    };
}

function transformPrismaToSession(session) {
    return {
        id: session.id,
        participantId: session.participantId,
        startedAt: session.startedAt,
        endedAt: session.completedAt,
        durationSeconds: session.raw?.durationSeconds,
        systemPrompt: session.raw?.systemPrompt,
        messages: session.messages.map(transformPrismaToMessage),
        raw_data: session.raw
    };
}

function transformPrismaToMessage(message) {
    return {
        message_id: message.id,
        session_id: message.sessionId,
        participant_id: message.session?.participantId,
        turn_number: message.turn,
        role: message.role,
        content: message.content,
        message_timestamp: message.timestamp,
        character_count: message.content ? message.content.length : 0
    };
}
```

### 5. Remove Schema Conflicts

#### Initialize Database Function
```javascript
async function initializeDatabase() {
    if (isInitialized) {
        console.log('✅ Database already initialized (using Prisma)');
        return true;
    }
    
    if (!await isDatabaseAvailable()) {
        console.log('⚠️ Database unavailable, skipping initialization');
        return false;
    }
    
    try {
        // Test Prisma connection
        await prisma.$connect();
        console.log('✅ Prisma database connection established');
        
        isInitialized = true;
        return true;
        
    } catch (error) {
        console.error('❌ Prisma database initialization failed:', error.message);
        return false;
    }
}
```

### 6. File Fallback Compatibility

Keep existing file-based fallback functions unchanged:
- `getParticipantsFromFiles()`
- `getSessionsFromFiles()`
- `getMessagesFromFiles()`

### 7. Implementation Steps

1. **Replace database.js completely** with Prisma-based implementation
2. **Update export endpoint** to use new Prisma functions
3. **Test data transformation** between Prisma and expected formats
4. **Verify file fallback** still works when database unavailable
5. **Deploy and test** export endpoint functionality

## Expected Results

✅ Export endpoint `/export/database` will work without schema conflicts
✅ Data consistency between Prisma schema and export format
✅ Maintained compatibility with existing file storage fallback
✅ Cleaner, more maintainable database layer using Prisma ORM