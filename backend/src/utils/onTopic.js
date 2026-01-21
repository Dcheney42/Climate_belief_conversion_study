// backend/src/utils/onTopic.js

// State management for repetition detection and question gating
let conversationState = {
  userAnswers: [], // Track last 5 user messages
  lastQuestionIntent: null, // Track the type of last question asked
  eventConfirmed: false, // Flag when user has identified an event 2+ times
  identifiedEvents: {}, // Track events mentioned and their count
};

const OFF_TOPIC_PATTERNS = [
  /talk about something else/i,
  /another topic/i,
  /what would you like to discuss/i,
  /anything you want/i,
  /change the subject/i,
  /different topic/i,
];

// Patterns that indicate drift into political specifics rather than belief change narrative
const POLITICAL_DRIFT_PATTERNS = [
  /what political activities/i,
  /specific political/i,
  /party's stance/i,
  /party platform/i,
  /democratic party.*position/i,
  /republican party.*position/i,
  /political involvement/i,
  /campaign/i,
  /election/i,
  /candidate.*policies/i,
  /voting.*issues/i,
];

// Patterns that indicate drift away from personal belief change story
const BELIEF_DRIFT_PATTERNS = [
  /getting.*off topic/i,
  /bit off topic/i,
  /not about.*belief/i,
  /away from.*change/i,
];

// Patterns that indicate drift into roles/actions rather than belief change narrative
const ACTION_ROLE_DRIFT_PATTERNS = [
  /your role.*in.*addressing/i,
  /role.*of.*others.*in.*making.*difference/i,
  /what.*you.*can.*do/i,
  /what.*should.*people.*do/i,
  /how.*can.*you.*help/i,
  /your.*responsibility/i,
  /society.*role.*in.*addressing/i,
  /role.*in.*making.*difference/i,
  /what.*actions.*should/i,
  /how.*to.*solve.*climate/i,
  /what.*needs.*to.*be.*done/i,
  /making.*a.*difference/i,
  /addressing.*these.*problems/i,
  /how.*can.*society.*make.*difference/i,
  /society.*make.*difference/i,
];

export function enforceOnTopic(text) {
  if (!text) return false;
  return !OFF_TOPIC_PATTERNS.some((re) => re.test(text));
}

export function detectPoliticalDrift(text) {
  if (!text) return false;
  return POLITICAL_DRIFT_PATTERNS.some((re) => re.test(text));
}

export function detectBeliefDrift(text) {
  if (!text) return false;
  return BELIEF_DRIFT_PATTERNS.some((re) => re.test(text));
}

export function detectActionRoleDrift(text) {
  if (!text) return false;
  return ACTION_ROLE_DRIFT_PATTERNS.some((re) => re.test(text));
}

export function redirectLine(driftType = 'general') {
  switch (driftType) {
    case 'political':
      return "I understand political engagement is part of your story. Let's focus on how your personal experience with climate change shaped your beliefs rather than the specific political details. What was it about your experience that most influenced your thinking?";
    case 'belief':
      return "You're right, let's refocus on your belief change. What stands out most to you about how your understanding of climate change evolved?";
    case 'action':
      return "I can see you're thinking about what should be done about climate change. For this interview, I'd like to stay focused on your personal belief change story rather than discussing actions or roles. What specific moment or experience was most significant in changing your views?";
    default:
      return "I can see that's important to you. For this interview, I'd like to stay focused on understanding how and why your beliefs about climate change changed. How did that experience influence your thinking about climate change specifically?";
  }
}

// Normalize text for comparison
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim();
}

// Event patterns to detect specific events mentioned
const EVENT_PATTERNS = [
  /bushfire/i, /wildfire/i, /fire/i,
  /hurricane/i, /cyclone/i, /typhoon/i,
  /flood/i, /flooding/i,
  /drought/i, /heatwave/i,
  /coral.*bleach/i, /bleach.*coral/i,
  /storm/i, /tornado/i,
  /melting.*ice/i, /ice.*melting/i,
  /sea.*level.*ris/i,
  /extinction/i,
];

// Track user responses and detect repetition
export function trackUserResponse(userMessage) {
  if (!userMessage) return;
  
  const normalized = normalizeText(userMessage);
  
  // Add to user answers history (keep last 5)
  conversationState.userAnswers.push(normalized);
  if (conversationState.userAnswers.length > 5) {
    conversationState.userAnswers.shift();
  }
  
  // Check for event mentions and track them
  EVENT_PATTERNS.forEach(pattern => {
    if (pattern.test(userMessage)) {
      const eventKey = pattern.source.replace(/[^a-z]/gi, ''); // Simple key from pattern
      conversationState.identifiedEvents[eventKey] = (conversationState.identifiedEvents[eventKey] || 0) + 1;
      
      // If any event mentioned 2+ times, mark as confirmed
      if (conversationState.identifiedEvents[eventKey] >= 2) {
        conversationState.eventConfirmed = true;
      }
    }
  });
}

// Detect if user is repeating the same answer
export function detectRepetition(currentMessage) {
  if (!currentMessage || conversationState.userAnswers.length < 2) return false;
  
  const currentNormalized = normalizeText(currentMessage);
  const recent = conversationState.userAnswers.slice(-2); // Last 2 messages
  
  // Check if current message is very similar to recent ones
  return recent.some(prev => {
    if (!prev || prev.length === 0) return false;
    
    // Simple similarity check - if 70% of words match
    const currentWords = currentNormalized.split(' ');
    const prevWords = prev.split(' ');
    
    if (currentWords.length === 0 || prevWords.length === 0) return false;
    
    const matches = currentWords.filter(word =>
      word.length > 2 && prevWords.includes(word)
    ).length;
    
    return matches / Math.max(currentWords.length, prevWords.length) > 0.7;
  });
}

// Question intent types
const QUESTION_INTENTS = {
  ASK_EVENT: 'ask_event',
  ASK_IMPACT: 'ask_impact',
  ASK_TIMELINE: 'ask_timeline_next',
  ASK_ACTION: 'ask_action_change',
  ASK_SOCIAL: 'ask_social_context',
  ASK_EMOTION: 'ask_emotion'
};

// Track the last question intent
export function setQuestionIntent(intent) {
  conversationState.lastQuestionIntent = intent;
}

// Check if a question type should be blocked
export function isQuestionBlocked(intent) {
  // Block event questions if event is confirmed or if last question was also event-seeking
  if (intent === QUESTION_INTENTS.ASK_EVENT) {
    return conversationState.eventConfirmed ||
           conversationState.lastQuestionIntent === QUESTION_INTENTS.ASK_EVENT ||
           Object.keys(conversationState.identifiedEvents).length > 0;
  }
  
  return false;
}

// Get alternative question when blocked
export function getAlternativeQuestion() {
  const alternatives = [
    "What about that made it convincing for you?",
    "How did it change what you believed humans were doing?",
    "What happened next after you saw that?",
    "Did anyone influence you around that time?",
    "What did you do differently afterward?"
  ];
  
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

// Reset state for new conversation
export function resetConversationState() {
  conversationState = {
    userAnswers: [],
    lastQuestionIntent: null,
    eventConfirmed: false,
    identifiedEvents: {},
  };
}

// Get current state (for debugging/monitoring)
export function getConversationState() {
  return { ...conversationState };
}