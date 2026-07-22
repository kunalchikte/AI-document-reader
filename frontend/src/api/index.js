import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (email, password, name) =>
    apiClient.post('/auth/register', { email, password, name }),
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }),
  me: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
};

export const documentApi = {
  getDocuments: () => apiClient.get('/documents'),
  getDocumentById: (documentId) => apiClient.get(`/documents/${documentId}`),
  getMessages: (documentId) => apiClient.get(`/documents/${documentId}/messages`),
  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  processDocument: (documentId) => apiClient.post(`/documents/${documentId}/process`),
  deleteDocument: (documentId) => apiClient.delete(`/documents/${documentId}`),
  askQuestion: (documentId, question, topK = 5) =>
    apiClient.post(`/documents/${documentId}/ask`, { question, topK }),
};

export const systemApi = {
  initialize: () => apiClient.post('/system/initialize'),
  getStatus: () => apiClient.get('/system/status'),
  checkOllamaStatus: (apiUrl) => {
    const params = apiUrl ? { api_url: apiUrl } : {};
    return apiClient.get('/system/ollama/status', { params });
  },
  setupOllamaModels: (models, apiUrl) => {
    const data = { models, ...(apiUrl && { api_url: apiUrl }) };
    return apiClient.post('/system/ollama/setup', data);
  },
  setupOllamaModel: (modelName, apiUrl) => {
    const data = { model_name: modelName, ...(apiUrl && { api_url: apiUrl }) };
    return apiClient.post('/system/ollama/model', data);
  },
  checkPostgreSQLStatus: () => apiClient.get('/system/postgresql/status'),
  setupPostgreSQL: () => apiClient.post('/system/postgresql/setup'),
};
