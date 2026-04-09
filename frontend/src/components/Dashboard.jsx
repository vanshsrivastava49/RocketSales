import { useEffect, useState } from 'react'
import { fetchStats } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import styles from './Dashboard.module.css'

const fmt = (n) => n?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) ?? '—'

export default function Dashboard() {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setError('Could not load stats — is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}><span className={styles.spinner} /> Loading market data…</div>
  if (error)   return <div className={styles.error}>{error}</div>

  const catStats = stats?.category_stats ?? {}
  const catKeys  = Object.keys(catStats)

  // Guard: if no category data yet show a placeholder
  if (catKeys.length === 0) {
    return (
      <div className={styles.wrap}>
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted2)', fontSize: 14 }}>
          📊 No category data available — train the model with a dataset first.
        </div>
      </div>
    )
  }

  const avgPriceData = catKeys.map(k => ({
    name:   k.replace('&', ' & '),
    avg:    catStats[k].avg_price,
    median: catStats[k].median_price,
  }))

  const discountData = catKeys.map(k => ({
    name:     k.replace('&', ' & '),
    discount: catStats[k].avg_discount,
  }))

  const radarData = catKeys.slice(0, 7).map(k => ({
    subject: k.split('&')[0],
    rating:  catStats[k].avg_rating  * 20,                          // scale 0–5 → 0–100
    demand:  Math.min(catStats[k].avg_demand  / 2000, 100),
    margin:  Math.min(catStats[k].avg_margin  / 100,  100),
  }))

  const model = stats?.model ?? {}

  return (
    <div className={styles.wrap}>
      {/* Model info banner */}
      <div className={styles.modelBanner}>
        <div className={styles.bannerItem}>
          <span className={styles.bannerVal}>{model.trained ? 'Active' : 'Offline'}</span>
          <span className={styles.bannerLabel}>ML Model</span>
        </div>
        <div className={styles.bannerDivider} />
        <div className={styles.bannerItem}>
          <span className={styles.bannerVal}>{model.n_samples?.toLocaleString()}</span>
          <span className={styles.bannerLabel}>Training samples</span>
        </div>
        <div className={styles.bannerDivider} />
        <div className={styles.bannerItem}>
          <span className={styles.bannerVal}>{model.mape_pct != null ? `${model.mape_pct}%` : '—'}</span>
          <span className={styles.bannerLabel}>Model MAPE</span>
        </div>
        <div className={styles.bannerDivider} />
        <div className={styles.bannerItem}>
          <span className={styles.bannerVal}>{model.algorithm}</span>
          <span className={styles.bannerLabel}>Algorithm</span>
        </div>
        <div className={styles.bannerDivider} />
        <div className={styles.bannerItem}>
          <span className={styles.bannerVal}>{model.features?.length}</span>
          <span className={styles.bannerLabel}>Features used</span>
        </div>
      </div>

      {/* Charts grid */}
      <div className={styles.chartsGrid}>
        {/* Avg Price by Category */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}><span className={styles.dot} />Avg vs Median Price by Category</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={avgPriceData} margin={{ left: 0, right: 16, top: 4, bottom: 60 }}>
              <XAxis dataKey="name" tick={{ fill: '#6b6b80', fontSize: 10 }} angle={-35} textAnchor="end" />
              <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fill: '#6b6b80', fontSize: 10 }} />
              <Tooltip
                formatter={(v, n) => [`₹${fmt(v)}`, n === 'avg' ? 'Avg Price' : 'Median Price']}
                contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="avg"    fill="#7c5cfc" radius={[3,3,0,0]} name="avg" />
              <Bar dataKey="median" fill="#00e5b4" radius={[3,3,0,0]} name="median" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avg Discount by Category */}
        {/*
          ✅ FIXED: Previously had a nested <Bar> inside <Bar> which is invalid
          in Recharts and silently prevented the colour-coded cells from rendering.
          The correct pattern is one <Bar> with <Cell> children for per-bar colours.
        */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>
            <span className={styles.dot} style={{ background: 'var(--gold)' }} />
            Avg Discount % by Category
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={discountData} margin={{ left: 0, right: 16, top: 4, bottom: 60 }}>
              <XAxis dataKey="name" tick={{ fill: '#6b6b80', fontSize: 10 }} angle={-35} textAnchor="end" />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: '#6b6b80', fontSize: 10 }} />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Avg Discount']}
                contentStyle={{
                  background: '#1a1a24',
                  border: '1px solid #2a2a3a',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#e8e8f5',
                }}
              />
              <Bar dataKey="discount" radius={[3,3,0,0]}>
                {discountData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.discount > 50 ? '#ff6b6b' : d.discount > 30 ? '#f5c842' : '#00e5b4'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>
            <span className={styles.dot} style={{ background: 'var(--accent2)' }} />
            Category Multi-Dimension Radar
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#2a2a3a" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#9a9ab0', fontSize: 11 }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar name="Rating" dataKey="rating" stroke="#7c5cfc" fill="#7c5cfc" fillOpacity={0.3} />
              <Radar name="Demand" dataKey="demand" stroke="#00e5b4" fill="#00e5b4" fillOpacity={0.2} />
              <Radar name="Margin" dataKey="margin" stroke="#f5c842" fill="#f5c842" fillOpacity={0.2} />
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
          <div className={styles.legend}>
            <span style={{ color: '#7c5cfc' }}>■</span> Rating &nbsp;
            <span style={{ color: '#00e5b4' }}>■</span> Demand &nbsp;
            <span style={{ color: '#f5c842' }}>■</span> Margin
          </div>
        </div>

        {/* Category stats table */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}><span className={styles.dot} />Category Stats Table</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category</th><th>Avg Price</th><th>Avg Rating</th><th>Avg Disc.</th><th>Products</th>
                </tr>
              </thead>
              <tbody>
                {catKeys.map(k => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className={styles.mono}>₹{fmt(catStats[k].avg_price)}</td>
                    <td className={styles.mono}>{catStats[k].avg_rating?.toFixed(2)}</td>
                    <td className={styles.mono}>{catStats[k].avg_discount?.toFixed(1)}%</td>
                    <td className={styles.mono}>{catStats[k].count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Features list */}
      <div className={styles.featuresCard}>
        <div className={styles.chartTitle}>
          <span className={styles.dot} />Model Feature Set ({model.features?.length})
        </div>
        <div className={styles.featureTags}>
          {model.features?.map(f => (
            <span key={f} className={styles.featureTag}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  )
}