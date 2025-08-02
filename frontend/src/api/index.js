import axios from 'axios';

// Create an axios instance
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor for authentication
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Document APIs
export const documentApi = {
  // Get all documents
  getDocuments: () => {
    return apiClient.get('/documents');
  },
  
  // Get document by ID
  getDocumentById: (documentId) => {
    return apiClient.get(`/documents/${documentId}`);
  },
  
  // Upload a new document
  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiClient.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Process a document for Q&A
  processDocument: (documentId) => {
    return apiClient.post(`/documents/${documentId}/process`);
  },
  
  // Delete a document
  deleteDocument: (documentId) => {
    return apiClient.delete(`/documents/${documentId}`);
  },
  
  // Ask a question about a document
  askQuestion: (documentId, question, topK = 5) => {
    return apiClient.post(`/documents/${documentId}/ask`, {
      question,
      topK,
    });
  },
};

// System APIs
export const systemApi = {
  // Initialize the application
  initialize: () => {
    return apiClient.post('/system/initialize');
  },
  
  // Get system status
  getStatus: () => {
    return apiClient.get('/system/status');
  },
  
  // Check Ollama status
  checkOllamaStatus: (apiUrl) => {
    const params = apiUrl ? { api_url: apiUrl } : {};
    return apiClient.get('/system/ollama/status', { params });
  },
  
  // Installation is now handled within the status check API
  
  // Setup Ollama models
  setupOllamaModels: (models, apiUrl) => {
    const data = {
      models,
      ...(apiUrl && { api_url: apiUrl }),
    };
    
    return apiClient.post('/system/ollama/setup', data);
  },
  
  // Setup a specific Ollama model
  setupOllamaModel: (modelName, apiUrl) => {
    const data = {
      model_name: modelName,
      ...(apiUrl && { api_url: apiUrl }),
    };
    
    return apiClient.post('/system/ollama/model', data);
  },
  
  // Check Supabase status
  checkSupabaseStatus: () => {
    return apiClient.get('/system/supabase/status');
  },
  
  // Setup Supabase for vector storage
  setupSupabase: () => {
    return apiClient.post('/system/supabase/setup');
  },
}; 