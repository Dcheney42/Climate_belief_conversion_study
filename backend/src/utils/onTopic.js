// backend/src/utils/onTopic.js
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