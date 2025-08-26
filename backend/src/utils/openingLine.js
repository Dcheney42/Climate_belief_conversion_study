// backend/src/utils/openingLine.js
export function openingLineFrom(profile) {
  const { changed_belief_flag } = profile || {};

  if (changed_belief_flag) {
    return "Hi there! I'm interested in learning about your thoughts on climate change. It sounds like your views may have evolved over time - I'd love to hear about what led to any shifts in your thinking.";
  } else {
    return "Hello! I'm here to chat with you about your thoughts on climate change. I'd be really interested to hear about what factors have been most important in shaping your current views on this topic.";
  }
}