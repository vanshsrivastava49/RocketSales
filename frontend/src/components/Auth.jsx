import { useState, useEffect, useRef } from "react";

/* ─── Design tokens matching PriceIQ dark theme ─────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0d0d14;
    --bg2:       #12121c;
    --bg3:       #1a1a26;
    --border:    #22223a;
    --border2:   #2e2e48;
    --accent:    #7c5cfc;
    --accent2:   #00e5b4;
    --accent3:   #ff6b6b;
    --gold:      #f5c842;
    --text:      #e8e8f5;
    --muted:     #6b6b8a;
    --muted2:    #9a9ab8;
    --font:      'DM Sans', sans-serif;
    --mono:      'DM Mono', monospace;
    --display:   'Syne', sans-serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font); min-height: 100vh; overflow-x: hidden; }

  /* ── Auth wrapper ── */
  .auth-root {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    position: relative;
  }
  @media(max-width:860px){ .auth-root { grid-template-columns: 1fr; } .auth-panel { display: none !important; } }

  /* ── Left decorative panel ── */
  .auth-panel {
    background: linear-gradient(135deg, #0d0d14 0%, #150f2e 50%, #0d1a14 100%);
    padding: 60px 48px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }
  .panel-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(124,92,252,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124,92,252,0.06) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .panel-glow1 {
    position: absolute; width: 400px; height: 400px; border-radius: 50%;
    background: radial-gradient(circle, rgba(124,92,252,0.18) 0%, transparent 70%);
    top: -80px; left: -80px; pointer-events: none;
  }
  .panel-glow2 {
    position: absolute; width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,229,180,0.12) 0%, transparent 70%);
    bottom: 60px; right: -60px; pointer-events: none;
  }
  .panel-logo {
    font-family: var(--display); font-size: 28px; font-weight: 800;
    color: var(--text); position: relative; z-index:1; letter-spacing: -0.5px;
  }
  .panel-logo span { color: var(--accent); }
  .panel-logo sub { font-family: var(--mono); font-size: 10px; color: var(--accent2); vertical-align: super; margin-left: 4px; }

  .panel-hero { position: relative; z-index: 1; }
  .panel-headline {
    font-family: var(--display); font-size: 42px; font-weight: 800;
    line-height: 1.15; color: var(--text); margin-bottom: 20px;
    letter-spacing: -1px;
  }
  .panel-headline em { font-style: normal; color: var(--accent2); }
  .panel-sub { color: var(--muted2); font-size: 15px; line-height: 1.7; max-width: 360px; }

  .stat-pills { display: flex; flex-direction: column; gap: 12px; position: relative; z-index: 1; }
  .stat-pill {
    display: flex; align-items: center; gap: 16px;
    background: rgba(255,255,255,0.04); border: 1px solid var(--border2);
    border-radius: 14px; padding: 14px 20px; backdrop-filter: blur(10px);
  }
  .stat-icon { font-size: 22px; }
  .stat-text { flex: 1; }
  .stat-val { font-family: var(--mono); font-size: 18px; font-weight: 500; color: var(--accent2); }
  .stat-desc { font-size: 12px; color: var(--muted); margin-top: 1px; }

  /* ── Right form area ── */
  .auth-form-side {
    background: var(--bg2);
    display: flex; align-items: center; justify-content: center;
    padding: 48px 40px;
    position: relative;
    overflow: hidden;
  }
  .auth-form-side::before {
    content:''; position: absolute; top: -1px; left: -1px; right: -1px;
    height: 1px; background: linear-gradient(90deg, transparent, var(--accent), var(--accent2), transparent);
    opacity: 0.4;
  }

  .auth-box { width: 100%; max-width: 440px; }

  .auth-toggle {
    display: flex; gap: 4px; background: var(--bg3);
    border: 1px solid var(--border); border-radius: 12px; padding: 4px;
    margin-bottom: 36px;
  }
  .auth-toggle button {
    flex: 1; padding: 10px; border: none; border-radius: 9px;
    font-family: var(--font); font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
    background: transparent; color: var(--muted2);
  }
  .auth-toggle button.active {
    background: var(--accent); color: #fff;
    box-shadow: 0 4px 16px rgba(124,92,252,0.35);
  }

  .auth-title { font-family: var(--display); font-size: 26px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
  .auth-sub { color: var(--muted2); font-size: 14px; margin-bottom: 28px; }

  .field { margin-bottom: 18px; }
  .field label { display: block; font-size: 13px; font-weight: 500; color: var(--muted2); margin-bottom: 7px; letter-spacing: 0.3px; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  .input-wrap { position: relative; }
  .input-wrap .icon {
    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
    font-size: 15px; pointer-events: none; opacity: 0.6;
  }
  .input-wrap input, .input-wrap select {
    width: 100%; padding: 12px 14px 12px 40px;
    background: var(--bg3); border: 1.5px solid var(--border2);
    border-radius: 10px; color: var(--text); font-family: var(--font); font-size: 14px;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    appearance: none;
  }
  .input-wrap input::placeholder { color: var(--muted); }
  .input-wrap input:focus, .input-wrap select:focus {
    border-color: var(--accent); box-shadow: 0 0 0 3px rgba(124,92,252,0.15);
  }
  .input-wrap.error input { border-color: var(--accent3); }
  .err-msg { font-size: 11px; color: var(--accent3); margin-top: 5px; }

  .eye-btn {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: var(--muted); font-size: 16px;
    padding: 4px; transition: color 0.2s;
  }
  .eye-btn:hover { color: var(--text); }

  .strength-bar { height: 3px; border-radius: 2px; margin-top: 6px; background: var(--border); overflow: hidden; }
  .strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; }

  .btn-submit {
    width: 100%; padding: 14px; border: none; border-radius: 12px;
    background: linear-gradient(135deg, var(--accent) 0%, #9d7dff 100%);
    color: #fff; font-family: var(--font); font-size: 15px; font-weight: 600;
    cursor: pointer; transition: all 0.2s; margin-top: 8px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 6px 24px rgba(124,92,252,0.4);
    letter-spacing: 0.3px;
  }
  .btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 32px rgba(124,92,252,0.5); }
  .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .divider { display: flex; align-items: center; gap: 12px; margin: 22px 0; }
  .divider::before, .divider::after { content:''; flex:1; height:1px; background: var(--border2); }
  .divider span { font-size: 12px; color: var(--muted); }

  .terms { font-size: 12px; color: var(--muted); text-align: center; margin-top: 18px; line-height: 1.6; }
  .terms a { color: var(--accent2); text-decoration: none; cursor: pointer; }

  .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Dashboard ── */
  .dash-root { min-height: 100vh; background: var(--bg); }
  .dash-header {
    background: var(--bg2); border-bottom: 1px solid var(--border);
    padding: 0 32px; height: 64px;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 100; backdrop-filter: blur(10px);
  }
  .dash-logo { font-family: var(--display); font-size: 22px; font-weight: 800; }
  .dash-logo span { color: var(--accent); }
  .dash-badge {
    font-family: var(--mono); font-size: 9px; background: var(--accent); color: #fff;
    padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;
  }

  .dash-user { display: flex; align-items: center; gap: 12px; }
  .user-avatar {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px; color: #fff;
  }
  .user-info { text-align: right; }
  .user-name { font-size: 13px; font-weight: 600; }
  .user-plan { font-size: 11px; color: var(--accent2); font-family: var(--mono); }

  .btn-logout {
    padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border2);
    background: transparent; color: var(--muted2); font-family: var(--font);
    font-size: 13px; cursor: pointer; transition: all 0.2s;
  }
  .btn-logout:hover { border-color: var(--accent3); color: var(--accent3); }

  .dash-body { display: grid; grid-template-columns: 220px 1fr; min-height: calc(100vh - 64px); }

  /* ── Sidebar ── */
  .sidebar {
    background: var(--bg2); border-right: 1px solid var(--border);
    padding: 24px 16px;
  }
  .sidebar-section { margin-bottom: 28px; }
  .sidebar-label { font-size: 10px; font-weight: 600; color: var(--muted); letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px; padding-left: 12px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 500; color: var(--muted2);
    transition: all 0.2s; margin-bottom: 2px; border: none;
    background: transparent; width: 100%; text-align: left; font-family: var(--font);
  }
  .nav-item:hover { background: var(--bg3); color: var(--text); }
  .nav-item.active { background: rgba(124,92,252,0.15); color: var(--accent); border: 1px solid rgba(124,92,252,0.25); }
  .nav-item .nav-icon { font-size: 16px; width: 20px; text-align: center; }
  .nav-badge {
    margin-left: auto; font-size: 10px; background: var(--accent3);
    color: #fff; padding: 1px 6px; border-radius: 10px; font-family: var(--mono);
  }

  /* ── Dashboard content ── */
  .dash-content { padding: 32px; overflow-y: auto; }

  .page-title { font-family: var(--display); font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px; }
  .page-sub { color: var(--muted2); font-size: 14px; margin-bottom: 28px; }

  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
  @media(max-width:1100px){ .kpi-grid { grid-template-columns: repeat(2,1fr); } }

  .kpi-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 20px 22px; position: relative; overflow: hidden;
    transition: border-color 0.2s, transform 0.2s;
  }
  .kpi-card:hover { border-color: var(--border2); transform: translateY(-1px); }
  .kpi-card::before {
    content:''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: var(--kpi-color, var(--accent));
  }
  .kpi-icon { font-size: 20px; margin-bottom: 12px; }
  .kpi-val { font-family: var(--mono); font-size: 26px; font-weight: 500; color: var(--kpi-color, var(--accent)); }
  .kpi-label { font-size: 12px; color: var(--muted2); margin-top: 4px; }
  .kpi-delta {
    font-size: 11px; font-family: var(--mono); margin-top: 8px;
    padding: 2px 8px; border-radius: 6px; display: inline-block;
  }
  .kpi-delta.up { background: rgba(0,229,180,0.12); color: var(--accent2); }
  .kpi-delta.down { background: rgba(255,107,107,0.12); color: var(--accent3); }

  .charts-row { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; margin-bottom: 24px; }
  @media(max-width:1000px){ .charts-row { grid-template-columns: 1fr; } }

  .card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 24px;
  }
  .card-title {
    font-size: 13px; font-weight: 600; color: var(--muted2); letter-spacing: 0.4px;
    text-transform: uppercase; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
  }
  .card-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); display: inline-block; }

  /* Mini sparkline */
  .mini-chart { height: 100px; display: flex; align-items: flex-end; gap: 6px; padding-top: 8px; }
  .bar-seg { flex: 1; border-radius: 4px 4px 0 0; transition: opacity 0.2s; cursor: default; position: relative; }
  .bar-seg:hover { opacity: 0.8; }
  .bar-seg::after {
    content: attr(data-tip); position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%);
    background: var(--bg3); border: 1px solid var(--border2); border-radius: 6px;
    font-size: 11px; font-family: var(--mono); color: var(--text); padding: 4px 8px;
    white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.15s;
  }
  .bar-seg:hover::after { opacity: 1; }

  /* Activity feed */
  .activity-list { display: flex; flex-direction: column; gap: 0; }
  .activity-item {
    display: flex; align-items: center; gap: 14px;
    padding: 12px 0; border-bottom: 1px solid var(--border);
  }
  .activity-item:last-child { border-bottom: none; }
  .act-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
  .act-text { flex: 1; }
  .act-main { font-size: 13px; font-weight: 500; }
  .act-time { font-size: 11px; color: var(--muted); margin-top: 2px; font-family: var(--mono); }
  .act-badge { font-size: 11px; font-family: var(--mono); padding: 3px 8px; border-radius: 6px; }

  /* Profile page */
  .profile-grid { display: grid; grid-template-columns: 340px 1fr; gap: 24px; }
  @media(max-width:900px){ .profile-grid { grid-template-columns: 1fr; } }

  .profile-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; padding: 28px; }
  .profile-avatar-wrap { text-align: center; margin-bottom: 24px; }
  .profile-avatar {
    width: 80px; height: 80px; border-radius: 20px; margin: 0 auto 14px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex; align-items: center; justify-content: center;
    font-family: var(--display); font-size: 32px; font-weight: 800; color: #fff;
  }
  .profile-name { font-family: var(--display); font-size: 20px; font-weight: 800; }
  .profile-email { font-size: 13px; color: var(--muted2); margin-top: 4px; }
  .profile-plan {
    margin-top: 12px; display: inline-flex; align-items: center; gap: 6px;
    background: rgba(0,229,180,0.1); border: 1px solid rgba(0,229,180,0.25);
    color: var(--accent2); font-size: 12px; font-family: var(--mono);
    padding: 4px 12px; border-radius: 20px;
  }

  .profile-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
  .ps-item { background: var(--bg3); border-radius: 10px; padding: 14px; }
  .ps-val { font-family: var(--mono); font-size: 20px; color: var(--accent); }
  .ps-label { font-size: 11px; color: var(--muted); margin-top: 2px; }

  .form-section-title { font-size: 14px; font-weight: 600; color: var(--muted2); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
  .edit-field { margin-bottom: 16px; }
  .edit-field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  .edit-field input, .edit-field select, .edit-field textarea {
    width: 100%; padding: 11px 14px; background: var(--bg3);
    border: 1.5px solid var(--border2); border-radius: 10px;
    color: var(--text); font-family: var(--font); font-size: 14px; outline: none;
    transition: border-color 0.2s;
  }
  .edit-field input:focus, .edit-field select:focus, .edit-field textarea:focus { border-color: var(--accent); }
  .edit-field textarea { resize: vertical; min-height: 80px; }
  .edit-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  .btn-save {
    padding: 11px 28px; border-radius: 10px; border: none;
    background: var(--accent); color: #fff; font-family: var(--font);
    font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
  }
  .btn-save:hover { background: #9070ff; }

  .tag { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-family: var(--mono); border: 1px solid; }
  .tag-green { background: rgba(0,229,180,0.1); color: var(--accent2); border-color: rgba(0,229,180,0.25); }
  .tag-purple { background: rgba(124,92,252,0.1); color: var(--accent); border-color: rgba(124,92,252,0.25); }
  .tag-red { background: rgba(255,107,107,0.1); color: var(--accent3); border-color: rgba(255,107,107,0.25); }
  .tag-gold { background: rgba(245,200,66,0.1); color: var(--gold); border-color: rgba(245,200,66,0.25); }

  /* Toast */
  .toast-wrap {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    display: flex; flex-direction: column; gap: 8px; pointer-events: none;
  }
  .toast {
    background: var(--bg3); border: 1px solid var(--border2); border-radius: 10px;
    padding: 12px 18px; font-size: 13px; display: flex; align-items: center; gap: 10px;
    animation: slideIn 0.3s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  @keyframes slideIn { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }
  .toast.success { border-left: 3px solid var(--accent2); }
  .toast.error { border-left: 3px solid var(--accent3); }

  /* Animations */
  @keyframes fadeUp { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.4s ease both; }
  .fade-up-1 { animation-delay: 0.05s; }
  .fade-up-2 { animation-delay: 0.10s; }
  .fade-up-3 { animation-delay: 0.15s; }
  .fade-up-4 { animation-delay: 0.20s; }
`;

/* ─── Mock data ──────────────────────────────────────────────────── */
const ACTIVITY = [
  { icon: "⚡", color: "rgba(124,92,252,0.15)", main: "Bulk analysis completed — 48 products", time: "2 min ago", badge: "48 items", bclass: "tag-purple" },
  { icon: "📈", color: "rgba(0,229,180,0.12)", main: "Price updated: boAt Airdopes 141", time: "18 min ago", badge: "+12.4%", bclass: "tag-green" },
  { icon: "📉", color: "rgba(255,107,107,0.12)", main: "Alert: 3 products overpriced vs competitors", time: "1 hr ago", badge: "Action needed", bclass: "tag-red" },
  { icon: "🤖", color: "rgba(245,200,66,0.10)", main: "AI analysis generated for 12 SKUs", time: "3 hrs ago", badge: "AI", bclass: "tag-gold" },
  { icon: "📦", color: "rgba(124,92,252,0.15)", main: "CSV export downloaded", time: "Yesterday", badge: "CSV", bclass: "tag-purple" },
];

const MONTHS = ["Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const REV_DATA = [38, 52, 48, 61, 55, 72, 84, 93];
const PRODUCTS_DATA = [12, 18, 14, 22, 25, 31, 38, 42];

/* ─── Toast ─────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === "success" ? "✅" : "❌"}</span> {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ─── Auth Page ─────────────────────────────────────────────────── */
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    firstName:"", lastName:"", email:"", password:"",
    storeName:"", category:"", phone:"",
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const pwStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthColor = ["#ff6b6b","#f5c842","#7c5cfc","#00e5b4"][pwStrength - 1] || "transparent";

  const validate = () => {
    const e = {};
    if (!form.email.includes("@")) e.email = "Valid email required";
    if (form.password.length < 6) e.password = "Min 6 characters";
    if (mode === "signup") {
      if (!form.firstName.trim()) e.firstName = "Required";
      if (!form.storeName.trim()) e.storeName = "Required";
    }
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({
        name: mode === "signup" ? `${form.firstName} ${form.lastName}`.trim() : "Seller Pro",
        email: form.email,
        store: form.storeName || "My Store",
        initials: (mode === "signup" ? form.firstName[0] : "S").toUpperCase(),
      });
    }, 1400);
  };

  return (
    <div className="auth-root">
      <style>{css}</style>

      {/* Left decorative panel */}
      <div className="auth-panel">
        <div className="panel-grid" />
        <div className="panel-glow1" />
        <div className="panel-glow2" />

        <div className="panel-logo">Price<span>IQ</span><sub>AI ENGINE v2</sub></div>

        <div className="panel-hero">
          <div className="panel-headline">
            Smarter pricing.<br/><em>More revenue.</em>
          </div>
          <p className="panel-sub">
            Join thousands of e-commerce sellers using AI-powered pricing to beat competitors and maximise margins on every SKU.
          </p>
        </div>

        <div className="stat-pills">
          {[
            { icon:"🏪", val:"12,400+", desc:"Active sellers on platform" },
            { icon:"⚡", val:"₹2.8Cr+", desc:"Revenue optimised today" },
            { icon:"📊", val:"97%", desc:"Prediction accuracy (top sellers)" },
          ].map((s) => (
            <div className="stat-pill" key={s.val}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-text">
                <div className="stat-val">{s.val}</div>
                <div className="stat-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="auth-form-side">
        <div className="auth-box fade-up">
          <div className="auth-toggle">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setErrors({}); }}>Sign In</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setErrors({}); }}>Create Account</button>
          </div>

          <div className="auth-title">{mode === "login" ? "Welcome back" : "Start selling smarter"}</div>
          <div className="auth-sub">{mode === "login" ? "Sign in to your seller dashboard" : "Create your free seller account in 30 seconds"}</div>

          {mode === "signup" && (
            <div className="field-row">
              <div className="field">
                <label>First Name</label>
                <div className={`input-wrap${errors.firstName ? " error" : ""}`}>
                  <span className="icon">👤</span>
                  <input value={form.firstName} onChange={set("firstName")} placeholder="Riya" />
                </div>
                {errors.firstName && <div className="err-msg">{errors.firstName}</div>}
              </div>
              <div className="field">
                <label>Last Name</label>
                <div className="input-wrap">
                  <span className="icon">👤</span>
                  <input value={form.lastName} onChange={set("lastName")} placeholder="Sharma" />
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <label>Email Address</label>
            <div className={`input-wrap${errors.email ? " error" : ""}`}>
              <span className="icon">✉️</span>
              <input type="email" value={form.email} onChange={set("email")} placeholder="riya@mystore.in" />
            </div>
            {errors.email && <div className="err-msg">{errors.email}</div>}
          </div>

          {mode === "signup" && (
            <>
              <div className="field">
                <label>Store / Business Name</label>
                <div className={`input-wrap${errors.storeName ? " error" : ""}`}>
                  <span className="icon">🏪</span>
                  <input value={form.storeName} onChange={set("storeName")} placeholder="RiyaStore Electronics" />
                </div>
                {errors.storeName && <div className="err-msg">{errors.storeName}</div>}
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Category</label>
                  <div className="input-wrap">
                    <span className="icon">📦</span>
                    <select value={form.category} onChange={set("category")}>
                      <option value="">Select…</option>
                      {["Electronics","Home&Kitchen","Fashion","Beauty","Toys&Games","Sports","Other"].map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Phone (optional)</label>
                  <div className="input-wrap">
                    <span className="icon">📱</span>
                    <input value={form.phone} onChange={set("phone")} placeholder="+91 98765..." />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="field">
            <label>Password</label>
            <div className={`input-wrap${errors.password ? " error" : ""}`}>
              <span className="icon">🔒</span>
              <input
                type={showPw ? "text" : "password"}
                value={form.password} onChange={set("password")}
                placeholder="Min 6 characters"
                style={{ paddingRight: 44 }}
              />
              <button className="eye-btn" onClick={() => setShowPw(p => !p)}>{showPw ? "🙈" : "👁️"}</button>
            </div>
            {errors.password && <div className="err-msg">{errors.password}</div>}
            {mode === "signup" && form.password && (
              <div className="strength-bar">
                <div className="strength-fill" style={{ width: `${pwStrength * 25}%`, background: strengthColor }} />
              </div>
            )}
          </div>

          <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" /> {mode === "login" ? "Signing in…" : "Creating account…"}</> : mode === "login" ? "Sign In →" : "Create Seller Account →"}
          </button>

          <div className="terms">
            {mode === "signup"
              ? <>By signing up you agree to our <a>Terms of Service</a> and <a>Privacy Policy</a></>
              : <>Don't have an account? <a onClick={() => { setMode("signup"); setErrors({}); }}>Sign up free</a></>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── KPI Card ──────────────────────────────────────────────────── */
function KpiCard({ icon, val, label, delta, deltaType, color, delay }) {
  return (
    <div className={`kpi-card fade-up fade-up-${delay}`} style={{ "--kpi-color": color }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-val">{val}</div>
      <div className="kpi-label">{label}</div>
      {delta && <div className={`kpi-delta ${deltaType}`}>{deltaType === "up" ? "▲" : "▼"} {delta}</div>}
    </div>
  );
}

/* ─── Mini Bar Chart ────────────────────────────────────────────── */
function MiniBars({ data, labels, color }) {
  const max = Math.max(...data);
  return (
    <div className="mini-chart">
      {data.map((v, i) => (
        <div
          key={i}
          className="bar-seg"
          data-tip={`${labels[i]}: ${v}`}
          style={{ height: `${(v / max) * 100}%`, background: color, opacity: i === data.length - 1 ? 1 : 0.5 }}
        />
      ))}
    </div>
  );
}

/* ─── Overview Tab ──────────────────────────────────────────────── */
function OverviewTab({ user }) {
  return (
    <>
      <div className="page-title fade-up">Welcome back, {user.name.split(" ")[0]} 👋</div>
      <div className="page-sub fade-up fade-up-1">Here's your seller performance at a glance</div>

      <div className="kpi-grid">
        <KpiCard icon="💰" val="₹84,290" label="Revenue this month" delta="18.2% vs last month" deltaType="up" color="var(--accent2)" delay="1" />
        <KpiCard icon="📦" val="342" label="Products analyzed" delta="42 this week" deltaType="up" color="var(--accent)" delay="2" />
        <KpiCard icon="🎯" val="91%" label="Avg confidence score" delta="2.1% improvement" deltaType="up" color="var(--gold)" delay="3" />
        <KpiCard icon="📉" val="8" label="Overpriced SKUs" delta="was 14 last week" deltaType="down" color="var(--accent3)" delay="4" />
      </div>

      <div className="charts-row">
        <div className="card fade-up fade-up-2">
          <div className="card-title"><span className="card-dot" /> Revenue Trend (₹K)</div>
          <MiniBars data={REV_DATA} labels={MONTHS} color="var(--accent)" />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop: 10 }}>
            {MONTHS.map(m => <span key={m} style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--mono)" }}>{m}</span>)}
          </div>
        </div>
        <div className="card fade-up fade-up-3">
          <div className="card-title"><span className="card-dot" style={{background:"var(--accent2)"}} /> Products Analyzed</div>
          <MiniBars data={PRODUCTS_DATA} labels={MONTHS} color="var(--accent2)" />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop: 10 }}>
            {MONTHS.map(m => <span key={m} style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--mono)" }}>{m}</span>)}
          </div>
        </div>
      </div>

      <div className="card fade-up fade-up-4">
        <div className="card-title"><span className="card-dot" style={{background:"var(--gold)"}} /> Recent Activity</div>
        <div className="activity-list">
          {ACTIVITY.map((a, i) => (
            <div className="activity-item" key={i}>
              <div className="act-icon" style={{ background: a.color }}>{a.icon}</div>
              <div className="act-text">
                <div className="act-main">{a.main}</div>
                <div className="act-time">{a.time}</div>
              </div>
              <span className={`tag ${a.bclass}`}>{a.badge}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Profile Tab ───────────────────────────────────────────────── */
function ProfileTab({ user, onSave }) {
  const [form, setForm] = useState({
    firstName: user.name.split(" ")[0] || "",
    lastName: user.name.split(" ")[1] || "",
    email: user.email,
    store: user.store,
    category: "Electronics",
    phone: "+91 98765 43210",
    website: "www.mystore.in",
    gstin: "27AAPFU0939F1ZV",
    bio: "I sell premium electronics and accessories on Amazon & Flipkart. Specialising in cables, power banks, and audio gear.",
    notifications: true,
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <>
      <div className="page-title fade-up">Seller Profile</div>
      <div className="page-sub fade-up fade-up-1">Manage your account info and store details</div>

      <div className="profile-grid">
        {/* Left card */}
        <div className="profile-card fade-up fade-up-1">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">{user.initials}</div>
            <div className="profile-name">{user.name}</div>
            <div className="profile-email">{user.email}</div>
            <div className="profile-plan">✨ Pro Seller</div>
          </div>

          <div className="profile-stats">
            {[
              { val:"342", label:"Products analyzed" },
              { val:"₹84K", label:"Revenue tracked" },
              { val:"91%", label:"Avg confidence" },
              { val:"12", label:"Bulk uploads" },
            ].map(s => (
              <div className="ps-item" key={s.label}>
                <div className="ps-val">{s.val}</div>
                <div className="ps-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:13}}>
              <span style={{color:"var(--muted)"}}>Member since</span>
              <span style={{fontFamily:"var(--mono)", fontSize:12}}>Jan 2025</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:13}}>
              <span style={{color:"var(--muted)"}}>Plan</span>
              <span className="tag tag-purple">Pro</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:13}}>
              <span style={{color:"var(--muted)"}}>API calls left</span>
              <span style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--accent2)"}}>4,820</span>
            </div>
          </div>
        </div>

        {/* Right edit form */}
        <div className="profile-card fade-up fade-up-2">
          <div className="form-section-title">Personal Information</div>
          <div className="edit-row">
            <div className="edit-field"><label>First Name</label><input value={form.firstName} onChange={set("firstName")} /></div>
            <div className="edit-field"><label>Last Name</label><input value={form.lastName} onChange={set("lastName")} /></div>
          </div>
          <div className="edit-row">
            <div className="edit-field"><label>Email</label><input value={form.email} onChange={set("email")} /></div>
            <div className="edit-field"><label>Phone</label><input value={form.phone} onChange={set("phone")} /></div>
          </div>

          <div className="form-section-title" style={{marginTop:24}}>Store Details</div>
          <div className="edit-row">
            <div className="edit-field"><label>Store Name</label><input value={form.store} onChange={set("store")} /></div>
            <div className="edit-field">
              <label>Primary Category</label>
              <select value={form.category} onChange={set("category")}>
                {["Electronics","Home&Kitchen","Fashion","Beauty","Toys&Games","Sports","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="edit-row">
            <div className="edit-field"><label>Website</label><input value={form.website} onChange={set("website")} /></div>
            <div className="edit-field"><label>GSTIN</label><input value={form.gstin} onChange={set("gstin")} /></div>
          </div>
          <div className="edit-field">
            <label>About / Bio</label>
            <textarea value={form.bio} onChange={set("bio")} />
          </div>

          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:20}}>
            <input type="checkbox" id="notif" checked={form.notifications} onChange={set("notifications")} style={{width:16,height:16,accentColor:"var(--accent)"}} />
            <label htmlFor="notif" style={{fontSize:13, color:"var(--muted2)", cursor:"pointer"}}>Email me price alerts and weekly reports</label>
          </div>

          <button className="btn-save" onClick={() => onSave("Profile updated successfully!")}>Save Changes</button>
        </div>
      </div>
    </>
  );
}

/* ─── Analytics Tab ─────────────────────────────────────────────── */
function AnalyticsTab() {
  const cats = ["Electronics","Home&Kitchen","Beauty","Toys&Games","Sports"];
  const vals = [42, 28, 15, 9, 6];
  const max = Math.max(...vals);

  return (
    <>
      <div className="page-title fade-up">Analytics</div>
      <div className="page-sub fade-up fade-up-1">Deep insights into your pricing performance</div>

      <div className="kpi-grid fade-up fade-up-2">
        <KpiCard icon="🎯" val="₹399" label="Avg recommended price" delta="" color="var(--accent)" delay="1" />
        <KpiCard icon="📈" val="+8.3%" label="Avg price increase suggested" delta="" color="var(--accent2)" delay="2" />
        <KpiCard icon="🏆" val="Electronics" label="Most analyzed category" color="var(--gold)" delay="3" />
        <KpiCard icon="⚠️" val="8 SKUs" label="Need urgent repricing" delta="" color="var(--accent3)" delay="4" />
      </div>

      <div className="charts-row">
        <div className="card fade-up fade-up-3">
          <div className="card-title"><span className="card-dot" /> Products by Category</div>
          {cats.map((c,i) => (
            <div key={c} style={{marginBottom:14}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:5}}>
                <span style={{fontSize:13}}>{c}</span>
                <span style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--accent)"}}>{vals[i]}%</span>
              </div>
              <div style={{height:6, background:"var(--border)", borderRadius:3, overflow:"hidden"}}>
                <div style={{height:"100%", width:`${(vals[i]/max)*100}%`, background:"var(--accent)", borderRadius:3, transition:"width 1s ease"}} />
              </div>
            </div>
          ))}
        </div>

        <div className="card fade-up fade-up-4">
          <div className="card-title"><span className="card-dot" style={{background:"var(--accent2)"}} /> Pricing Outcomes</div>
          {[
            { label:"Underpriced (raise price)", val:58, color:"var(--accent2)" },
            { label:"Optimal (no change)", val:27, color:"var(--accent)" },
            { label:"Overpriced (cut price)", val:15, color:"var(--accent3)" },
          ].map(r => (
            <div key={r.label} style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13}}>{r.label}</span>
                <span style={{fontFamily:"var(--mono)",fontSize:12,color:r.color}}>{r.val}%</span>
              </div>
              <div style={{height:6,background:"var(--border)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${r.val}%`,background:r.color,borderRadius:3}} />
              </div>
            </div>
          ))}

          <div style={{marginTop:24, padding:16, background:"var(--bg3)", borderRadius:10}}>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:8}}>ML MODEL PERFORMANCE</div>
            <div style={{display:"flex",gap:24}}>
              <div><div style={{fontFamily:"var(--mono)",fontSize:20,color:"var(--accent2)"}}>6.4%</div><div style={{fontSize:11,color:"var(--muted)"}}>MAPE</div></div>
              <div><div style={{fontFamily:"var(--mono)",fontSize:20,color:"var(--accent)"}}>4,892</div><div style={{fontSize:11,color:"var(--muted)"}}>Training samples</div></div>
              <div><div style={{fontFamily:"var(--mono)",fontSize:20,color:"var(--gold)"}}>14</div><div style={{fontSize:11,color:"var(--muted)"}}>Features</div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Dashboard Shell ────────────────────────────────────────────── */
function Dashboard({ user, onLogout, onSave }) {
  const [activeNav, setActiveNav] = useState("overview");

  const NAV = [
    { id:"overview", label:"Overview" },
    { id:"analytics",  label:"Analytics" },
    { id:"profile",  label:"My Profile" },
  ];

  return (
    <div className="dash-root">
      <style>{css}</style>

      <header className="dash-header">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div className="dash-logo">Rocket<span>Sales</span><span className="dash-badge">AI v2</span></div>
        </div>
        <div className="dash-user">
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-plan">Pro Seller</div>
          </div>
          <div className="user-avatar">{user.initials}</div>
          <button className="btn-logout" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <div className="dash-body">
        <nav className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Main</div>
            {NAV.map(n => (
              <button key={n.id} className={`nav-item${activeNav===n.id?" active":""}`} onClick={() => setActiveNav(n.id)}>
                <span className="nav-icon">{n.icon}</span> {n.label}
              </button>
            ))}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">Tools</div>
            {[
              { id:"single",  label:"Single Predictor" },
              { id:"bulk",  label:"Bulk Analysis", badge:"NEW" },
              { id:"market",  label:"Market Stats" },
            ].map(n => (
              <button key={n.id} className="nav-item" onClick={() => onSave("Launch PriceIQ tools in the main app!")}>
                <span className="nav-icon">{n.icon}</span> {n.label}
                {n.badge && <span className="nav-badge">{n.badge}</span>}
              </button>
            ))}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">Account</div>
            {[
              { label:"Settings" },
              { label:"Billing" },
              { label:"Help & Docs" },
            ].map(n => (
              <button key={n.label} className="nav-item" onClick={() => onSave(`${n.label} — coming soon!`)}>
                <span className="nav-icon">{n.icon}</span> {n.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="dash-content">
          {activeNav === "overview" && <OverviewTab user={user} />}
          {activeNav === "analytics" && <AnalyticsTab />}
          {activeNav === "profile" && <ProfileTab user={user} onSave={onSave} />}
        </main>
      </div>
    </div>
  );
}

/* ─── App Root ───────────────────────────────────────────────────── */
export default function SellerAuth() {
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const handleLogin = (userData) => {
    setUser(userData);
    addToast(`Welcome back, ${userData.name.split(" ")[0]}! 🎉`);
  };

  const handleLogout = () => {
    setUser(null);
    addToast("Signed out successfully.", "success");
  };

  return (
    <>
      {!user
        ? <AuthPage onLogin={handleLogin} />
        : <Dashboard user={user} onLogout={handleLogout} onSave={addToast} />
      }
      <Toast toasts={toasts} />
    </>
  );
}