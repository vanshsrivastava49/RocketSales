import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import styles from './AuthPage.module.css'

const CATEGORIES = [
  'Electronics', 'Home&Kitchen', 'Computers&Accessories',
  'Health&PersonalCare', 'Toys&Games', 'Car&Motorbike',
  'HomeImprovement', 'OfficeProducts', 'MusicalInstruments', 'Other',
]

// Stats shown on the left decorative panel.
// Each entry now has an explicit `icon` field so the pill renderer
// never receives `undefined` (was a silent bug — s.icon was always undefined
// because the array objects had no such key).
const HERO_STATS = [
  { val: '12,400+', desc: 'Active sellers',           icon: '🏪' },
  { val: '₹2.8Cr+', desc: 'Revenue optimised today', icon: '💰' },
  { val: '97%',      desc: 'Prediction accuracy',     icon: '🎯' },
]

// Proper RFC-5322-lite email check — the previous `includes('@')` accepted
// strings like "@" or "a@" which the backend would reject, giving a confusing
// 422 from the server rather than a clear inline error.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function AuthPage() {
  const { login, signup } = useAuth()
  const [mode, setMode]       = useState('login')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const [errors, setErrors]   = useState({})

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '',
    store_name: '', category: '', phone: '',
  })

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setErrors(er => ({ ...er, [k]: undefined }))
  }

  const pwStrength = (() => {
    const p = form.password
    if (!p) return 0
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  })()

  // Strength colours map index 0–3 (weak → strong).
  const strengthColors = ['#ff6b6b', '#f5c842', '#7c5cfc', '#00e5b4']

  const validate = () => {
    const e = {}
    if (!isValidEmail(form.email)) e.email = 'Enter a valid email address'
    if (form.password.length < 6)  e.password = 'Min 6 characters'
    if (mode === 'signup') {
      if (!form.first_name.trim()) e.first_name = 'Required'
      if (!form.store_name.trim()) e.store_name = 'Required'
    }
    return e
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
        toast.success('Welcome back! 🎉')
      } else {
        await signup({
          first_name: form.first_name,
          last_name:  form.last_name,
          email:      form.email,
          password:   form.password,
          store_name: form.store_name,
          category:   form.category,
          phone:      form.phone,
        })
        toast.success("Account created! Let's get started 🚀")
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      // Backend may return `detail` as a string or as a structured object
      // (e.g. the column-validation errors from the bulk endpoint).
      const msg = typeof detail === 'string'
        ? detail
        : (detail?.message ?? 'Something went wrong')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Allow submitting the form with Enter so keyboard-only users aren't forced
  // to reach for the mouse. Previously there was no keydown handler at all.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleSubmit()
  }

  const switchMode = (m) => {
    setMode(m)
    setErrors({})
    setForm(f => ({ ...f, password: '' }))
  }

  return (
    <div className={styles.root}>
      {/* Left decorative panel */}
      <div className={styles.panel}>
        <div className={styles.panelGrid} />
        <div className={styles.glow1} />
        <div className={styles.glow2} />

        <div className={styles.logo}>
          Rocket<span>Sales</span>
          <sup>AI ENGINE v2</sup>
        </div>

        <div className={styles.hero}>
          <h1 className={styles.headline}>
            Smarter pricing.<br />
            <em>More revenue.</em>
          </h1>
          <p className={styles.heroSub}>
            Join thousands of e-commerce sellers using AI-powered pricing
            to beat competitors and maximise margins on every SKU.
          </p>
        </div>

        <div className={styles.pills}>
          {HERO_STATS.map(s => (
            <div className={styles.pill} key={s.val}>
              {/* icon is now always defined — previously `s.icon` was undefined */}
              <span className={styles.pillIcon}>{s.icon}</span>
              <div>
                <div className={styles.pillVal}>{s.val}</div>
                <div className={styles.pillDesc}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className={styles.formSide}>
        {/* onKeyDown on the container so it captures Enter from any field */}
        <div className={styles.formBox} onKeyDown={handleKeyDown}>
          {/* Tab toggle */}
          <div className={styles.toggle}>
            <button
              className={mode === 'login' ? styles.toggleActive : ''}
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>
            <button
              className={mode === 'signup' ? styles.toggleActive : ''}
              onClick={() => switchMode('signup')}
            >
              Create Account
            </button>
          </div>

          <h2 className={styles.formTitle}>
            {mode === 'login' ? 'Welcome back' : 'Start selling smarter'}
          </h2>
          <p className={styles.formSub}>
            {mode === 'login'
              ? 'Sign in to your seller dashboard'
              : 'Create your free seller account in 30 seconds'}
          </p>

          {mode === 'signup' && (
            <div className={styles.row}>
              <Field label="First Name" error={errors.first_name}>
                <InputWrap icon="👤">
                  <input value={form.first_name} onChange={set('first_name')} placeholder="Vansh" />
                </InputWrap>
              </Field>
              <Field label="Last Name">
                <InputWrap icon="👤">
                  <input value={form.last_name} onChange={set('last_name')} placeholder="Srivastava" />
                </InputWrap>
              </Field>
            </div>
          )}

          <Field label="Email Address" error={errors.email}>
            <InputWrap>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="vansh@mystore.in"
              />
            </InputWrap>
          </Field>

          {mode === 'signup' && (
            <>
              <Field label="Store / Business Name" error={errors.store_name}>
                <InputWrap>
                  <input
                    value={form.store_name}
                    onChange={set('store_name')}
                    placeholder="RocketSales"
                  />
                </InputWrap>
              </Field>
              <div className={styles.row}>
                <Field label="Category">
                  <InputWrap>
                    <select value={form.category} onChange={set('category')}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </InputWrap>
                </Field>
                <Field label="Phone (optional)">
                  <InputWrap>
                    <input
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="+91 98765..."
                    />
                  </InputWrap>
                </Field>
              </div>
            </>
          )}

          <Field label="Password" error={errors.password}>
            <InputWrap onEye={() => setShowPw(p => !p)} showEye eyeOpen={showPw}>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Min 6 characters"
                style={{ paddingRight: 44 }}
              />
            </InputWrap>
            {mode === 'signup' && form.password && (
              <div className={styles.strengthBar}>
                <div
                  className={styles.strengthFill}
                  style={{
                    width: `${pwStrength * 25}%`,
                    // pwStrength is 1-4; index into array with pwStrength-1
                    background: strengthColors[pwStrength - 1] || 'transparent',
                  }}
                />
              </div>
            )}
          </Field>

          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <><span className={styles.spinner} /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
              : mode === 'login' ? 'Sign In →' : 'Create Seller Account →'
            }
          </button>

          <p className={styles.terms}>
            {mode === 'signup' ? (
              <>By signing up you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a></>
            ) : (
              <>Don't have an account?{' '}
                <button onClick={() => switchMode('signup')}>Sign up free</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Field({ label, error, children }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
      {error && <span className={styles.errMsg}>{error}</span>}
    </div>
  )
}

/**
 * InputWrap
 *
 * Previously rendered <span className={styles.inputIcon}>{icon}</span>
 * unconditionally, which placed an empty <span> in the DOM whenever `icon`
 * was undefined (e.g. the email and store-name fields). That empty span
 * occupied padding space and shifted input text. Now the icon span is only
 * rendered when an icon is actually provided.
 */
function InputWrap({ icon, children, showEye, onEye, eyeOpen }) {
  return (
    <div className={styles.inputWrap}>
      {icon && <span className={styles.inputIcon}>{icon}</span>}
      {children}
      {showEye && (
        <button type="button" className={styles.eyeBtn} onClick={onEye}>
          {eyeOpen ? '🙈' : '👁️'}
        </button>
      )}
    </div>
  )
}