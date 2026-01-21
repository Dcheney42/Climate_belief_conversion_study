// Test: Summary drift detection issue
// This test checks if bullet point summaries are being incorrectly flagged as off-topic

console.log('🔍 Testing Summary Drift Detection Issue...\n');

// Simulate the drift detection functions from onTopic.js
const OFF_TOPIC_PATTERNS = [
  /talk about something else/i,
  /another topic/i,
  /what would you like to discuss/i,
  /anything you want/i,
  /change the subject/i,
  /different topic/i,
];

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

function enforceOnTopic(text) {
  if (!text) return false;
  return !OFF_TOPIC_PATTERNS.some((re) => re.test(text));
}

function detectPoliticalDrift(text) {
  if (!text) return false;
  return POLITICAL_DRIFT_PATTERNS.some((re) => re.test(text));
}

function detectActionRoleDrift(text) {
  if (!text) return false;
  return ACTION_ROLE_DRIFT_PATTERNS.some((re) => re.test(text));
}

// Test various summary formats that the LLM might produce
const testSummaries = [
  {
    name: "Standard bullet point summary",
    content: `I understand that time is running short. Let me summarize the key themes from our conversation:

• You described how your uncle's extreme climate views actually pushed you away from climate activism
• You mentioned that seeing bushfires in your local area made the issue feel more real and immediate  
• You talked about how research and evidence became more important to you over time
• You shared that your views shifted from skepticism to acceptance gradually
• You discussed how personal experiences were more influential than media coverage

Is there anything important you'd like to add before we finish?`
  },
  {
    name: "Summary with action-oriented language",
    content: `Thank you for sharing your story. Here are the key themes:

• You experienced a shift in your beliefs about what needs to be done regarding climate change
• You talked about how society's role in addressing these problems became clearer to you
• You discussed what actions should be taken based on your new understanding
• You mentioned how people can help make a difference
• You shared your thoughts on your responsibility in addressing these issues

Does this capture your experience accurately?`
  },
  {
    name: "Summary with political language",
    content: `Let me summarize what you've shared:

• You discussed how specific political activities influenced your thinking
• You mentioned the democratic party's position on climate issues
• You talked about voting issues related to environmental policy
• You shared thoughts about campaign messages you encountered
• You described how party platforms shaped your views

Is this accurate?`
  },
  {
    name: "Clean summary without triggers",
    content: `Based on our conversation, here are the key points:

• You described a gradual shift in your climate change beliefs
• You mentioned personal experiences that were particularly influential
• You talked about the role of evidence and research in your thinking
• You shared how social influences affected your perspective
• You discussed the timeline of your belief change journey

Does this reflect your experience?`
  }
];

console.log('Testing drift detection on different summary formats:\n');

testSummaries.forEach(test => {
  console.log(`\n📝 Testing: ${test.name}`);
  console.log(`Content preview: ${test.content.substring(0, 100)}...`);
  
  const isOffTopic = !enforceOnTopic(test.content);
  const isPoliticalDrift = detectPoliticalDrift(test.content);
  const isActionRoleDrift = detectActionRoleDrift(test.content);
  
  console.log(`❓ Off-topic detected: ${isOffTopic}`);
  console.log(`🏛️ Political drift detected: ${isPoliticalDrift}`);
  console.log(`⚡ Action/role drift detected: ${isActionRoleDrift}`);
  
  const wouldBeBlocked = isOffTopic || isPoliticalDrift || isActionRoleDrift;
  console.log(`🚫 Would summary be BLOCKED? ${wouldBeBlocked ? 'YES' : 'NO'}`);
  
  if (wouldBeBlocked) {
    console.log('⚠️ THIS SUMMARY WOULD BE REPLACED WITH REDIRECT MESSAGE!');
  }
});

console.log('\n' + '='.repeat(60));
console.log('🔍 HYPOTHESIS TEST RESULTS:');
console.log('If summaries are being blocked by drift detection, this explains');
console.log('why users never see bullet points - they get redirect messages instead.');