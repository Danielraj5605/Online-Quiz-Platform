import axios from 'axios';
import { logger } from '../utils/logger';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000, // 10 second request timeout
});

// Request interceptor - log outgoing requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Log request
  logger.api.request(
    config.method?.toUpperCase() || 'UNKNOWN',
    config.url || '',
    config.data
  );

  return config;
}, (error) => {
  logger.error('Request error:', error);
  return Promise.reject(error);
});

// Response interceptor - log responses
api.interceptors.response.use(
  (response) => {
    // Log successful response
    logger.api.response(
      response.config.method?.toUpperCase() || 'UNKNOWN',
      response.config.url || '',
      response.status,
      response.data
    );
    return response;
  },
  (error) => {
    // Log error response
    if (error.response) {
      logger.api.response(
        error.config?.method?.toUpperCase() || 'UNKNOWN',
        error.config?.url || '',
        error.response.status,
        error.response.data
      );
    } else if (error.request) {
      logger.api.error(
        error.config?.method?.toUpperCase() || 'UNKNOWN',
        error.config?.url || '',
        'No response received from server'
      );
    } else {
      logger.error('Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
