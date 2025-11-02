import axios from 'axios'
import useAuth from '../state/auth'

const api = axios.create({ baseURL: '/' })

api.interceptors.request.use((config) => {
    // Don't add token to login/register requests
    if (config.url?.includes('/api/auth/login') || config.url?.includes('/api/auth/register')) {
        return config
    }

    const { token } = useAuth.getState()
    if (token) {
        // ensure headers object exists and set Authorization; cast to any to avoid Axios header typing issues
        if (!config.headers) {
            (config as any).headers = {};
        }
        (config.headers as any)['Authorization'] = `Bearer ${token}`;
    }
    return config
})

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            useAuth.getState().logout()
        }
        return Promise.reject(err)
    }
)

export default api