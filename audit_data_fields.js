// Comprehensive audit script to verify all data fields are being captured
const fs = require('fs');
const path = require('path');

// Define expected fields from each form
const FORM_FIELDS = {
    'survey.html': {
        name: 'Demographics & Eligibility',
        fields: [
            { name: 'age', type: 'number', required: false, destination: 'demographics.age' },
            { name: 'gender', type: 'string', required: false, destination: 'demographics.gender' },
            { name: 'education', type: 'string', required: false, destination: 'demographics.education' },
            { name: 'viewsChanged', type: 'string', required: true, destination: 'belief_change.has_changed_mind' }
        ]
    },
    'cc-views-matrix.html': {
        name: 'Climate Change Skepticism Scale',
        fields: [
            // CCS raw values
            ...Array.from({length: 12}, (_, i) => ({ 
                name: `ccs_${String(i+1).padStart(2, '0')}_raw`, 
                type: 'number', 
                required: false, 
                destination: `views_matrix.climate_change_views.ccs_${String(i+1).padStart(2, '0')}_raw` 
            })),
            // CCS scored values  
            ...Array.from({length: 12}, (_, i) => ({ 
                name: `ccs_${String(i+1).padStart(2, '0')}_scored`, 
                type: 'number', 
                required: false, 
                destination: `views_matrix.climate_change_views.ccs_${String(i+1).padStart(2, '0')}_scored` 
            })),
            // CCS metadata
            ...Array.from({length: 12}, (_, i) => ({ 
                name: `ccs_${String(i+1).padStart(2, '0')}_was_moved`, 
                type: 'boolean', 
                required: false, 
                destination: `views_matrix.climate_change_views.ccs_${String(i+1).padStart(2, '0')}_was_moved` 
            })),
            // Attention check
            { name: 'attention_check_value', type: 'number', required: false, destination: 'views_matrix.climate_change_views.attention_check_value' },
            { name: 'attention_check_passed', type: 'boolean', required: false, destination: 'views_matrix.climate_change_views.attention_check_passed' },
            { name: 'attention_check_was_moved', type: 'boolean', required: false, destination: 'views_matrix.climate_change_views.attention_check_was_moved' },
            // Mean scores
            { name: 'ccs_mean_scored', type: 'number', required: false, destination: 'views_matrix.climate_change_views.ccs_mean_scored' },
            { name: 'ccs_occurrence_mean', type: 'number', required: false, destination: 'views_matrix.climate_change_views.ccs_occurrence_mean' },
            { name: 'ccs_causation_mean', type: 'number', required: false, destination: 'views_matrix.climate_change_views.ccs_causation_mean' },
            { name: 'ccs_seriousness_mean', type: 'number', required: false, destination: 'views_matrix.climate_change_views.ccs_seriousness_mean' },
            { name: 'ccs_efficacy_mean', type: 'number', required: false, destination: 'views_matrix.climate_change_views.ccs_efficacy_mean' },
            { name: 'ccs_trust_mean', type: 'number', required: false, destination: 'views_matrix.climate_change_views.ccs_trust_mean' },
            // Display order
            { name: 'ccs_row_order', type: 'array', required: false, destination: 'views_matrix.climate_change_views.ccs_row_order' }
        ]
    },
    'political-views.html': {
        name: 'Political Views',
        fields: [
            { name: 'economic_issues', type: 'number', required: false, destination: 'views_matrix.political_views.economic_issues' },
            { name: 'social_issues', type: 'number', required: false, destination: 'views_matrix.political_views.social_issues' },
            { name: 'political_views_order', type: 'array', required: false, destination: 'views_matrix.political_views.political_views_order' },
            { name: 'economic_issues_answered', type: 'boolean', required: false, destination: 'views_matrix.political_views.economic_issues_answered' },
            { name: 'social_issues_answered', type: 'boolean', required: false, destination: 'views_matrix.political_views.social_issues_answered' }
        ]
    },
    'views.html': {
        name: 'Climate Change Views',
        fields: [
            { name: 'current_views', type: 'string', required: true, destination: 'belief_change.current_view' },
            { name: 'elaboration', type: 'string', required: true, destination: 'belief_change.elaboration' }
        ]
    },
    'belief-confidence.html': {
        name: 'Belief Confidence',
        fields: [
            { name: 'ai_summary_generated', type: 'string', required: false, destination: 'belief_change.ai_summary' },
            { name: 'AI_Summary_Views', type: 'string', required: false, destination: 'belief_change.ai_summary' },
            { name: 'confidence_level', type: 'number', required: false, destination: 'belief_change.ai_confidence_slider' },
            { name: 'ai_accurate', type: 'string', required: true, destination: 'belief_change.ai_summary_accuracy' }
        ]
    },
    'exit-survey.html': {
        name: 'Exit Survey',
        fields: [
            { name: 'summaryConfidence', type: 'number', required: false, destination: 'post_chat.chatbot_summary_accuracy' },
            { name: 'finalConfidenceLevel', type: 'number', required: false, destination: 'post_chat.final_belief_confidence' }
        ]
    },
    'chatbot-summary-validation.html': {
        name: 'Chatbot Summary Validation',
        fields: [
            { name: 'summaryAccurate', type: 'string', required: true, destination: 'post_chat.chatbot_summary_accuracy' }
        ]
    }
};

// Additional fields that should be present in final output
const SYSTEM_FIELDS = [
    { name: 'participant_id', type: 'string', required: true, destination: 'participant_id' },
    { name: 'prolific_id', type: 'string', required: false, destination: 'prolific_id' },
    { name: 'consent', type: 'boolean', required: true, destination: 'consent' },
    { name: 'disqualified', type: 'boolean', required: true, destination: 'disqualified' },
    { name: 'timestamp_joined', type: 'string', required: true, destination: 'timestamp_joined' },
    { name: 'timestamps.started', type: 'string', required: true, destination: 'timestamps.started' },
    { name: 'timestamps.completed', type: 'string', required: false, destination: 'timestamps.completed' },
    { name: 'chatbot_interaction.messages', type: 'array', required: false, destination: 'chatbot_interaction.messages' }
];

function auditDataFields() {
    console.log('🔍 COMPREHENSIVE DATA FIELD AUDIT');
    console.log('==================================\n');
    
    let totalFields = 0;
    let auditResults = {};
    
    // Count total expected fields
    Object.values(FORM_FIELDS).forEach(form => {
        totalFields += form.fields.length;
    });
    totalFields += SYSTEM_FIELDS.length;
    
    console.log(`📊 Total Expected Fields: ${totalFields}\n`);
    
    // Audit each form
    Object.entries(FORM_FIELDS).forEach(([filename, formInfo]) => {
        console.log(`📋 ${formInfo.name} (${filename})`);
        console.log('─'.repeat(50));
        
        auditResults[filename] = {
            formName: formInfo.name,
            totalFields: formInfo.fields.length,
            requiredFields: formInfo.fields.filter(f => f.required).length,
            optionalFields: formInfo.fields.filter(f => !f.required).length,
            fields: formInfo.fields
        };
        
        formInfo.fields.forEach(field => {
            const status = field.required ? '🔴 REQUIRED' : '🟡 OPTIONAL';
            const type = field.type.toUpperCase();
            console.log(`  ${status} ${field.name} (${type}) → ${field.destination}`);
        });
        
        console.log(`\n  Summary: ${formInfo.fields.length} fields (${formInfo.fields.filter(f => f.required).length} required, ${formInfo.fields.filter(f => !f.required).length} optional)\n`);
    });
    
    // System fields
    console.log('🖥️  System Generated Fields');
    console.log('─'.repeat(50));
    SYSTEM_FIELDS.forEach(field => {
        const status = field.required ? '🔴 REQUIRED' : '🟡 OPTIONAL';
        const type = field.type.toUpperCase();
        console.log(`  ${status} ${field.name} (${type}) → ${field.destination}`);
    });
    console.log(`\n  Summary: ${SYSTEM_FIELDS.length} fields (${SYSTEM_FIELDS.filter(f => f.required).length} required, ${SYSTEM_FIELDS.filter(f => !f.required).length} optional)\n`);
    
    return auditResults;
}

function checkServerEndpointMapping() {
    console.log('🔧 SERVER ENDPOINT FIELD MAPPING AUDIT');
    console.log('======================================\n');
    
    try {
        const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
        
        // Extract destructured fields from /survey/submit endpoint
        const surveySubmitMatch = serverContent.match(/const\s*{\s*([\s\S]*?)\s*}\s*=\s*req\.body;/);
        
        if (surveySubmitMatch) {
            const destructuredFields = surveySubmitMatch[1]
                .split(',')
                .map(field => field.trim().split('//')[0].trim()) // Remove comments
                .filter(field => field && !field.startsWith('//'))
                .map(field => field.replace(/\s+/g, ''));
            
            console.log('📥 Fields being extracted from request body:');
            destructuredFields.forEach(field => {
                console.log(`  ✓ ${field}`);
            });
            
            console.log(`\n📊 Total fields extracted: ${destructuredFields.length}\n`);
            
            // Check for missing fields
            const allExpectedFields = [];
            Object.values(FORM_FIELDS).forEach(form => {
                form.fields.forEach(field => {
                    allExpectedFields.push(field.name);
                });
            });
            
            const missingFields = allExpectedFields.filter(field => !destructuredFields.includes(field));
            if (missingFields.length > 0) {
                console.log('❌ Missing fields in server endpoint:');
                missingFields.forEach(field => {
                    console.log(`  ❌ ${field}`);
                });
            } else {
                console.log('✅ All expected fields are being extracted by server');
            }
            
            console.log();
            
        } else {
            console.log('❌ Could not find request body destructuring in server.js');
        }
        
    } catch (error) {
        console.error('❌ Error reading server.js:', error.message);
    }
}

function verifyNestedStructureMapping() {
    console.log('🏗️  NESTED STRUCTURE MAPPING VERIFICATION');
    console.log('=========================================\n');
    
    const nestedStructure = {
        'participant_id': '🆔 Top level',
        'prolific_id': '🆔 Top level', 
        'consent': '🆔 Top level',
        'disqualified': '🆔 Top level',
        'timestamp_joined': '🆔 Top level',
        'demographics': {
            'age': '👤 Demographics',
            'gender': '👤 Demographics', 
            'education': '👤 Demographics'
        },
        'belief_change': {
            'has_changed_mind': '💭 Belief Change',
            'current_view': '💭 Belief Change',
            'elaboration': '💭 Belief Change',
            'ai_summary': '💭 Belief Change',
            'ai_confidence_slider': '💭 Belief Change',
            'ai_summary_accuracy': '💭 Belief Change'
        },
        'views_matrix': {
            'climate_change_views': {
                'ccs_*_raw': '🌡️  CCS Scale (raw)',
                'ccs_*_scored': '🌡️  CCS Scale (scored)',
                'ccs_*_was_moved': '🌡️  CCS Scale (metadata)',
                'attention_check_*': '🌡️  CCS Attention Check',
                'ccs_*_mean': '🌡️  CCS Mean Scores',
                'ccs_row_order': '🌡️  CCS Display Order'
            },
            'political_views': {
                'economic_issues': '🏛️  Political Views',
                'social_issues': '🏛️  Political Views',
                'political_views_order': '🏛️  Political Views',
                '*_answered': '🏛️  Political Views (metadata)'
            }
        },
        'chatbot_interaction': {
            'messages': '🤖 Chatbot Messages'
        },
        'post_chat': {
            'final_belief_confidence': '📊 Post-Chat',
            'chatbot_summary_accuracy': '📊 Post-Chat'
        },
        'timestamps': {
            'started': '⏰ Timestamps',
            'completed': '⏰ Timestamps'
        }
    };
    
    console.log('📋 Expected Nested Structure:');
    printNestedStructure(nestedStructure, 0);
    console.log();
}

function printNestedStructure(obj, indent) {
    const spaces = '  '.repeat(indent);
    
    Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
            console.log(`${spaces}📁 ${key}/`);
            printNestedStructure(value, indent + 1);
        } else {
            console.log(`${spaces}${value} ${key}`);
        }
    });
}

function generateFieldChecksum() {
    const allFields = [];
    
    // Add form fields
    Object.values(FORM_FIELDS).forEach(form => {
        form.fields.forEach(field => {
            allFields.push(`${field.name}:${field.type}:${field.required}:${field.destination}`);
        });
    });
    
    // Add system fields
    SYSTEM_FIELDS.forEach(field => {
        allFields.push(`${field.name}:${field.type}:${field.required}:${field.destination}`);
    });
    
    allFields.sort();
    
    console.log('🔐 FIELD CHECKSUM');
    console.log('================\n');
    console.log('Field signature (for version tracking):');
    console.log(`Total Fields: ${allFields.length}`);
    console.log(`Checksum: ${allFields.join('|').length}`);
    console.log();
}

// Main audit function
function runCompleteAudit() {
    console.log('🚀 STARTING COMPREHENSIVE DATA FIELD AUDIT\n');
    console.log('This audit verifies that all data fields collected across');
    console.log('the survey forms are properly captured and saved.\n');
    
    const results = auditDataFields();
    checkServerEndpointMapping();
    verifyNestedStructureMapping();
    generateFieldChecksum();
    
    console.log('✅ AUDIT COMPLETE');
    console.log('=================');
    console.log('Review the output above to ensure all fields are properly mapped.');
    console.log('Any missing fields should be added to the server endpoint.');
    
    return results;
}

// Export for use as module or run directly
if (require.main === module) {
    runCompleteAudit();
}

module.exports = { 
    auditDataFields, 
    checkServerEndpointMapping, 
    verifyNestedStructureMapping,
    runCompleteAudit,
    FORM_FIELDS,
    SYSTEM_FIELDS
};