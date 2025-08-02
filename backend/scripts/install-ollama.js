#!/usr/bin/env node

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { platform } = process;

console.log('Checking Ollama installation...');

/**
 * Check if Ollama is installed and running
 */
async function checkOllamaInstallation() {
  try {
    // Try to reach Ollama server
    const result = await new Promise((resolve, reject) => {
      const req = http.get('http://comprehensive-saidee-circuit-bridge-6d8bc5df.koyeb.app/api/version', { timeout: 3000 }, (res) => {
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const version = JSON.parse(data).version;
              resolve({ installed: true, version });
            } catch (err) {
              resolve({ installed: true, version: 'unknown' });
            }
          });
        } else {
          resolve({ installed: false });
        }
      });
      
      req.on('error', () => {
        resolve({ installed: false });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ installed: false });
      });
    });

    return result;
  } catch (error) {
    return { installed: false };
  }
}

/**
 * Check if a model exists in Ollama
 */
async function checkModelExists(modelName) {
  try {
    const result = await new Promise((resolve) => {
      const req = http.get(`http://comprehensive-saidee-circuit-bridge-6d8bc5df.koyeb.app/api/tags`, { timeout: 5000 }, (res) => {
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const models = JSON.parse(data).models;
              const exists = models.some(model => model.name === modelName);
              resolve(exists);
            } catch (err) {
              resolve(false);
            }
          });
        } else {
          resolve(false);
        }
      });
      
      req.on('error', () => {
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });

    return result;
  } catch (error) {
    return false;
  }
}

/**
 * Install Ollama based on platform
 */
function installOllama() {
  console.log('Installing/Updating Ollama...');
  
  try {
    if (platform === 'win32') {
      console.log('Windows detected. Please download and install the latest version of Ollama:');
      console.log('1. Visit: https://ollama.com/download/windows');
      console.log('2. Download the installer');
      console.log('3. Follow the installation instructions');
      console.log('4. If you already have Ollama installed, please uninstall it first and then install the new version');
      console.log('\nAfter installation, run the Ollama application and try again.');
    } 
    else if (platform === 'darwin') {
      console.log('macOS detected. Please download and install the latest version of Ollama:');
      console.log('1. Visit: https://ollama.com/download/mac');
      console.log('2. Download the installer');
      console.log('3. Follow the installation instructions');
      console.log('\nAfter installation, run the Ollama application and try again.');
    } 
    else if (platform === 'linux') {
      console.log('Installing/Updating Ollama for Linux...');
      console.log('Stopping any running Ollama service...');
      try {
        execSync('systemctl --user stop ollama.service || true', { stdio: 'inherit' });
      } catch (err) {
        // Ignore errors here, as the service might not exist
      }
      
      console.log('Installing the latest version...');
      execSync('curl -fsSL https://ollama.com/install.sh | sh', { stdio: 'inherit' });
      
      console.log('Starting Ollama service...');
      execSync('systemctl --user start ollama.service || true', { stdio: 'inherit' });
      
      console.log('Ollama installed successfully!');
    } 
    else {
      console.error('Unsupported platform:', platform);
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to install/update Ollama:', error.message);
    process.exit(1);
  }
}

/**
 * Pull a model using Ollama API
 */
async function pullModelViaAPI(modelName) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ name: modelName });
    
    const options = {
      hostname: 'comprehensive-saidee-circuit-bridge-6d8bc5df.koyeb.app',
      path: '/api/pull',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    console.log(`Pulling model '${modelName}' via API...`);
    
    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`API returned status code: ${res.statusCode}`));
      }
      
      res.on('data', () => {
        // Progress data, we can ignore it
      });
      
      res.on('end', () => {
        console.log(`Model '${modelName}' pull request completed`);
        resolve();
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Pull required models for the application
 */
async function pullRequiredModels() {
  const requiredModels = ['llama2'];
  let failedModels = [];
  
  console.log('Checking and pulling required models...');
  
  for (const model of requiredModels) {
    try {
      const modelExists = await checkModelExists(model);
      
      if (modelExists) {
        console.log(`Model '${model}' is already installed.`);
      } else {
        try {
          await pullModelViaAPI(model);
          console.log(`Model '${model}' pulled successfully!`);
        } catch (error) {
          console.error(`Failed to pull model '${model}' via API:`, error.message);
          failedModels.push(model);
        }
      }
    } catch (error) {
      console.error(`Error checking if model '${model}' exists:`, error.message);
      failedModels.push(model);
    }
  }
  
  if (failedModels.length > 0) {
    console.error(`Failed to pull the following models: ${failedModels.join(', ')}`);
    console.error('Please check your internet connection and try again.');
    process.exit(1);
  }
}

/**
 * Check if Ollama needs to be updated
 */
function checkForOllamaUpdate(currentVersion) {
  // Simple version check - we need at least version 0.1.14 for best compatibility
  // We can enhance this in the future
  if (!currentVersion || currentVersion === 'unknown') return true;
  
  // Parse version string (e.g., "0.1.14" -> [0, 1, 14])
  const versionParts = currentVersion.split('.').map(Number);
  const minVersionParts = [0, 1, 14]; // Minimum recommended version
  
  // Compare versions
  for (let i = 0; i < 3; i++) {
    const current = versionParts[i] || 0;
    const min = minVersionParts[i] || 0;
    
    if (current > min) return false; // Current version is newer
    if (current < min) return true;  // Current version is older
  }
  
  return false; // Versions are equal, no update needed
}

/**
 * Main function
 */
async function main() {
  const { installed, version } = await checkOllamaInstallation();
  
  if (installed) {
    console.log(`Ollama is installed (version: ${version})`);
    
    // Check if Ollama needs to be updated
    const needsUpdate = checkForOllamaUpdate(version);
    
    if (needsUpdate) {
      console.log('Your Ollama version is outdated. Updating Ollama...');
      installOllama();
      console.log('Please restart Ollama and run this script again to pull required models.');
    } else {
      console.log('Ollama version is up to date.');
      await pullRequiredModels();
      console.log('Setup completed successfully! You can now use the application with Ollama.');
    }
  } else {
    console.log('Ollama is not installed or not running.');
    installOllama();
    console.log('\nAfter installation completes, please start Ollama and run this script again to pull required models.');
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});