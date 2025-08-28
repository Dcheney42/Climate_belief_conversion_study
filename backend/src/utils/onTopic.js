// backend/src/utils/onTopic.js
const OFF_TOPIC_PATTERNS = [
  /talk about something else/i,
  /another topic/i,
  /what would you like to discuss/i,
  /anything you want/i,
  /change the subject/i,
  /different topic/i,
];

export function enforceOnTopic(text) {
  if (!text) return false;
  return !OFF_TOPIC_PATTERNS.some((re) => re.test(text));
}

export function redirectLine() {
  return "I appreciate you sharing that! For this interview, I'd like to stay focused on your climate change beliefs and experiences. Could we return to discussing that topic?";
}