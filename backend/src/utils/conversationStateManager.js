// backend/src/utils/conversationStateManager.js
import { PrismaClient } from '@prisma/client';

class ConversationStateManager {
  constructor() {
    this.prisma = null;
    this.cache = new Map(); // In-memory cache for performance
    this.cacheMaxSize = 1000;
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  async initializePrisma() {
    if (!this.prisma && global.db?.prisma) {
      this.prisma = global.db.prisma;
    }
    return this.prisma !== null;
  }

  // Get conversation state with caching
  async getConversationState(conversationId) {
    console.log(`🔍 Getting conversation state for: ${conversationId}`);
    
    // Check cache first
    const cached = this.cache.get(conversationId);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`✅ Using cached state for: ${conversationId}`);
      return cached.state;
    }

    // Try database if available
    if (await this.initializePrisma()) {
      try {
        const dbState = await this.prisma.conversationState.findUnique({
          where: { conversationId }
        });

        if (dbState) {
          const state = this.transformDbToState(dbState);
          this.updateCache(conversationId, state);
          console.log(`✅ Retrieved state from database for: ${conversationId}`);
          return state;
        }
      } catch (error) {
        console.error(`❌ Database error getting state for ${conversationId}:`, error.message);
      }
    }

    // Return default state if not found
    console.log(`🆕 Creating new state for: ${conversationId}`);
    const defaultState = this.createDefaultState(conversationId);
    this.updateCache(conversationId, defaultState);
    return defaultState;
  }

  // Save conversation state to database and cache
  async saveConversationState(conversationId, state) {
    console.log(`💾 Saving conversation state for: ${conversationId}`);
    
    // Update cache immediately
    this.updateCache(conversationId, state);

    // Try to persist to database
    if (await this.initializePrisma()) {
      try {
        const dbData = this.transformStateToDb(conversationId, state);
        
        await this.prisma.conversationState.upsert({
          where: { conversationId },
          update: dbData,
          create: { conversationId, ...dbData }
        });

        console.log(`✅ State persisted to database for: ${conversationId}`);
        return true;
      } catch (error) {
        console.error(`❌ Database error saving state for ${conversationId}:`, error.message);
        return false;
      }
    } else {
      console.warn(`⚠️ Database unavailable, state only cached for: ${conversationId}`);
      return false;
    }
  }

  // Update conversation state (convenience method)
  async updateConversationState(conversationId, userText) {
    const state = await this.getConversationState(conversationId);
    
    // Update state based on user response
    state.turnCount++;
    
    // Detect current topic from user response
    const currentTopic = this.extractTopic(userText);
    if (currentTopic === state.lastTopic) {
      state.topicTurnCount++;
    } else {
      state.topicTurnCount = 1;
      state.lastTopic = currentTopic;
    }
    
    // Classify response as minimal or substantive
    if (this.isMinimalResponse(userText)) {
      state.minimalResponseCount++;
      state.substantiveResponseCount = 0;
    } else {
      state.substantiveResponseCount++;
      state.minimalResponseCount = 0;
    }
    
    // Track exhaustion signals
    if (this.isExhaustionSignal(userText)) {
      state.exhaustionSignals++;
    } else {
      state.exhaustionSignals = Math.max(0, state.exhaustionSignals - 1);
    }
    
    state.lastUserResponse = userText;
    state.updatedAt = new Date();
    
    // Auto-advance stages based on conversation progress
    if (state.stage === 'exploration' && this.shouldAdvanceToElaboration(state)) {
      state.stage = 'elaboration';
      console.log(`🔄 Auto-advancing to elaboration stage for: ${conversationId}`);
    } else if (state.stage === 'elaboration' && this.shouldAdvanceToRecap(state)) {
      state.stage = 'recap';
      console.log(`🔄 Auto-advancing to recap stage for: ${conversationId}`);
    }
    
    // Save updated state
    await this.saveConversationState(conversationId, state);
    
    return state;
  }

  // Recover state from conversation messages (fallback)
  async recoverStateFromMessages(conversationId, messages) {
    console.log(`🔄 Recovering state from messages for: ${conversationId}`);
    
    const state = this.createDefaultState(conversationId);
    
    // Analyze messages to rebuild state
    const userMessages = messages.filter(msg => msg.role === 'user');
    state.turnCount = userMessages.length;
    
    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[userMessages.length - 1];
      state.lastUserResponse = lastUserMessage.content;
      state.lastTopic = this.extractTopic(lastUserMessage.content);
      
      // Count recent minimal responses
      const recentMessages = userMessages.slice(-3);
      state.minimalResponseCount = recentMessages.filter(msg => 
        this.isMinimalResponse(msg.content)
      ).length;
      
      // Count exhaustion signals
      state.exhaustionSignals = recentMessages.filter(msg => 
        this.isExhaustionSignal(msg.content)
      ).length;
      
      // Determine stage based on turn count and content
      if (state.turnCount >= 8) {
        state.stage = 'recap';
      } else if (state.turnCount >= 5) {
        state.stage = 'elaboration';
      }
    }
    
    // Save recovered state
    await this.saveConversationState(conversationId, state);
    console.log(`✅ State recovered for: ${conversationId}`);
    
    return state;
  }

  // Clean up old conversation states
  async cleanupOldStates(maxAgeHours = 24) {
    if (await this.initializePrisma()) {
      try {
        const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
        
        const deleted = await this.prisma.conversationState.deleteMany({
          where: {
            updatedAt: { lt: cutoffDate }
          }
        });
        
        console.log(`🧹 Cleaned up ${deleted.count} old conversation states`);
        return deleted.count;
      } catch (error) {
        console.error('❌ Error cleaning up old states:', error.message);
        return 0;
      }
    }
    return 0;
  }

  // Helper methods
  createDefaultState(conversationId) {
    return {
      conversationId,
      stage: 'exploration',
      turnCount: 0,
      topicTurnCount: 0,
      lastTopic: null,
      minimalResponseCount: 0,
      substantiveResponseCount: 0,
      exhaustionSignals: 0,
      lastUserResponse: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  transformDbToState(dbState) {
    return {
      conversationId: dbState.conversationId,
      stage: dbState.stage,
      turnCount: dbState.turnCount,
      topicTurnCount: dbState.topicTurnCount,
      lastTopic: dbState.lastTopic,
      minimalResponseCount: dbState.minimalResponseCount,
      substantiveResponseCount: dbState.substantiveResponseCount,
      exhaustionSignals: dbState.exhaustionSignals,
      lastUserResponse: dbState.lastUserResponse,
      metadata: dbState.metadata,
      createdAt: dbState.createdAt,
      updatedAt: dbState.updatedAt
    };
  }

  transformStateToDb(conversationId, state) {
    return {
      stage: state.stage,
      turnCount: state.turnCount,
      topicTurnCount: state.topicTurnCount,
      lastTopic: state.lastTopic,
      minimalResponseCount: state.minimalResponseCount,
      substantiveResponseCount: state.substantiveResponseCount,
      exhaustionSignals: state.exhaustionSignals,
      lastUserResponse: state.lastUserResponse,
      metadata: state.metadata || null,
      updatedAt: new Date()
    };
  }

  updateCache(conversationId, state) {
    // Implement LRU cache eviction
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(conversationId, {
      state: { ...state },
      timestamp: Date.now()
    });
  }

  // Topic extraction
  extractTopic(userText) {
    const text = userText.toLowerCase();
    if (text.includes('bushfire') || text.includes('fire')) return 'bushfires';
    if (text.includes('news') || text.includes('media')) return 'news';
    if (text.includes('evidence') || text.includes('research')) return 'evidence';
    if (text.includes('people') || text.includes('family') || text.includes('friend')) return 'social';
    return 'general';
  }

  // Response classification
  isMinimalResponse(userText) {
    const text = userText.trim().toLowerCase();
    const wordCount = text.split(/\s+/).length;
    
    const minimalPatterns = [
      /^(yeah|yes|no|nah|ok|okay|sure|maybe|i guess|dunno|don't know)$/i,
      /^(that's all|nothing else|no more|can't think of anything)$/i,
      /^(i've said everything|that's it|finished|done)$/i
    ];
    
    return wordCount <= 3 || minimalPatterns.some(pattern => pattern.test(text));
  }

  isExhaustionSignal(userText) {
    const text = userText.trim().toLowerCase();
    const exhaustionPatterns = [
      /that's all i've got/i,
      /nothing else to say/i,
      /can't think of anything/i,
      /i've said everything/i,
      /^no$/i,
      /^nah$/i,
      /^finish$/i,
      /^done$/i,
      /^finished$/i
    ];
    
    return exhaustionPatterns.some(pattern => pattern.test(text));
  }

  // Stage progression logic
  shouldAdvanceToElaboration(state) {
    return (state.substantiveResponseCount >= 3 && state.turnCount >= 5) ||
           (state.minimalResponseCount >= 2 && state.turnCount >= 4);
  }

  shouldAdvanceToRecap(state) {
    return state.exhaustionSignals >= 2 ||
           state.minimalResponseCount >= 3 ||
           (state.turnCount >= 8 && state.substantiveResponseCount >= 2);
  }

  shouldTriggerSummary(state) {
    return state.stage === 'recap' ||
           state.exhaustionSignals >= 3 ||
           state.minimalResponseCount >= 4 ||
           (state.topicTurnCount >= 4 && state.stage !== 'exploration');
  }

  // Delete conversation state
  async deleteConversationState(conversationId) {
    this.cache.delete(conversationId);
    
    if (await this.initializePrisma()) {
      try {
        await this.prisma.conversationState.delete({
          where: { conversationId }
        });
        console.log(`🗑️ Deleted state for: ${conversationId}`);
        return true;
      } catch (error) {
        console.error(`❌ Error deleting state for ${conversationId}:`, error.message);
        return false;
      }
    }
    return false;
  }
}

// Export singleton instance
export const conversationStateManager = new ConversationStateManager();