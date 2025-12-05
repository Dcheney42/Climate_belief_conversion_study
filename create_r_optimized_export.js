const fs = require('fs');
const path = require('path');

/**
 * Creates a flattened JSON export optimized for R CSV conversion
 * Flattens nested structures and ensures consistent data types
 */

// Helper function to safely get nested values
function safeGet(obj, path, defaultValue = null) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj);
}

// Helper function to flatten nested objects with prefixes
function flattenObject(obj, prefix = '', separator = '_') {
    const flattened = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}${separator}${key}` : key;
            
            if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(obj[key], newKey, separator));
            } else if (Array.isArray(obj[key])) {
                // Handle arrays by converting to JSON string or count
                flattened[newKey] = obj[key];
                flattened[`${newKey}_count`] = obj[key].length;
            } else {
                // Direct assignment for primitive values
                flattened[newKey] = obj[key];
            }
        }
    }
    
    return flattened;
}

// Read existing export data
function readExistingData() {
    const dataPath = path.join(__dirname, 'data', 'exports', 'research-data-export-2025-12-02.json');
    
    if (!fs.existsSync(dataPath)) {
        console.error('❌ Source data file not found:', dataPath);
        return null;
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        return data;
    } catch (error) {
        console.error('❌ Error reading source data:', error.message);
        return null;
    }
}

// Transform participant data to R-friendly flat format
function transformParticipantData(participant) {
    const flat = {
        // Core identifiers
        participant_id: safeGet(participant, 'id'),
        prolific_id: safeGet(participant, 'prolific_id'),
        consent: safeGet(participant, 'consent'),
        disqualified: safeGet(participant, 'disqualified', false),
        created_at: safeGet(participant, 'createdAt'),
        updated_at: safeGet(participant, 'updatedAt'),
        
        // Demographics - flattened with clear names
        demo_age: safeGet(participant, 'demographics.age'),
        demo_gender: safeGet(participant, 'demographics.gender'),
        demo_education: safeGet(participant, 'demographics.education'),
        
        // Belief change - flattened
        belief_has_changed_mind: safeGet(participant, 'belief_change.has_changed_mind', false),
        belief_current_view: safeGet(participant, 'belief_change.current_view'),
        belief_elaboration: safeGet(participant, 'belief_change.elaboration'),
        belief_ai_summary: safeGet(participant, 'belief_change.ai_summary'),
        belief_ai_confidence_slider: safeGet(participant, 'belief_change.ai_confidence_slider'),
        belief_ai_summary_accuracy: safeGet(participant, 'belief_change.ai_summary_accuracy'),
        belief_chatbot_summary: safeGet(participant, 'belief_change.chatbot_summary'),
        belief_chatbot_summary_validation: safeGet(participant, 'belief_change.chatbot_summary_validation'),
        belief_chatbot_summary_bullets: safeGet(participant, 'belief_change.chatbot_summary_bullets'),
        
        // Climate Change Scale (CCS) - all items flattened
        ccs_01_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_01_raw'),
        ccs_02_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_02_raw'),
        ccs_03_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_03_raw'),
        ccs_04_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_04_raw'),
        ccs_05_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_05_raw'),
        ccs_06_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_06_raw'),
        ccs_07_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_07_raw'),
        ccs_08_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_08_raw'),
        ccs_09_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_09_raw'),
        ccs_10_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_10_raw'),
        ccs_11_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_11_raw'),
        ccs_12_raw: safeGet(participant, 'views_matrix.climate_change_views.ccs_12_raw'),
        
        ccs_01_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_01_scored'),
        ccs_02_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_02_scored'),
        ccs_03_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_03_scored'),
        ccs_04_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_04_scored'),
        ccs_05_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_05_scored'),
        ccs_06_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_06_scored'),
        ccs_07_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_07_scored'),
        ccs_08_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_08_scored'),
        ccs_09_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_09_scored'),
        ccs_10_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_10_scored'),
        ccs_11_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_11_scored'),
        ccs_12_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_12_scored'),
        
        ccs_01_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_01_was_moved'),
        ccs_02_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_02_was_moved'),
        ccs_03_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_03_was_moved'),
        ccs_04_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_04_was_moved'),
        ccs_05_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_05_was_moved'),
        ccs_06_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_06_was_moved'),
        ccs_07_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_07_was_moved'),
        ccs_08_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_08_was_moved'),
        ccs_09_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_09_was_moved'),
        ccs_10_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_10_was_moved'),
        ccs_11_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_11_was_moved'),
        ccs_12_was_moved: safeGet(participant, 'views_matrix.climate_change_views.ccs_12_was_moved'),
        
        // Attention check
        ccs_attention_check_value: safeGet(participant, 'views_matrix.climate_change_views.attention_check_value'),
        ccs_attention_check_passed: safeGet(participant, 'views_matrix.climate_change_views.attention_check_passed'),
        ccs_attention_check_was_moved: safeGet(participant, 'views_matrix.climate_change_views.attention_check_was_moved'),
        
        // Mean scores
        ccs_mean_scored: safeGet(participant, 'views_matrix.climate_change_views.ccs_mean_scored'),
        ccs_occurrence_mean: safeGet(participant, 'views_matrix.climate_change_views.ccs_occurrence_mean'),
        ccs_causation_mean: safeGet(participant, 'views_matrix.climate_change_views.ccs_causation_mean'),
        ccs_seriousness_mean: safeGet(participant, 'views_matrix.climate_change_views.ccs_seriousness_mean'),
        ccs_efficacy_mean: safeGet(participant, 'views_matrix.climate_change_views.ccs_efficacy_mean'),
        ccs_trust_mean: safeGet(participant, 'views_matrix.climate_change_views.ccs_trust_mean'),
        ccs_row_order: safeGet(participant, 'views_matrix.climate_change_views.ccs_row_order'),
        
        // Political views - flattened
        political_economic_issues: safeGet(participant, 'views_matrix.political_views.economic_issues'),
        political_social_issues: safeGet(participant, 'views_matrix.political_views.social_issues'),
        political_views_order: safeGet(participant, 'views_matrix.political_views.political_views_order'),
        political_economic_issues_answered: safeGet(participant, 'views_matrix.political_views.economic_issues_answered'),
        political_social_issues_answered: safeGet(participant, 'views_matrix.political_views.social_issues_answered'),
        
        // Post-chat data
        post_final_belief_confidence: safeGet(participant, 'post_chat.final_belief_confidence'),
        post_chatbot_summary_accuracy: safeGet(participant, 'post_chat.chatbot_summary_accuracy'),
        
        // Timestamps
        timestamp_completed: safeGet(participant, 'timestamps.completed'),
        
        // Message statistics
        message_count: safeGet(participant, 'chatbot_interaction.messages.length', 0),
        has_chatbot_interaction: safeGet(participant, 'chatbot_interaction.messages.length', 0) > 0
    };
    
    // Convert arrays to JSON strings for R compatibility
    if (flat.ccs_row_order && Array.isArray(flat.ccs_row_order)) {
        flat.ccs_row_order_json = JSON.stringify(flat.ccs_row_order);
    }
    
    if (flat.political_views_order && Array.isArray(flat.political_views_order)) {
        flat.political_views_order_json = JSON.stringify(flat.political_views_order);
    }
    
    return flat;
}

// Transform message data to flat format
function transformMessageData(participants) {
    const messages = [];
    let messageId = 1;
    
    participants.forEach(participant => {
        const participantId = safeGet(participant, 'id');
        const chatMessages = safeGet(participant, 'chatbot_interaction.messages', []);
        
        chatMessages.forEach((message, index) => {
            messages.push({
                message_id: messageId++,
                participant_id: participantId,
                message_order: index + 1,
                sender: safeGet(message, 'sender'),
                text: safeGet(message, 'text'),
                timestamp: safeGet(message, 'timestamp'),
                character_count: message.text ? message.text.length : 0,
                is_participant: safeGet(message, 'sender') === 'participant',
                is_chatbot: safeGet(message, 'sender') === 'chatbot'
            });
        });
    });
    
    return messages;
}

// Main export function
function createROptimizedExport() {
    console.log('🚀 Creating R-Optimized JSON Export for CSV Conversion');
    console.log('====================================================\n');
    
    try {
        const sourceData = readExistingData();
        if (!sourceData) {
            throw new Error('Failed to read source data');
        }
        
        const participants = safeGet(sourceData, 'data.participants', []);
        console.log(`📊 Processing ${participants.length} participants...`);
        
        // Transform participant data to flat structure
        const flatParticipants = participants.map(transformParticipantData);
        
        // Transform message data
        const flatMessages = transformMessageData(participants);
        
        // Create R-friendly export structure
        const rOptimizedExport = {
            // Metadata for R processing
            export_info: {
                created_at: new Date().toISOString(),
                format_version: "r_optimized_v1.0",
                description: "Flattened JSON format optimized for R CSV conversion",
                source_file: "research-data-export-2025-12-02.json",
                r_conversion_notes: [
                    "All nested objects have been flattened with underscore separators",
                    "Arrays converted to JSON strings where needed",
                    "Consistent null handling for missing values",
                    "Boolean values preserved as TRUE/FALSE",
                    "Numeric values preserved as numbers"
                ]
            },
            
            // Summary for verification
            summary: {
                total_participants: flatParticipants.length,
                total_messages: flatMessages.length,
                participants_with_demographics: flatParticipants.filter(p => p.demo_age !== null).length,
                participants_with_belief_change: flatParticipants.filter(p => p.belief_has_changed_mind === true).length,
                participants_with_chatbot_interaction: flatParticipants.filter(p => p.has_chatbot_interaction === true).length,
                participants_with_climate_views: flatParticipants.filter(p => p.ccs_01_raw !== null).length,
                participants_with_political_views: flatParticipants.filter(p => p.political_economic_issues !== null || p.political_social_issues !== null).length
            },
            
            // Main data tables - ready for R dataframe conversion
            data_tables: {
                participants: flatParticipants,
                messages: flatMessages
            },
            
            // Field descriptions for R users
            field_descriptions: {
                participants: {
                    participant_id: "Unique participant identifier",
                    prolific_id: "Prolific platform ID",
                    consent: "Consent given (boolean)",
                    disqualified: "Participant disqualified (boolean)",
                    demo_age: "Age in years",
                    demo_gender: "Gender identity",
                    demo_education: "Education level",
                    belief_has_changed_mind: "Reports changing mind about climate change (boolean)",
                    belief_current_view: "Current view on climate change (text)",
                    belief_elaboration: "Elaboration on belief change (text)",
                    belief_ai_summary: "AI-generated summary of beliefs",
                    belief_chatbot_summary: "Chatbot summary of conversation",
                    ccs_01_raw: "Climate Change Scale item 1 raw score (1-100)",
                    ccs_mean_scored: "Mean of all scored CCS items",
                    political_economic_issues: "Economic political orientation (1-10)",
                    political_social_issues: "Social political orientation (1-10)",
                    post_final_belief_confidence: "Final belief confidence rating",
                    message_count: "Number of chatbot messages exchanged"
                },
                messages: {
                    message_id: "Unique message identifier",
                    participant_id: "Participant who sent/received message",
                    message_order: "Order within conversation",
                    sender: "Message sender (participant or chatbot)",
                    text: "Message content",
                    timestamp: "Message timestamp (ISO format)",
                    character_count: "Length of message in characters",
                    is_participant: "Message from participant (boolean)",
                    is_chatbot: "Message from chatbot (boolean)"
                }
            }
        };
        
        return rOptimizedExport;
        
    } catch (error) {
        console.error('❌ Error creating R-optimized export:', error.message);
        return null;
    }
}

// Write the export
function writeROptimizedExport() {
    const exportData = createROptimizedExport();
    
    if (!exportData) {
        console.error('❌ Failed to create export data');
        return false;
    }
    
    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    // Write the R-optimized export
    const outputPath = path.join(exportsDir, 'r-optimized-export.json');
    
    try {
        fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
        
        console.log('✅ R-Optimized export created successfully!');
        console.log(`📁 Output file: ${outputPath}`);
        console.log('\n📊 Export Summary:');
        console.log(`   • ${exportData.summary.total_participants} participants`);
        console.log(`   • ${exportData.summary.total_messages} messages`);
        console.log(`   • ${exportData.summary.participants_with_demographics} with demographics`);
        console.log(`   • ${exportData.summary.participants_with_belief_change} with belief change`);
        console.log(`   • ${exportData.summary.participants_with_chatbot_interaction} with chatbot interactions`);
        console.log(`   • ${exportData.summary.participants_with_climate_views} with climate views`);
        console.log(`   • ${exportData.summary.participants_with_political_views} with political views`);
        
        console.log('\n🔧 Next Steps:');
        console.log('   1. Use the corresponding R script to convert this JSON to CSV');
        console.log('   2. The flattened structure makes CSV conversion straightforward');
        console.log('   3. All nested objects have been flattened with clear naming conventions');
        
        return outputPath;
        
    } catch (error) {
        console.error('❌ Error writing export file:', error.message);
        return false;
    }
}

// Export for use as module or run directly
if (require.main === module) {
    writeROptimizedExport();
}

module.exports = { 
    createROptimizedExport, 
    writeROptimizedExport,
    transformParticipantData,
    transformMessageData 
};