/**
 * Script to check which models are available in the Ollama server
 * Run with: node check-ollama-models.js
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function main() {
  const ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
  
  console.log(`Checking Ollama server at: ${ollamaApiUrl}`);
  
  try {
    // Check server status
    console.log('\nChecking server status...');
    await axios.get(`${ollamaApiUrl}`).then(() => {
      console.log('✅ Ollama server is running');
    }).catch(error => {
      throw new Error(`Ollama server is not accessible: ${error.message}`);
    });
    
    // List available models
    console.log('\nListing available models...');
    const response = await axios.get(`${ollamaApiUrl}/api/tags`);
    
    if (response.data && response.data.models) {
      console.log('\nAvailable models:');
      response.data.models.forEach(model => {
        console.log(`- ${model.name}`);
      });
    } else {
      console.log('No models available or unexpected response format');
      console.log('Raw response:', response.data);
    }
    
    // Check if the API supports embeddings
    console.log('\nChecking embeddings API...');
    try {
      // Try a simple embedding request with a common model
      await axios.post(`${ollamaApiUrl}/api/embeddings`, {
        model: 'llama2',
        prompt: 'Hello world'
      });
      console.log('✅ Embeddings API is available');
    } catch (error) {
      console.error('❌ Embeddings API error:', error.message);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      // Try the alternate endpoint format
      try {
        console.log('\nTrying alternate embeddings endpoint...');
        await axios.post(`${ollamaApiUrl}/api/embed`, {
          model: 'llama2',
          prompt: 'Hello world'
        });
        console.log('✅ Alternate embeddings API (/api/embed) is available');
      } catch (embedError) {
        console.error('❌ Alternate embeddings API error:', embedError.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error); 