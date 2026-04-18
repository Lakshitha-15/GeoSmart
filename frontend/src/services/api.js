// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Unknown error';
    return Promise.reject(new Error(message));
  }
);

export const analyzeLocation  = (payload) => api.post('/analyze', payload);
export const getBusinessTypes = ()         => api.get('/business-types');
export const getBusinesses    = (params)   => api.get('/businesses', { params });
export const createBusiness   = (data)     => api.post('/businesses', data);
export const updateBusiness   = (id, data) => api.put(`/businesses/${id}`, data);
export const deleteBusiness   = (id)       => api.delete(`/businesses/${id}`);
export const getZones         = ()         => api.get('/zones');
export const getTopRanked     = (params)   => api.get('/analysis/top-10', { params });
export const getLowCompetition= (params)   => api.get('/analysis/low-competition', { params });
export const getUnderserved   = (params)   => api.get('/analysis/underserved', { params });
export const compareTwoLocations = (data)  => api.post('/analysis/compare', data);

export default api;
