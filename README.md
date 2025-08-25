# Climate Change Conversation Platform

A research platform for studying AI-assisted conversations about climate change. Participants engage in conversations with an AI assistant that helps them explore their views on climate change.

## 🎯 Purpose

This platform facilitates research on how people discuss and reflect on their climate change perspectives through AI-guided conversations. It's designed for use with Prolific participants and provides a controlled environment for studying attitude exploration and reflection.

## ✨ Features

- **Clean conversation interface** for engaging user experience
- **AI-powered conversations** using OpenAI's GPT models
- **10-minute timed conversations** with visual countdown
- **Comprehensive data collection**:
  - Pre-conversation survey responses (demographics, beliefs)
  - Complete conversation transcripts with AI responses
  - Structured participant data storage
- **Professional UI/UX** designed for research participants
- **Admin export functionality** for data analysis

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sammmy-p/Climate_belief_conversion_study.git
cd Climate_belief_conversion_study
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Then edit `.env` with your actual values:
- `OPENAI_API_KEY`: Your OpenAI API key
- `ADMIN_TOKEN`: Secure token for admin endpoints
- `PORT`: Server port (default: 3000)

4. Start the server:
```bash
npm start
```

5. Access the platform at `http://localhost:3000`

## 📊 Data Collection

The platform automatically saves data in JSON format:

### Participant Data (`data/participants/`)
- Demographics (age, gender, country, education, political orientation)
- Climate change beliefs (prior and current)
- Unique participant IDs and timestamps
- Optional Prolific IDs for payment

### Conversation Data (`data/conversations/`)
- Complete conversation transcripts with AI responses
- Message timestamps and role indicators (user/assistant)
- Conversation duration and completion status
- System prompts used for AI responses

### Export Data (`data/exports/`)
- Combined CSV and JSON exports for analysis
- Participant demographics linked to conversation data

## 🔧 Environment Variables

Required environment variables (see `.env.example`):

```env
OPENAI_API_KEY=your-openai-key-here
ADMIN_TOKEN=changeme
PORT=3000
```

## 📊 Admin Export Endpoints

### JSON Export
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3000/api/admin/export.json
```

### CSV Export
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3000/api/admin/export.csv \
     -o conversation_export.csv
```

## 🌐 Deployment for Prolific

### Cloud Hosting Options

**Heroku (Recommended)**
1. Create a Heroku account
2. Install Heroku CLI
3. Deploy:
```bash
heroku create your-study-name
heroku config:set OPENAI_API_KEY=your-key-here
heroku config:set ADMIN_TOKEN=your-secure-token
git push heroku main
```

**Railway**
1. Connect your GitHub repository
2. Add environment variables in Railway dashboard
3. Deploy automatically

**DigitalOcean App Platform**
1. Connect repository
2. Configure environment variables
3. Deploy

### Environment Setup

For production deployment, ensure:
- Set `NODE_ENV=production`
- Configure all required environment variables
- Ensure data directory permissions are correct
- Use a secure `ADMIN_TOKEN`

## 🔧 Configuration

### Survey Questions
Modify survey fields in `public/survey.html`

### AI System Prompt
Adjust the AI behavior in `server.js` (look for `systemPrompt` variable)

### Conversation Duration
Change timer duration in both:
- `server.js` (API timeout: currently 600 seconds = 10 minutes)
- `public/chat.html` (frontend timer: currently 600 seconds = 10 minutes)

### Styling
Customize the interface in `public/styles.css` and `public/messenger-styles.css`

## 📱 User Flow

1. **Landing Page** - Study introduction and Prolific ID entry
2. **Consent Form** - Informed consent for participation
3. **Survey** - Demographics and climate change beliefs
4. **Chat Interface** - 10-minute AI-guided conversation
5. **Exit Survey** - Post-conversation feedback

## 🛠️ Technical Stack

- **Backend**: Node.js with Express.js
- **AI Integration**: OpenAI API (GPT-4o-mini)
- **Frontend**: HTML, CSS, JavaScript
- **Data Storage**: JSON files
- **API Architecture**: RESTful endpoints

## 📋 Research Features

- **Structured participant data collection** with demographics and beliefs
- **AI-guided conversation flow** designed to encourage reflection
- **Comprehensive conversation logging** with timestamps
- **Flexible export options** (JSON and CSV) for analysis
- **Secure admin access** for data retrieval

## 🔒 Privacy & Ethics

- Participant data is anonymized with generated UUIDs
- Prolific IDs are optional and stored separately
- All conversations are logged for research analysis
- Participants can leave at any time
- Data retention follows research ethics guidelines
- Secure admin authentication for data access

## 📄 License

This project is for academic research purposes. Please cite appropriately if used in publications.

## 👥 Contact

For questions about this research platform, please contact the research team.

---

**Note**: This platform is designed for controlled research environments. Ensure proper ethical approval before collecting participant data.