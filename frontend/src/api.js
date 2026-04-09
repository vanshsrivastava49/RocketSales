import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE,
})

// ── Attach JWT automatically ──
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('priceiq_token')
  const token = raw && raw !== 'null' && raw !== 'undefined' && raw !== '' ? raw : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auto logout on 401 / 403 ──
// FastAPI's HTTPBearer returns 403 when a token is present but invalid,
// and 401 when no credentials are sent at all.
// We only auto-logout on protected routes — auth routes can legitimately
// return these codes for wrong passwords, unverified email, etc.
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
      // ✅ FIXED: was removing 'token' (wrong key) — must match TOKEN_KEY in
      // AuthContext.jsx which is 'priceiq_token'. Using the wrong key meant
      // the stored JWT was never cleared, causing an infinite redirect loop
      // where every page load re-attached the expired token, got a 403 again,
      // and redirected again without ever actually logging the user out.
      localStorage.removeItem('priceiq_token')
      window.location.href = '/'
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

  verifyEmail: (token) =>
    api.post('/auth/verify-email', { token }).then(res => res.data),

  resendVerification: () =>
    api.post('/auth/resend-verification').then(res => res.data),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }).then(res => res.data),

  resetPassword: (token, new_password) =>
    api.post('/auth/reset-password', { token, new_password }).then(res => res.data),
}

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

// ✅ FIXED: anchor element must be appended to document.body before .click()
// and removed afterward. In some browsers (Firefox, Safari) a detached <a>
// element — one that was created but never added to the DOM — will silently
// ignore the programmatic click, so the download never starts. The element
// also needs to be removed after the click to avoid leaking DOM nodes on
// repeated exports.
export const exportProducts = async () => {
  let res
  try {
    res = await api.get('/my/products/export', {
      responseType: 'blob',
    })
  } catch (err) {
    if (err?.response?.status !== 404) throw err
    res = await api.get('/api/my/products/export', {
      responseType: 'blob',
    })
  }

  const url      = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
  const filename = res.headers['content-disposition']
    ?.match(/filename=(.+)/)?.[1]
    ?? 'priceiq_export.csv'

  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)   // ✅ must be in DOM before click
  a.click()
  document.body.removeChild(a)   // ✅ clean up immediately after
  URL.revokeObjectURL(url)
}

export default api