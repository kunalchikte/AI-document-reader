#!/usr/bin/env node

/**
 * Debug script for Q&A functionality
 * This script helps diagnose issues with document Q&A
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function debugQA() {
    console.log('🔍 Starting Q&A Debug Process...\n');
    
    try {
        // 1. Check PostgreSQL status
        console.log('1. Checking PostgreSQL status...');
        const pgStatus = await axios.get(`${BASE_URL}/api/system/postgresql/status`);
        console.log('✅ PostgreSQL Status:', pgStatus.data.data);
        console.log('');
        
        // 2. Debug PostgreSQL contents
        console.log('2. Debugging PostgreSQL contents...');
        const pgDebug = await axios.get(`${BASE_URL}/api/system/postgresql/debug`);
        console.log('✅ PostgreSQL Debug Info:');
        console.log(`   - Total documents: ${pgDebug.data.data.totalDocuments}`);
        console.log(`   - Document metadata:`, pgDebug.data.data.documentMetadata);
        console.log('');
        
        // 3. Check documents list
        console.log('3. Checking documents list...');
        const documents = await axios.get(`${BASE_URL}/api/documents`);
        console.log('✅ Documents:', documents.data.data.map(doc => ({
            id: doc._id,
            name: doc.originalName,
            vectorized: doc.vectorized
        })));
        console.log('');
        
        // 4. Test Q&A with the specific document ID
        const documentId = '68d0240ab6541e93dabb10d4';
        console.log(`4. Testing Q&A with document: ${documentId}`);
        
        const qaResponse = await axios.post(`${BASE_URL}/documents/${documentId}/ask`, {
            question: 'what is this ?',
            topK: 5
        });
        
        console.log('✅ Q&A Response:', qaResponse.data);
        console.log('');
        
        // 5. Check if document exists and is vectorized
        const document = documents.data.data.find(doc => doc._id === documentId);
        if (document) {
            console.log('5. Document Analysis:');
            console.log(`   - Document found: ${document.originalName}`);
            console.log(`   - Vectorized: ${document.vectorized}`);
            
            if (!document.vectorized) {
                console.log('❌ ISSUE FOUND: Document is not vectorized!');
                console.log('   Solution: Process the document first using the /process endpoint');
            } else {
                console.log('✅ Document appears to be properly vectorized');
            }
        } else {
            console.log('❌ ISSUE FOUND: Document not found in documents list!');
        }
        
    } catch (error) {
        console.error('❌ Error during debug:', error.response?.data || error.message);
    }
}

// Run the debug script
debugQA().catch(console.error);
