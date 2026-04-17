import { useEffect, useRef, useState } from 'react'
import styles from './PriceResult.module.css'

const fmt = (n) => n?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) ?? '—'

export default function PriceResult({ result, currentPrice }) {
  const {
    recommended_price,
    price_low,
    price_high,
    confidence,
    factors = [],
    insights = {},
    ai_analysis,
    // ✅ FIXED: backend renames model_breakdown → breakdown in /predict response
    breakdown = {},
  } = result

  const change = insights.change_from_current
  const barRef = useRef(null)
  const [barWidth, setBarWidth] = useState(0)

  useEffect(() => {
  const safe = Math.min(Math.max(confidence || 0, 0), 100)
  const t = setTimeout(() => setBarWidth(safe), 80)
  return () => clearTimeout(t)
}, [confidence])
if (!result) {
  return (
    <div className={styles.card}>
      <div className={styles.heroLabel}>No prediction yet</div>
    </div>
  )
}
  return (
    <div className={styles.card}>
      {/* ── Price Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroLabel}>Recommended Selling Price</div>
        <div className={styles.heroPrice}>₹{fmt(recommended_price)}</div>
        <div className={styles.heroSub}>
          <span className={styles.range}>₹{fmt(price_low)} — ₹{fmt(price_high)}</span>
          {change !== null && change !== undefined && (
            <span className={change >= 0 ? styles.changePos : styles.changeNeg}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% from current
            </span>
          )}
        </div>
      </div>

      {/* ── Confidence ── */}
      <div className={styles.confBlock}>
        <div className={styles.confRow}>
          <span className={styles.confLabel}>Model Confidence</span>
          <span className={styles.confVal}>{confidence}%</span>
        </div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${barWidth}%` }} />
        </div>
      </div>

      {/* ── Insights grid ── */}
      {/* ✅ FIXED: only show fields that actually exist in the API response.
          insights contains: { change_from_current, ml_price }
          breakdown contains: { mape, n_training }                          */}
      <div className={styles.insightGrid}>
        <div className={styles.insightCard}>
          <div className={styles.insightNum}>
            {insights.ml_price != null ? `₹${fmt(insights.ml_price)}` : '—'}
          </div>
          <div className={styles.insightDesc}>ML base price</div>
        </div>
        <div className={styles.insightCard}>
          <div className={styles.insightNum}>
            {change != null
              ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
              : '—'}
          </div>
          <div className={styles.insightDesc}>Change from current</div>
        </div>
        <div className={styles.insightCard}>
          <div className={styles.insightNum}>
            {breakdown.mape != null ? `${breakdown.mape}%` : '—'}
          </div>
          <div className={styles.insightDesc}>Model MAPE</div>
        </div>
        <div className={styles.insightCard}>
          <div className={styles.insightNum}>
            {breakdown.n_training != null
              ? breakdown.n_training.toLocaleString()
              : '—'}
          </div>
          <div className={styles.insightDesc}>Training samples</div>
        </div>
      </div>

      {/* ── Factors ── */}
      <div className={styles.sectionTitle}>
        <span className={`${styles.dot} ${styles.dotGreen}`} /> Pricing Signals
      </div>
      <div className={styles.factors}>
        {factors.map((f, i) => (
          <span key={i} className={`${styles.factor} ${styles[`factor_${f.type}`]}`}>
            {f.label}
          </span>
        ))}
        {factors.length === 0 && (
          <span className={`${styles.factor} ${styles.factor_neutral}`}>
            No signals computed
          </span>
        )}
      </div>

      {/* ── AI Analysis ── */}
      {ai_analysis && (
        <>
          <div className={styles.divider} />
          <div className={styles.aiLabel}>🤖 AI Strategic Analysis</div>
          <div className={styles.aiBox}>{ai_analysis}</div>
        </>
      )}

      {/* ── Model debug footer ── */}
      {(breakdown.mape != null || breakdown.n_training != null) && (
        <div className={styles.debug}>
          {breakdown.mape != null && <>MAPE: {breakdown.mape}%</>}
          {breakdown.mape != null && breakdown.n_training != null && <> &nbsp;·&nbsp; </>}
          {breakdown.n_training != null && (
            <>Trained on {breakdown.n_training.toLocaleString()} samples</>
          )}
        </div>
      )}
    </div>
  )
}