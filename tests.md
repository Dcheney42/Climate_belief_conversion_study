# 📋 Tests for Climate Belief Conversion Study App

## Manual Flow Tests
1. Run `npm start` and open http://localhost:3000
2. Consent → Survey → Chat → Exit
   - Survey saves demographics and redirects to `/chat/:participantId`
   - Chat shows assistant greeting and replies
   - Input disables after 10 minutes and redirects to exit survey
3. Verify files appear in:
   - data/participants/<id>.json
   - data/conversations/<id>.json

## API Tests

### Create participant
curl -X POST http://localhost:3000/survey/submit \
  -H "Content-Type: application/json" \
  -d '{"age":30,"gender":"male","country":"AU","education":"postgraduate","political_orientation":"centrist","prior_belief":"skeptic","current_belief":"believer"}'

### Start conversation
curl -X POST http://localhost:3000/api/conversations/start \
  -H "Content-Type: application/json" \
  -d '{"participantId":"<participantId>"}'

### Send message
curl -X POST http://localhost:3000/api/conversations/<conversationId>/message \
  -H "Content-Type: application/json" \
  -d '{"content":"I changed my mind after reading reports."}'

### End conversation
curl -X POST http://localhost:3000/api/conversations/<conversationId>/end

### Export JSON
curl -H "Authorization: Bearer Cutstarling42!" \
  http://localhost:3000/api/admin/export.json

### Export CSV
curl -H "Authorization: Bearer Cutstarling42!" \
  http://localhost:3000/api/admin/export.csv