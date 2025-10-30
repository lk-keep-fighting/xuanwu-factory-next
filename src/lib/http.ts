import axios from 'axios'

export const request = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
    timeout: 10000,
})

request.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
})

request.interceptors.response.use((response) => {
    return response
}, (error) => {
    return Promise.reject(error)
})

export default request