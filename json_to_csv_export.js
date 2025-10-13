const fs = require('fs');
const path = require('path');

// Read the unified JSON file
function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return null;
    }
}

// Flatten nested objects using dot notation
function flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (value === null || value === undefined) {
                flattened[newKey] = null;
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(value, newKey));
            } else if (Array.isArray(value)) {
                // For arrays, we'll handle them separately depending on context
                flattened[newKey] = JSON.stringify(value);
            } else {
                flattened[newKey] = value;
            }
        }
    }
    
    return flattened;
}

// Convert array of objects to CSV
function arrayToCSV(data, filename) {
    if (!data || data.length === 0) {
        console.log(`No data to export for ${filename}`);
        return;
    }
    
    // Get all unique headers from all objects
    const headers = new Set();
    data.forEach(item => {
        Object.keys(item).forEach(key => headers.add(key));
    });
    
    const headerArray = Array.from(headers).sort();
    
    // Create CSV content
    const csvContent = [];
    
    // Add header row
    csvContent.push(headerArray.join(','));
    
    // Add data rows
    data.forEach(item => {
        const row = headerArray.map(header => {
            const value = item[header];
            if (value === null || value === undefined) {
                return '';
            }
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        });
        csvContent.push(row.join(','));
    });
    
    return csvContent.join('\n');
}

// Main conversion function
function convertJSONToCSVs() {
    const data = readJsonFile('exports/research-data-export.json');
    if (!data) {
        console.error('Could not read unified data file');
        return;
    }
    
    // Ensure CSV export directory exists
    const csvDir = 'exports/csv';
    if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
    }
    
    console.log('Converting unified JSON to CSV files...');
    
    // 1. Participants CSV - flattened participant data
    console.log('Processing participants data...');
    const participantsData = data.participants.map(participant => {
        const flattened = flattenObject(participant);
        // Remove the chatbot_interaction array from participants CSV since it gets its own file
        delete flattened.chatbot_interaction;
        return flattened;
    });
    
    const participantsCSV = arrayToCSV(participantsData, 'participants.csv');
    if (participantsCSV) {
        fs.writeFileSync(path.join(csvDir, 'participants.csv'), participantsCSV);
        console.log(`✓ participants.csv created with ${participantsData.length} records`);
    }
    
    // 2. Belief Change CSV - extract belief change data with participant reference
    console.log('Processing belief change data...');
    const beliefChangeData = data.participants.map(participant => {
        const beliefData = {
            participant_id: participant.participant_id,
            prolific_id: participant.prolific_id,
            ...flattenObject(participant.belief_change, 'belief_change'),
            'timestamps.started': participant.timestamps.started,
            'timestamps.completed': participant.timestamps.completed
        };
        return beliefData;
    });
    
    const beliefChangeCSV = arrayToCSV(beliefChangeData, 'belief_change.csv');
    if (beliefChangeCSV) {
        fs.writeFileSync(path.join(csvDir, 'belief_change.csv'), beliefChangeCSV);
        console.log(`✓ belief_change.csv created with ${beliefChangeData.length} records`);
    }
    
    // 3. Messages CSV - extract all chatbot interaction messages
    console.log('Processing chatbot interaction messages...');
    const messagesData = [];
    let messageId = 1;
    
    data.participants.forEach(participant => {
        if (participant.chatbot_interaction && participant.chatbot_interaction.length > 0) {
            participant.chatbot_interaction.forEach(message => {
                messagesData.push({
                    id: messageId++,
                    participant_id: participant.participant_id,
                    prolific_id: participant.prolific_id,
                    sender: message.sender,
                    message: message.message,
                    character_count: message.character_count,
                    timestamp: message.timestamp
                });
            });
        }
    });
    
    const messagesCSV = arrayToCSV(messagesData, 'messages.csv');
    if (messagesCSV) {
        fs.writeFileSync(path.join(csvDir, 'messages.csv'), messagesCSV);
        console.log(`✓ messages.csv created with ${messagesData.length} records`);
    }
    
    // 4. Post Chat CSV - extract post-chat data with participant reference
    console.log('Processing post-chat data...');
    const postChatData = data.participants.map(participant => {
        const postChatFlat = {
            participant_id: participant.participant_id,
            prolific_id: participant.prolific_id,
            ...flattenObject(participant.post_chat, 'post_chat'),
            'timestamps.started': participant.timestamps.started,
            'timestamps.completed': participant.timestamps.completed,
            'has_exit_survey': participant.post_chat.final_belief_confidence !== null
        };
        return postChatFlat;
    });
    
    const postChatCSV = arrayToCSV(postChatData, 'post_chat.csv');
    if (postChatCSV) {
        fs.writeFileSync(path.join(csvDir, 'post_chat.csv'), postChatCSV);
        console.log(`✓ post_chat.csv created with ${postChatData.length} records`);
    }
    
    // Additional useful CSV files
    
    // 5. Demographics CSV - just demographics data
    console.log('Processing demographics data...');
    const demographicsData = data.participants.map(participant => ({
        participant_id: participant.participant_id,
        prolific_id: participant.prolific_id,
        ...flattenObject(participant.demographics, 'demographics')
    }));
    
    const demographicsCSV = arrayToCSV(demographicsData, 'demographics.csv');
    if (demographicsCSV) {
        fs.writeFileSync(path.join(csvDir, 'demographics.csv'), demographicsCSV);
        console.log(`✓ demographics.csv created with ${demographicsData.length} records`);
    }
    
    // 6. Views Matrix CSV - climate change and political views
    console.log('Processing views matrix data...');
    const viewsMatrixData = data.participants.map(participant => ({
        participant_id: participant.participant_id,
        prolific_id: participant.prolific_id,
        ...flattenObject(participant.views_matrix, 'views_matrix')
    }));
    
    const viewsMatrixCSV = arrayToCSV(viewsMatrixData, 'views_matrix.csv');
    if (viewsMatrixCSV) {
        fs.writeFileSync(path.join(csvDir, 'views_matrix.csv'), viewsMatrixCSV);
        console.log(`✓ views_matrix.csv created with ${viewsMatrixData.length} records`);
    }
    
    // Summary
    console.log('\n=== CSV Export Summary ===');
    console.log(`Total participants: ${data.totals.participants}`);
    console.log(`Participants with conversations: ${data.totals.with_conversations}`);
    console.log(`Participants with exit surveys: ${data.totals.with_exit_surveys}`);
    console.log(`Participants who changed beliefs: ${data.totals.belief_changers}`);
    console.log(`Total messages extracted: ${messagesData.length}`);
    console.log(`\nFiles created in ${csvDir}/:`);
    console.log('- participants.csv (main participant data)');
    console.log('- belief_change.csv (belief change details)');
    console.log('- messages.csv (chatbot conversation messages)');
    console.log('- post_chat.csv (post-conversation survey data)');
    console.log('- demographics.csv (participant demographics)');
    console.log('- views_matrix.csv (climate & political views)');
}

// Run the conversion
convertJSONToCSVs();