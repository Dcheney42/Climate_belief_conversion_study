// backend/src/utils/openingLine.js
export function openingLineFrom(profile) {
  const { views_changed, change_direction } = profile || {};

  if (views_changed === 'Yes' && change_direction) {
    // Extract the direction for a more personalized opening
    let fromTo = '';
    if (change_direction === 'From climate sceptic to climate believer') {
      fromTo = 'skeptic to believer';
    } else if (change_direction === 'From climate believer to climate sceptic') {
      fromTo = 'believer to skeptic';
    } else {
      fromTo = 'one view to another';
    }
    
    return `Hi there! Thanks for continuing with the study. Earlier, you mentioned that your view on climate change shifted — from ${fromTo}. I'd love to hear more about that. Can you tell me in your own words how that change came about?`;
  } else if (views_changed === 'Yes') {
    return "Hi there! Thanks for continuing with the study. Earlier, you mentioned that your views on climate change have shifted. I'd love to hear more about that. Can you tell me in your own words how that change came about?";
  } else {
    return "Hello! I'm here to learn about your thoughts and experiences with climate change. Let's start by talking about your perspective - can you tell me how you currently think about climate change?";
  }
}