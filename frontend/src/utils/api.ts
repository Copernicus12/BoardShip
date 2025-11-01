import axios from 'axios'
import useAuth from '../state/auth'

const api = axios.create({ baseURL: '/' })

api.interceptors.request.use((config) => {
    const { token } = useAuth.getState()
    if (token) {
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${token}`
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
