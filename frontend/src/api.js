import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
})

// ── Attach JWT automatically ──
api.interceptors.request.use((config) => {
  const raw   = localStorage.getItem('priceiq_token')
  const token = raw && raw !== 'null' && raw !== 'undefined' && raw !== '' ? raw : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auto logout on 401 / 403 ──
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
]

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const url    = err.config?.url ?? ''
    const isAuthRoute = AUTH_ROUTES.some(r => url.includes(r))

    if (!isAuthRoute && (status === 401 || status === 403)) {
      localStorage.removeItem('priceiq_token')
      window.location.replace('/')
    }
    return Promise.reject(err)
  }
)

// ── AUTH ──
export const authAPI = {
  signup: (data) =>
    api.post('/auth/signup', data).then(res => res.data),

  login: (email, password) =>
    api.post('/auth/login', { email, password }).then(res => res.data),

  me: () =>
    api.get('/auth/me').then(res => res.data),

  updateProfile: (data) =>
    api.patch('/auth/profile', data).then(res => res.data),

  // ✅ FIX: Updated to accept email and otp
  verifyEmail: (email, otp) =>
    api.post('/auth/verify-email', { email, otp }).then(res => res.data),

  resendVerification: () =>
    api.post('/auth/resend-verification').then(res => res.data),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }).then(res => res.data),

  // ✅ FIX: Updated to accept email, otp, and new_password
  resetPassword: (email, otp, new_password) =>
    api.post('/auth/reset-password', { email, otp, new_password }).then(res => res.data),
}

// ── ALERTS ──
export const fetchAlerts = (limit = 20) =>
  api.get('/alerts/history', { params: { limit } }).then(r => r.data)

// ── PRICING ──
export const fetchHealth   = () => api.get('/health').then(r => r.data)
export const fetchStats    = () => api.get('/stats').then(r => r.data)
export const predictSingle = (payload) => api.post('/predict', payload).then(r => r.data)

export const predictBulk = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/predict/bulk', fd).then(r => r.data)
}

// ── USER ──
export const fetchMyProducts = (limit = 20) =>
  api.get('/my/products', { params: { limit } }).then(r => r.data)

export const fetchMyStats = () =>
  api.get('/my/stats').then(r => r.data)

export const fetchMyTrends = (days = 30) =>
  api.get('/my/trends', { params: { days } }).then(r => r.data)

export const exportProducts = async () => {
  const res = await api.get('/my/products/export', { responseType: 'blob' })

  const disposition = res.headers['content-disposition'] ?? ''
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ??   
    disposition.match(/filename=([^;]+)/)?.[1]?.trim() ?? 
    'priceiq_export.csv'

  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default api