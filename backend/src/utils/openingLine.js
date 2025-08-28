// backend/src/utils/openingLine.js
export function openingLineFrom(profile) {
  const { views_changed, change_direction } = profile || {};

  if (views_changed === 'Yes') {
    return "Hi there! Thanks for sharing that your views on climate change have changed. I'd love to hear your story about that journey. Let's start at the beginning - can you tell me how you used to think about climate change?";
  } else {
    return "Hello! I'm here to learn about your thoughts and experiences with climate change. Let's start by talking about your perspective - can you tell me how you currently think about climate change?";
  }
}