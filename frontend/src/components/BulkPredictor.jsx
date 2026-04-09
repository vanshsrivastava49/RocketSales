import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { predictBulk, exportProducts } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import styles from './BulkPredictor.module.css'

const fmt = (n) => n?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) ?? '—'
const pct = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`)

export default function BulkPredictor() {
  const [file, setFile]       = useState(null)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const onDrop = useCallback((accepted) => {
    if (accepted.length) {
      setFile(accepted[0])
      setData(null) // clear previous results when a new file is dropped
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setData(null)
    try {
      const res = await predictBulk(file)
      setData(res)

      // Backend returns total_success, not total
      if (res.total_errors > 0) {
        toast.success(`Analyzed ${res.total_success} products (${res.total_errors} rows had errors)`)
      } else {
        toast.success(`Analyzed ${res.total_success} products!`)
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      // Backend can return detail as a plain string OR as a structured object
      // (e.g. missing columns returns { message, missing_columns, required_columns })
      const msg = typeof detail === 'string'
        ? detail
        : (detail?.message ?? 'Bulk analysis failed.')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Use the backend's export endpoint (GET /my/products/export) which streams
  // the full history as a properly formatted CSV — avoids duplicating that
  // logic here and keeps exports consistent with what's stored server-side.
  const handleDownload = async () => {
    setExporting(true)
    try {
      await exportProducts()
      toast.success('Downloaded!')
    } catch {
      toast.error('Export failed — try again')
    } finally {
      setExporting(false)
    }
  }

  // Chart: top 12 products by absolute price change
  const chartData = data?.results
    ?.filter(r => r.change_pct != null)
    .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
    .slice(0, 12)
    .map(r => ({
      name: (r.product_name?.substring(0, 22) ?? 'Unknown') + (r.product_name?.length > 22 ? '…' : ''),
      change: parseFloat(r.change_pct?.toFixed(1)),
    })) ?? []

  return (
    <div className={styles.wrap}>
      {/* ── Upload ── */}
      <div className={styles.uploadCard}>
        <div className={styles.cardTitle}><span className={styles.dot} /> Bulk CSV Upload</div>

        <div
          {...getRootProps()}
          className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''} ${file ? styles.dropzoneDone : ''}`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className={styles.fileLoaded}>
              <span className={styles.fileIcon}>✅</span>
              <div>
                <div className={styles.fileName}>{file.name}</div>
                <div className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB — ready to analyze</div>
              </div>
            </div>
          ) : (
            <>
              <p className={styles.dropMain}>{isDragActive ? 'Drop it!' : 'Drag & drop your CSV or click to browse'}</p>
              <p className={styles.dropSub}>
                Required columns: <code>category</code> + one of <code>current_price</code> / <code>discounted_price</code>
                <br />
                Optional: product_name, brand, actual_price, competitor_price, rating, rating_count, demand_score
              </p>
            </>
          )}
        </div>

        <button
          className={styles.btnAnalyze}
          onClick={handleAnalyze}
          disabled={!file || loading}
        >
          {loading ? <><span className={styles.spinner} /> Analyzing…</> : 'Analyze All Products'}
        </button>
      </div>

      {/* ── Results ── */}
      {data && (
        <>
          {/* Summary stats — use total_success, not total */}
          <div className={styles.summaryGrid}>
            <SummaryCard label="Rows Processed"   value={data.total_rows} />
            <SummaryCard label="Successful"        value={data.total_success} color="green" />
            <SummaryCard label="Errors"            value={data.total_errors}  color={data.total_errors > 0 ? 'red' : undefined} />
            <SummaryCard
              label="Avg Price Change"
              value={pct(data.summary?.avg_change_pct)}
              color={data.summary?.avg_change_pct >= 0 ? 'green' : 'red'}
            />
            <SummaryCard label="Underpriced" value={data.summary?.underpriced_count} color="green" />
            <SummaryCard label="Overpriced"  value={data.summary?.overpriced_count}  color="red"   />
            <SummaryCard label="Optimal"     value={data.summary?.optimal_count}     color="accent" />
          </div>

          {/* Row errors panel — shown when backend flags individual row failures */}
          {data.row_errors?.length > 0 && (
            <div className={styles.errorCard}>
              <div className={styles.cardTitle} style={{ color: 'var(--accent3)' }}>
                ⚠️ {data.row_errors.length} row{data.row_errors.length !== 1 ? 's' : ''} could not be processed
              </div>
              <div className={styles.errorList}>
                {data.row_errors.map((e, i) => (
                  <div key={i} className={styles.errorRow}>
                    <span className={styles.errorRowNum}>Row {e.row}</span>
                    <span className={styles.errorRowName}>{e.product_name}</span>
                    <span className={styles.errorRowMsg}>{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <div className={styles.chartCard}>
              <div className={styles.cardTitle}><span className={styles.dot} /> Largest Price Adjustments</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tick={{ fill: 'var(--muted2)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Change']}
                    // Use CSS variables so tooltip adapts to light/dark mode
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--text)',
                    }}
                  />
                  <Bar dataKey="change" radius={[0, 4, 4, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.change >= 0 ? '#00e5b4' : '#ff6b6b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          {data.results?.length > 0 && (
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div className={styles.cardTitle} style={{ margin: 0 }}>
                  <span className={styles.dot} /> All Recommendations
                </div>
                <button
                  className={styles.btnDownload}
                  onClick={handleDownload}
                  disabled={exporting}
                >
                  {exporting ? '⏳ Exporting…' : '⬇ Export CSV'}
                </button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Current</th>
                      <th>Recommended</th>
                      <th>Range</th>
                      <th>Change</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r, i) => (
                      <tr key={i}>
                        <td className={styles.nameCell} title={r.product_name}>
                          {r.product_name?.substring(0, 40)}{r.product_name?.length > 40 ? '…' : ''}
                        </td>
                        <td><span className={styles.catBadge}>{r.category}</span></td>
                        <td className={styles.mono}>{r.current_price ? `₹${fmt(r.current_price)}` : '—'}</td>
                        <td className={`${styles.mono} ${styles.recPrice}`}>₹{fmt(r.recommended_price)}</td>
                        <td className={styles.mono} style={{ color: 'var(--muted)', fontSize: 12 }}>
                          ₹{fmt(r.price_low)}–{fmt(r.price_high)}
                        </td>
                        <td className={r.change_pct >= 0 ? styles.changePos : styles.changeNeg}>
                          {pct(r.change_pct)}
                        </td>
                        <td>
                          <div className={styles.confPill}>
                            <div className={styles.confTrack}>
                              <div className={styles.confFill} style={{ width: `${r.confidence}%` }} />
                            </div>
                            <span className={styles.confNum}>{r.confidence}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  const colorMap = { green: 'var(--accent2)', red: 'var(--accent3)', accent: 'var(--accent)' }
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryNum} style={color ? { color: colorMap[color] } : {}}>{value ?? '—'}</div>
      <div className={styles.summaryLabel}>{label}</div>
    </div>
  )
}