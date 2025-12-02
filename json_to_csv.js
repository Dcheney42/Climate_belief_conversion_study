const fs = require('fs');
const path = require('path');

// Helper function to flatten nested objects with dot notation
function flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (obj[key] === null || obj[key] === undefined) {
                flattened[newKey] = '';
            } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(obj[key], newKey));
            } else if (Array.isArray(obj[key])) {
                // Convert arrays to comma-separated strings
                flattened[newKey] = obj[key].join(', ');
            } else {
                flattened[newKey] = obj[key];
            }
        }
    }
    
    return flattened;
}

// Helper function to convert array of objects to CSV
function arrayToCSV(array, filename) {
    if (!array || array.length === 0) {
        console.log(`Warning: ${filename} is empty`);
        return '';
    }

    // Flatten all objects first
    const flattenedArray = array.map(item => flattenObject(item));
    
    // Get all unique keys from all objects
    const allKeys = [...new Set(flattenedArray.flatMap(obj => Object.keys(obj)))];
    
    // Create CSV header
    const header = allKeys.join(',');
    
    // Create CSV rows
    const rows = flattenedArray.map(obj => {
        return allKeys.map(key => {
            const value = obj[key] || '';
            // Escape values that contain commas, quotes, or newlines
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',');
    });
    
    return [header, ...rows].join('\n');
}

// Main function to convert JSON to CSV files
function convertJSONToCSV() {
    try {
        // Read the combined JSON file
        console.log('Reading research-data-export.json...');
        const jsonData = JSON.parse(fs.readFileSync('research-data-export.json', 'utf8'));
        
        // Create exports directory if it doesn't exist
        const exportsDir = 'exports';
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir);
            console.log('Created exports/ directory');
        }
        
        // Extract data branches
        const dataBranches = jsonData.data;
        
        // Convert each branch to CSV
        const branches = ['participants', 'sessions', 'conversations', 'messages', 'exit_surveys'];
        
        branches.forEach(branch => {
            console.log(`Converting ${branch} to CSV...`);
            
            const data = dataBranches[branch];
            const csvContent = arrayToCSV(data, branch);
            
            if (csvContent) {
                const csvPath = path.join(exportsDir, `${branch}.csv`);
                fs.writeFileSync(csvPath, csvContent);
                console.log(`✓ Created ${csvPath} (${data.length} records)`);
            }
        });
        
        // Create a summary file with metadata
        const summaryContent = [
            'export_timestamp,total_participants,total_conversations,total_sessions,total_exit_surveys,total_messages',
            `${jsonData.exported_at},${jsonData.totals.participants},${jsonData.totals.conversations},${jsonData.totals.sessions},${jsonData.totals.exit_surveys},${jsonData.totals.messages}`
        ].join('\n');
        
        fs.writeFileSync(path.join(exportsDir, 'summary.csv'), summaryContent);
        console.log('✓ Created exports/summary.csv');
        
        console.log('\n🎉 CSV conversion complete!');
        console.log(`\nGenerated files in exports/ directory:`);
        console.log(`- participants.csv (${jsonData.totals.participants} records)`);
        console.log(`- sessions.csv (${jsonData.totals.sessions} records)`);
        console.log(`- conversations.csv (${jsonData.totals.conversations} records)`);
        console.log(`- messages.csv (${jsonData.totals.messages} records)`);
        console.log(`- exit_surveys.csv (${jsonData.totals.exit_surveys} records)`);
        console.log(`- summary.csv (metadata)`);
        
    } catch (error) {
        console.error('Error converting JSON to CSV:', error.message);
        process.exit(1);
    }
}

// Run the conversion
console.log('Starting JSON to CSV conversion...');
convertJSONToCSV();