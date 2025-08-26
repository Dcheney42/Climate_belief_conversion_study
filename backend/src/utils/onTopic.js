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
  return "That's interesting! I'd love to keep our conversation focused on climate change though. Could you tell me more about your thoughts on that topic?";
}