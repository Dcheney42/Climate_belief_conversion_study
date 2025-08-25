# Climate Change Conversation Platform

A research platform for studying cross-ideological conversations about climate change. Participants are paired based on opposing views and engage in real-time conversations through a Facebook Messenger-style interface.

## 🎯 Purpose

This platform facilitates research on how people with different climate change perspectives communicate with each other. It's designed for use with Prolific participants and provides a controlled environment for studying attitude change and cross-ideological dialogue.

## ✨ Features

- **Facebook Messenger-style chat interface** for familiar user experience
- **Automatic participant pairing** based on climate change views (pro-climate vs anti-climate)
- **Real-time messaging** with typing indicators and connection status
- **5-minute timed conversations** with visual countdown
- **Comprehensive data collection**:
  - Pre-conversation survey responses
  - Complete chat transcripts
  - Post-conversation exit surveys
- **Participant classification algorithm** based on survey responses
- **Professional UI/UX** designed for research participants

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sammmy-p/debate_paradigm.git
cd debate_paradigm
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Access the platform at `http://localhost:3000`

## 📊 Data Collection

The platform automatically saves data in JSON format:

### Participant Data (`data/participants/`)
- Survey responses and climate change classifications
- Demographics and Prolific IDs
- Pro-climate vs anti-climate categorization

### Conversation Data (`data/conversations/`)
- Complete chat transcripts with timestamps
- Message counts and conversation duration
- Completion reasons (time limit, disconnect, etc.)

### Exit Survey Data (`data/exports/`)
- Post-conversation feedback and attitude changes
- Platform usability ratings
- Participant experience data

## 🌐 Deployment for Prolific

### Cloud Hosting Options

**Heroku (Recommended)**
1. Create a Heroku account
2. Install Heroku CLI
3. Deploy:
```bash
heroku create your-study-name
git push heroku main
```

**Railway**
1. Connect your GitHub repository
2. Deploy automatically from Railway dashboard

**DigitalOcean App Platform**
1. Connect repository
2. Configure build settings
3. Deploy

### Environment Setup

For production deployment, ensure:
- Set `NODE_ENV=production`
- Configure any necessary environment variables
- Ensure data directory permissions are correct

## 🔧 Configuration

### Survey Questions
Modify survey questions in `public/survey.html`

### Classification Algorithm
Adjust participant classification logic in `server.js` (function `classifyParticipant`)

### Conversation Duration
Change timer duration in `server.js` (default: 300 seconds = 5 minutes)

### Styling
Customize the Facebook Messenger interface in `public/messenger-styles.css`

## 📱 User Flow

1. **Landing Page** - Study introduction and Prolific ID entry
2. **Consent Form** - Informed consent for participation
3. **Survey** - Climate change views and demographics
4. **Waiting Room** - Participant matching (up to 10 minutes)
5. **Chat Interface** - 5-minute conversation with opposing participant
6. **Exit Survey** - Post-conversation feedback and attitude assessment

## 🛠️ Technical Stack

- **Backend**: Node.js with Express.js
- **Real-time Communication**: Socket.io
- **Frontend**: HTML, CSS, JavaScript
- **Data Storage**: JSON files
- **Styling**: Custom CSS (Facebook Messenger-inspired)

## 📋 Research Features

- **Automatic participant classification** based on survey responses
- **Balanced pairing** of pro-climate and anti-climate participants
- **Conversation quality metrics** (message count, duration, completion rate)
- **Attitude change measurement** through pre/post surveys
- **Platform usability assessment** for research validity

## 🔒 Privacy & Ethics

- Participant data is anonymized with generated IDs
- Prolific IDs are stored separately for payment purposes
- All conversations are logged for research analysis
- Participants can leave at any time
- Data retention follows research ethics guidelines

## 📄 License

This project is for academic research purposes. Please cite appropriately if used in publications.

## 👥 Contact

For questions about this research platform, please contact the research team.

---

**Note**: This platform is designed for controlled research environments. Ensure proper ethical approval before collecting participant data.