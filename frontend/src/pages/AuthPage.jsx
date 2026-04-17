import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { authAPI } from '../api' // ✅ FIX: Imported authAPI for password reset flows
import toast from 'react-hot-toast'
import styles from './AuthPage.module.css'

const CATEGORIES = [
  'Electronics', 'Home&Kitchen', 'Computers&Accessories',
  'Health&PersonalCare', 'Toys&Games', 'Car&Motorbike',
  'HomeImprovement', 'OfficeProducts', 'MusicalInstruments', 'Other',
]

const HERO_STATS = [
  { val: '12,400+', desc: 'Active sellers',          icon: '🏪' },
  { val: '₹2.8Cr+', desc: 'Revenue optimised today', icon: '💰' },
  { val: '97%',      desc: 'Prediction accuracy',     icon: '🎯' },
]

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function AuthPage() {
  const { login, signup } = useAuth()
  // ✅ FIX: Added 'forgot' and 'reset' modes
  const [mode, setMode]       = useState('login') 
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const [errors, setErrors]   = useState({})

  // ✅ FIX: Added 'otp' to the form state
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', otp: '',
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

  const strengthColors = ['#ff6b6b', '#f5c842', '#7c5cfc', '#00e5b4']

  const validate = () => {
    const e = {}
    if (!isValidEmail(form.email)) e.email = 'Enter a valid email address'
    
    if (mode === 'signup' || mode === 'reset') {
      if (form.password.length < 6)  e.password = 'Min 6 characters'
    }
    if (mode === 'reset' && form.otp.length !== 6) {
      e.otp = 'Must be 6 digits'
    }
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
      } else if (mode === 'signup') {
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
      } else if (mode === 'forgot') {
        // ✅ FIX: Handle Forgot Password Call
        await authAPI.forgotPassword(form.email)
        toast.success("If registered, a reset code was sent to your email")
        setMode('reset')
      } else if (mode === 'reset') {
        // ✅ FIX: Handle Reset Password Call
        await authAPI.resetPassword(form.email, form.otp, form.password)
        toast.success("Password reset successfully! Please sign in.")
        setMode('login')
        setForm(f => ({ ...f, password: '', otp: '' }))
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (detail?.message ?? 'Something went wrong')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleSubmit()
  }

  const switchMode = (m) => {
    setMode(m)
    setErrors({})
    setForm(f => ({ ...f, password: '', otp: '' }))
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
        <div className={styles.formBox} onKeyDown={handleKeyDown}>
          
          {/* Tab toggle */}
          <div className={styles.toggle}>
            <button
              className={mode !== 'signup' ? styles.toggleActive : ''}
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
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Start selling smarter' : mode === 'forgot' ? 'Reset password' : 'Enter reset code'}
          </h2>
          <p className={styles.formSub}>
            {mode === 'login' && 'Sign in to your seller dashboard'}
            {mode === 'signup' && 'Create your free seller account in 30 seconds'}
            {mode === 'forgot' && 'Enter your email to receive a 6-digit code'}
            {mode === 'reset' && `Enter the 6-digit code sent to ${form.email}`}
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
                disabled={mode === 'reset'} // Disable email editing during OTP entry
              />
            </InputWrap>
          </Field>

          {mode === 'signup' && (
            <>
              <Field label="Store / Business Name" error={errors.store_name}>
                <InputWrap>
                  <input value={form.store_name} onChange={set('store_name')} placeholder="RocketSales" />
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
                    <input value={form.phone} onChange={set('phone')} placeholder="+91 98765..." />
                  </InputWrap>
                </Field>
              </div>
            </>
          )}

          {/* OTP Field for Password Reset */}
          {mode === 'reset' && (
             <Field label="6-Digit Reset Code" error={errors.otp}>
               <InputWrap icon="🔑">
                 <input
                   value={form.otp}
                   onChange={set('otp')}
                   placeholder="123456"
                   maxLength={6}
                   style={{ letterSpacing: '2px', fontFamily: 'var(--mono)' }}
                 />
               </InputWrap>
             </Field>
          )}

          {/* Password Field (Hidden in Forgot Password mode) */}
          {mode !== 'forgot' && (
            <Field label={mode === 'reset' ? "New Password" : "Password"} error={errors.password}>
              <InputWrap onEye={() => setShowPw(p => !p)} showEye eyeOpen={showPw}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min 6 characters"
                  style={{ paddingRight: 44 }}
                />
              </InputWrap>
              {(mode === 'signup' || mode === 'reset') && form.password && (
                <div className={styles.strengthBar}>
                  <div
                    className={styles.strengthFill}
                    style={{
                      width: `${pwStrength * 25}%`,
                      background: strengthColors[pwStrength - 1] || 'transparent',
                    }}
                  />
                </div>
              )}
            </Field>
          )}

          {/* Forgot Password Link */}
          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: '-10px', marginBottom: '14px' }}>
              <button 
                type="button" 
                onClick={() => switchMode('forgot')} 
                style={{ background: 'none', border: 'none', color: 'var(--accent2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)' }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <><span className={styles.spinner} /> Processing…</>
            ) : mode === 'login' ? 'Sign In →' 
              : mode === 'signup' ? 'Create Seller Account →' 
              : mode === 'forgot' ? 'Send Reset Code' 
              : 'Reset Password'}
          </button>

          <p className={styles.terms}>
            {mode === 'signup' ? (
              <>By signing up you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a></>
            ) : mode === 'forgot' || mode === 'reset' ? (
              <><button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font)'}}>← Back to Sign In</button></>
            ) : (
              <>Don't have an account? <button onClick={() => switchMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--accent2)', cursor: 'pointer', fontFamily: 'var(--font)'}}>Sign up free</button></>
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