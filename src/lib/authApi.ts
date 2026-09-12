import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const authAPI = {
    // 1. Sign Up
    signUp: (data: {
        full_name: string;
        email: string;
        password: string;
        role?: string;
    }) => api.post('/auth/signup', data),

    // 2. Sign In
    signIn: (data: { email: string; password: string }) => 
        api.post('/auth/signin', data),

    // 3. Forgot Password
    forgotPassword: (email: string) => 
        api.post('/auth/forgot-password', { email }),

    // 4. Reset Password
    resetPassword: (token: string, new_password: string) => 
        api.post('/auth/reset-password', { token, new_password }),

    // 5. Get Current User
    getMe: () => api.get('/auth/me'),

    // 6. Logout
    logout: () => api.post('/auth/logout'),
};

export default api;