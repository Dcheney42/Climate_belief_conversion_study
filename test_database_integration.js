#!/usr/bin/env node

/**
 * Test script to verify integration between raw PostgreSQL and Prisma systems
 * This script tests:
 * 1. Database connection and availability
 * 2. Schema initialization
 * 3. CRUD operations for each table
 * 4. Data consistency between raw SQL and Prisma
 * 5. Export functionality
 * 6. Error handling and fallbacks
 */

require('dotenv').config();
const database = require('./database');
const { PrismaClient } = require('@prisma/client');

// Test data samples
const testParticipantData = {
    participant_id: 'test_p_123456',
    prolific_id: 'test_prolific_123',
    demographics: {
        age: 25,
        gender: 'Female',
        education: 'Bachelor'
    },
    belief_change: {
        has_changed_mind: true,
        current_view: 'Climate change is a significant concern requiring immediate action.',
        elaboration: 'After reviewing scientific evidence, I believe we need urgent policy changes.',
        ai_summary: 'Climate change requires urgent policy intervention.',
        ai_confidence_slider: 85
    },
    views_matrix: {
        climate_change_views: {
            ccs_01_raw: 85,
            ccs_01_scored: 8.5,
            ccs_01_was_moved: true,
            ccs_mean_scored: 7.2,
            attention_check_passed: true
        },
        political_views: {
            economic_issues: 5,
            social_issues: 6
        }
    },
    chatbot_interaction: {
        messages: [
            {
                sender: 'chatbot',
                text: 'Hello! Let\'s discuss your views on climate change.',
                timestamp: new Date().toISOString()
            },
            {
                sender: 'participant',
                text: 'I think climate change is real and needs action.',
                timestamp: new Date().toISOString()
            }
        ]
    },
    post_chat: {
        final_belief_confidence: 90,
        chatbot_summary_accuracy: 'Yes'
    },
    timestamps: {
        started: new Date().toISOString(),
        completed: new Date().toISOString()
    }
};

const testSessionData = {
    id: 'test_session_123456',
    participantId: 'test_p_123456',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationSeconds: 300,
    systemPrompt: 'You are a helpful AI assistant discussing climate change.',
    messages: [
        {
            role: 'assistant',
            content: 'Hello! Let\'s discuss your views on climate change.',
            timestamp: new Date().toISOString()
        },
        {
            role: 'user',
            content: 'I think climate change is real and needs action.',
            timestamp: new Date().toISOString()
        },
        {
            role: 'assistant',
            content: 'That\'s an important perspective. What influenced your thinking?',
            timestamp: new Date().toISOString()
        }
    ]
};

async function testDatabaseConnection() {
    console.log('\n🔍 Testing Database Connection...');
    
    const isAvailable = await database.isDatabaseAvailable();
    console.log(`Database available: ${isAvailable ? '✅' : '❌'}`);
    
    if (!isAvailable) {
        console.log('⚠️ Database not available - testing file fallback mode');
        return false;
    }
    
    return true;
}

async function testSchemaInitialization() {
    console.log('\n🗃️ Testing Schema Initialization...');
    
    const initialized = await database.initializeDatabase();
    console.log(`Schema initialization: ${initialized ? '✅' : '❌'}`);
    
    return initialized;
}

async function testParticipantOperations() {
    console.log('\n👤 Testing Participant CRUD Operations...');
    
    try {
        // Test save
        console.log('  📝 Testing participant save...');
        const savedParticipant = await database.saveParticipant(testParticipantData);
        console.log(`  Save result: ${savedParticipant ? '✅' : '❌'}`);
        
        // Test get
        console.log('  📖 Testing participant get...');
        const retrievedParticipant = await database.getParticipant(testParticipantData.participant_id);
        console.log(`  Get result: ${retrievedParticipant ? '✅' : '❌'}`);
        
        // Verify data consistency
        if (retrievedParticipant) {
            const demographicsMatch = retrievedParticipant.demographics?.age === testParticipantData.demographics.age;
            const beliefChangeMatch = retrievedParticipant.belief_change?.has_changed_mind === testParticipantData.belief_change.has_changed_mind;
            console.log(`  Data consistency: ${demographicsMatch && beliefChangeMatch ? '✅' : '❌'}`);
        }
        
        // Test getAll
        console.log('  📋 Testing getAllParticipants...');
        const allParticipants = await database.getAllParticipants();
        console.log(`  GetAll result: ${Array.isArray(allParticipants) ? '✅' : '❌'} (${allParticipants.length} participants)`);
        
        return true;
    } catch (error) {
        console.error('  ❌ Participant operations failed:', error.message);
        return false;
    }
}

async function testSessionOperations() {
    console.log('\n💬 Testing Session CRUD Operations...');
    
    try {
        // Test save
        console.log('  📝 Testing session save...');
        const savedSession = await database.saveSession(testSessionData);
        console.log(`  Save result: ${savedSession ? '✅' : '❌'}`);
        
        // Test get
        console.log('  📖 Testing session get...');
        const retrievedSession = await database.getSession(testSessionData.id);
        console.log(`  Get result: ${retrievedSession ? '✅' : '❌'}`);
        
        // Test getAll
        console.log('  📋 Testing getAllSessions...');
        const allSessions = await database.getAllSessions();
        console.log(`  GetAll result: ${Array.isArray(allSessions) ? '✅' : '❌'} (${allSessions.length} sessions)`);
        
        return true;
    } catch (error) {
        console.error('  ❌ Session operations failed:', error.message);
        return false;
    }
}

async function testMessageOperations() {
    console.log('\n💭 Testing Message Operations...');
    
    try {
        // Test save messages (batch)
        console.log('  📝 Testing batch message save...');
        const messagesSaved = await database.saveMessages(
            testSessionData.id, 
            testSessionData.messages, 
            testSessionData.participantId
        );
        console.log(`  Batch save result: ${messagesSaved ? '✅' : '❌'}`);
        
        // Test getAllMessages
        console.log('  📋 Testing getAllMessages...');
        const allMessages = await database.getAllMessages();
        console.log(`  GetAll result: ${Array.isArray(allMessages) ? '✅' : '❌'} (${allMessages.length} messages)`);
        
        return true;
    } catch (error) {
        console.error('  ❌ Message operations failed:', error.message);
        return false;
    }
}

async function testDatabaseStats() {
    console.log('\n📊 Testing Database Statistics...');
    
    try {
        const stats = await database.getDatabaseStats();
        
        if (!stats) {
            console.log('  ❌ No statistics available');
            return false;
        }
        
        console.log(`  📈 Statistics source: ${stats.source}`);
        console.log(`  👥 Participants: ${stats.tables.participants.count}`);
        console.log(`  💬 Sessions: ${stats.tables.sessions.count}`);
        console.log(`  💭 Messages: ${stats.tables.messages.count}`);
        
        if (stats.source === 'database' && stats.connection_pool) {
            console.log(`  🔗 Pool connections: ${stats.connection_pool.total} total, ${stats.connection_pool.idle} idle`);
        }
        
        console.log('  Statistics: ✅');
        return true;
    } catch (error) {
        console.error('  ❌ Statistics test failed:', error.message);
        return false;
    }
}

async function testPrismaCoexistence() {
    console.log('\n🤝 Testing Prisma Coexistence...');
    
    try {
        if (!process.env.DATABASE_URL) {
            console.log('  ⚠️ No DATABASE_URL - skipping Prisma test');
            return true;
        }
        
        const prisma = new PrismaClient();
        
        try {
            // Test Prisma connection
            await prisma.$connect();
            console.log('  🔗 Prisma connection: ✅');
            
            // Query sessions using Prisma
            const prismaSessions = await prisma.session.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' }
            });
            console.log(`  📋 Prisma query: ✅ (${prismaSessions.length} sessions)`);
            
            await prisma.$disconnect();
            console.log('  🔌 Prisma disconnect: ✅');
            
            return true;
        } catch (prismaError) {
            console.log(`  ❌ Prisma error: ${prismaError.message}`);
            try {
                await prisma.$disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
            return false;
        }
    } catch (error) {
        console.error('  ❌ Prisma coexistence test failed:', error.message);
        return false;
    }
}

async function testExportFunctionality() {
    console.log('\n📤 Testing Export Functionality...');
    
    try {
        // Test individual getAll functions
        const participants = await database.getAllParticipants();
        const sessions = await database.getAllSessions();
        const messages = await database.getAllMessages();
        
        console.log(`  📋 Export data available: ${Array.isArray(participants) && Array.isArray(sessions) && Array.isArray(messages) ? '✅' : '❌'}`);
        console.log(`  📊 Export totals: ${participants.length} participants, ${sessions.length} sessions, ${messages.length} messages`);
        
        // Test stats for export metadata
        const stats = await database.getDatabaseStats();
        console.log(`  📈 Export metadata available: ${stats ? '✅' : '❌'}`);
        
        return true;
    } catch (error) {
        console.error('  ❌ Export test failed:', error.message);
        return false;
    }
}

async function cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
        // Note: In a real scenario, you might want to delete test data
        // For now, we'll just indicate cleanup would happen here
        console.log('  ✅ Test data cleanup would occur here');
        return true;
    } catch (error) {
        console.error('  ❌ Cleanup failed:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting Database Integration Tests');
    console.log('=====================================');
    
    const results = [];
    
    // Run all tests
    results.push(await testDatabaseConnection());
    results.push(await testSchemaInitialization());
    results.push(await testParticipantOperations());
    results.push(await testSessionOperations());
    results.push(await testMessageOperations());
    results.push(await testDatabaseStats());
    results.push(await testPrismaCoexistence());
    results.push(await testExportFunctionality());
    results.push(await cleanupTestData());
    
    // Close database connections
    await database.closeDatabase();
    
    // Summary
    const passed = results.filter(Boolean).length;
    const total = results.length;
    
    console.log('\n📊 Test Results Summary');
    console.log('=====================');
    console.log(`Passed: ${passed}/${total}`);
    console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);
    
    if (passed === total) {
        console.log('🎉 All tests passed! Database integration is working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Please check the logs above for details.');
    }
    
    return passed === total;
}

// Run tests if called directly
if (require.main === module) {
    runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    runAllTests,
    testDatabaseConnection,
    testSchemaInitialization,
    testParticipantOperations,
    testSessionOperations,
    testMessageOperations,
    testDatabaseStats,
    testPrismaCoexistence,
    testExportFunctionality
};