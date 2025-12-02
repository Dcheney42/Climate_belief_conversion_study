# Chatbot Summary Validation Text Cleaning Plan

## Problem
On the chatbot-summary-validation.html page, bullet points end with unwanted question text:
- "Does this summary capture your experience accurately? Feel free to add or adjust anything!"
- "Does this summary capture your experience accurately, or"

## Solution
Add text cleaning transformation to remove everything starting from "Does this summary capture your experience accurately" regardless of what follows.

## Implementation Details

### 1. Add New Function
Create a function `cleanSummaryText(text)` that:
- Uses case-insensitive regex: `/\s*Does this summary capture your experience accurately.*$/i`
- Removes the matching substring and everything after it
- Trims leftover whitespace

### 2. Integration Points
Apply this cleaning function in two places:

#### A. In `displaySummary()` function (line 105)
- When processing array of summary points (lines 110-130)
- Apply cleaning to each point before formatting

#### B. In `extractBulletPointsFromString()` function (line 151) 
- When processing individual bullet points (around lines 168-188)
- Apply cleaning after existing question removal logic

### 3. Implementation Code

```javascript
// Add this new function after line 103
function cleanSummaryText(text) {
    // Remove everything starting from "Does this summary capture your experience accurately"
    const cleanedText = text.replace(/\s*Does this summary capture your experience accurately.*$/i, '');
    return cleanedText.trim();
}
```

### 4. Modify displaySummary() function
- Apply `cleanSummaryText()` to each point before other formatting (around line 113)

### 5. Modify extractBulletPointsFromString() function  
- Apply `cleanSummaryText()` to each bullet point after existing cleaning (around line 172)

## Files to Modify
- `public/chatbot-summary-validation.html` - Main implementation

## Testing Requirements
1. Verify bullet points end cleanly without the question text
2. Ensure no extra blank lines or stray punctuation
3. Confirm other pages are not affected
4. Test with sample data containing the problematic text

## Expected Outcome
Bullet points will end with the last sentence of the summary, with no trailing question text, maintaining clean formatting.