import { useState } from 'react'
import toast from 'react-hot-toast'
import { predictSingle } from '../api'
import { useAlerts } from '../contexts/AlertsContext'
import PriceResult from './PriceResult'
import styles from './SinglePredictor.module.css'

const CATEGORIES = [
  'Computers&Accessories', 'Electronics', 'Home&Kitchen',
  'Health&PersonalCare', 'Toys&Games', 'Car&Motorbike',
  'HomeImprovement', 'OfficeProducts', 'MusicalInstruments',
  'Sports', 'Clothing', 'Beauty', 'Other',
]

const INIT = {
  product_name: '', category: '', brand: '',
  current_price: '', market_price: '', competitor_price: '',
  rating: '', rating_count: '', demand_score: '', description: '',
  include_ai_analysis: true,
}

export default function SinglePredictor() {
  const { refresh: refreshAlerts } = useAlerts()
  const [form, setForm]       = useState(INIT)
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: val }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const validate = () => {
    const errs = {}
    if (!form.category)      errs.category      = 'Required'
    if (!form.current_price) errs.current_price  = 'Required'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    setResult(null)

    const payload = {
      ...form,
      current_price:    form.current_price    ? parseFloat(form.current_price)    : null,
      market_price:     form.market_price      ? parseFloat(form.market_price)     : null,
      competitor_price: form.competitor_price  ? parseFloat(form.competitor_price) : null,
      rating:           form.rating            ? parseFloat(form.rating)            : null,
      rating_count:     form.rating_count      ? parseInt(form.rating_count)        : null,
      demand_score:     form.demand_score      ? parseFloat(form.demand_score)      : null,
    }

    try {
      const data = await predictSingle(payload)
      setResult(data)

      // ✅ FIX: single consolidated toast (was firing up to 2 toasts)
      const change = data.insights?.change_from_current
      if (change != null && change <= -5) {
        toast('⚠️ Price drop recommended — consider reducing your price', { icon: '📉' })
      } else if (change != null && change >= 5) {
        toast('💰 Price increase opportunity detected!', { icon: '📈' })
      } else {
        toast.success('Price recommendation generated!')
      }

      // ✅ FIX: refresh alert dropdown immediately after prediction
      refreshAlerts()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Prediction failed. Is the backend running?'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setForm(INIT)
    setResult(null)
    setErrors({})
  }

  return (
    <div className={styles.grid}>
      {/* ── Form ── */}
      <div className={styles.formCard}>
        <div className={styles.cardTitle}>
          <span className={styles.dot} /> Product Details
        </div>

        <div className={styles.formGroup}>
          <label>Product Name / Title</label>
          <input
            value={form.product_name}
            onChange={set('product_name')}
            placeholder="e.g. Ambrane 60W Braided Type-C Cable 1.5m"
          />
        </div>

        <div className={styles.row}>
          <div className={`${styles.formGroup} ${errors.category ? styles.hasError : ''}`}>
            <label>Category *</label>
            <select value={form.category} onChange={set('category')}>
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {errors.category && <span className={styles.errMsg}>{errors.category}</span>}
          </div>
          <div className={styles.formGroup}>
            <label>Brand</label>
            <input value={form.brand} onChange={set('brand')} placeholder="e.g. Ambrane" />
          </div>
        </div>

        <div className={styles.row}>
          <div className={`${styles.formGroup} ${errors.current_price ? styles.hasError : ''}`}>
            <label>Current Price (₹) *</label>
            <input type="number" value={form.current_price} onChange={set('current_price')} placeholder="399" min="0" />
            {errors.current_price && <span className={styles.errMsg}>{errors.current_price}</span>}
          </div>
          <div className={styles.formGroup}>
            <label>Market / MRP (₹)</label>
            <input type="number" value={form.market_price} onChange={set('market_price')} placeholder="1099" min="0" />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label>Competitor Price (₹)</label>
            <input type="number" value={form.competitor_price} onChange={set('competitor_price')} placeholder="350" min="0" />
          </div>
          <div className={styles.formGroup}>
            <label>Rating (1–5)</label>
            <input type="number" value={form.rating} onChange={set('rating')} placeholder="4.2" min="1" max="5" step="0.1" />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label>No. of Ratings / Sales</label>
            <input type="number" value={form.rating_count} onChange={set('rating_count')} placeholder="24269" min="0" />
          </div>
          <div className={styles.formGroup}>
            <label>Demand Score</label>
            <input type="number" value={form.demand_score} onChange={set('demand_score')} placeholder="75000" min="0" />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Product Description / Features</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            placeholder="Paste key product features, specs, and USPs…"
            rows={4}
          />
        </div>

        <label className={styles.toggle}>
          <input type="checkbox" checked={form.include_ai_analysis} onChange={set('include_ai_analysis')} />
          <span>Include AI narrative (requires Anthropic API key)</span>
        </label>

        <div className={styles.btnRow}>
          <button className={styles.btnPredict} onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className={styles.spinner} /> Generating…</> : '⚡ Get Price Recommendation'}
          </button>
          {result && (
            <button className={styles.btnReset} onClick={handleReset}>
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Result / Skeleton ── */}
      <div>
        {loading ? (
          <ResultSkeleton />
        ) : result ? (
          <PriceResult result={result} currentPrice={parseFloat(form.current_price) || null} />
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📊</div>
            <p>Fill in your product details and click <strong>Get Price Recommendation</strong> to receive an AI-powered optimal price with strategic rationale.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultSkeleton() {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {[80, 48, 24, 60, 36].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 40 : 16,
          width: `${w}%`,
          background: 'var(--border2)',
          borderRadius: 6,
          animation: 'pulse 1.5s ease-in-out infinite',
          opacity: 0.6,
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
    </div>
  )
}