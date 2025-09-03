// backend/src/utils/openingLine.js

function generateSummary(text) {
  if (!text || text.trim().length === 0) {
    return null;
  }
  
  // Simple summarization logic - extract key themes and create 1-2 sentences
  const words = text.toLowerCase().split(/\s+/);
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'under', 'over', 'around', 'near', 'far', 'beyond', 'across', 'along', 'through', 'throughout', 'within', 'onto', 'upon', 'off', 'down', 'out', 'away', 'back', 'around', 'towards', 'against', 'beside', 'beneath', 'behind', 'ahead', 'inside', 'outside', 'upward', 'downward', 'forward', 'backward', 'inward', 'outward', 'sideways', 'clockwise', 'counterclockwise', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'i', 'me', 'we', 'us', 'you', 'he', 'him', 'she', 'it', 'they', 'them'];
  
  // Get key phrases and words
  const keyWords = words.filter(word =>
    word.length > 3 &&
    !commonWords.includes(word) &&
    !word.match(/^\d+$/)
  );
  
  // Simple summary based on text length and key themes
  const textLength = text.trim().length;
  
  if (textLength < 50) {
    return `You mentioned ${text.toLowerCase().replace(/\.$/, '')}.`;
  } else if (textLength < 150) {
    return `You described how ${text.toLowerCase().charAt(0) + text.slice(1, -1).replace(/\.$/, '')}.`;
  } else {
    // For longer texts, try to extract main theme
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      return `You shared that ${firstSentence.toLowerCase().charAt(0) + firstSentence.slice(1)}.`;
    }
    return `You provided a detailed account of your experience changing your mind about climate change.`;
  }
}

export function openingLineFrom(profile) {
  const { views_changed, change_description } = profile || {};

  if (views_changed === 'Yes') {
    if (change_description && change_description.trim().length > 0) {
      // Generate summary of their description
      const summary = generateSummary(change_description.trim());
      
      return `Here's what you shared about how your views changed: ${summary} Did I capture that correctly, or would you like to add or clarify anything before we continue?`;
    } else {
      // Text box was left blank
      return "To start, could you briefly describe how your views on climate change changed, in your own words?";
    }
  } else {
    return "Hello! I'm here to learn about your thoughts and experiences with climate change. Let's start by talking about your perspective - can you tell me how you currently think about climate change?";
  }
}