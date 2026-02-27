import React, { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import "./App.css";

/* ─────────────────────────────────────────
   Constants & Helpers
───────────────────────────────────────── */
const API = "";  // empty = uses CRA proxy to localhost:5000

const ORANGE_PALETTE = [
  "#f97316","#fb923c","#fdba74","#fed7aa",
  "#ea580c","#c2410c","#9a3412","#7c2d12",
  "#ff6b00","#e55100"
];

const fmtK = (n) => {
  if (n == null) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return Number(n).toFixed(0);
};

/* ─────────────────────────────────────────
   Custom Hook
───────────────────────────────────────── */
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(API + url)
      .then((r) => {
        if (!r.ok) throw new Error("Network error");
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [url]);

  return { data, loading, error };
}

/* ─────────────────────────────────────────
   Shared UI Components
───────────────────────────────────────── */
function StatCard({ label, value, icon, accent, sub }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Card({ title, children, className }) {
  return (
    <div className={`card ${className || ""}`}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  );
}

function Loader() {
  return (
    <div className="loader-wrap">
      <div className="loader-ring" />
      <span>Loading data…</span>
    </div>
  );
}

const tooltipStyle = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
};

/* ─────────────────────────────────────────
   Page: Overview
───────────────────────────────────────── */
function Overview() {
  const { data: overview, loading: l1 } = useFetch("/api/overview");
  const { data: byFamily, loading: l2 } = useFetch("/api/sales/by-family");
  const { data: oilData, loading: l3 }  = useFetch("/api/oil");
  const { data: weeklyData }             = useFetch("/api/sales/weekly");

  if (l1 || l2 || l3) return <Loader />;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sales Overview</h1>
        <span className="page-sub">
          {overview?.date_range?.start} → {overview?.date_range?.end}
        </span>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Sales"   value={fmtK(overview?.total_sales)} icon="🛒" accent="#f97316" />
        <StatCard label="Stores"        value={overview?.store_count}        icon="🏪" accent="#fb923c" sub="across Ecuador" />
        <StatCard label="Products"      value={fmtK(overview?.item_count)}   icon="📦" accent="#ea580c" />
        <StatCard label="Data Coverage" value="3+ Years"                     icon="📅" accent="#c2410c" sub="2013 – 2017" />
      </div>

      <div className="grid-2">
        <Card title="Monthly Sales Trend">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={overview?.monthly_trend || []}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="month_year" tick={{ fill: "#666", fontSize: 9 }} interval={4} />
              <YAxis tickFormatter={fmtK} tick={{ fill: "#666", fontSize: 10 }} />
              <Tooltip formatter={(v) => [fmtK(v), "Sales"]}
                contentStyle={tooltipStyle} labelStyle={{ color: "#f97316" }} />
              <Area type="monotone" dataKey="unit_sales"
                stroke="#f97316" fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Avg Sales — Day of Week">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="day" tick={{ fill: "#666", fontSize: 10 }}
                tickFormatter={(v) => v.slice(0, 3)} />
              <YAxis tickFormatter={fmtK} tick={{ fill: "#666", fontSize: 10 }} />
              <Tooltip formatter={(v) => [fmtK(v), "Avg Sales"]}
                contentStyle={tooltipStyle} />
              <Bar dataKey="avg_sales" radius={[4, 4, 0, 0]}>
                {(weeklyData || []).map((_, i) => (
                  <Cell key={i} fill={i >= 5 ? "#f97316" : "#fb923c"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Sales by Product Family (Top 10)">
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={(byFamily || []).slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis type="number" tickFormatter={fmtK} tick={{ fill: "#666", fontSize: 10 }} />
              <YAxis type="category" dataKey="family"
                tick={{ fill: "#ccc", fontSize: 10 }} width={110} />
              <Tooltip formatter={(v) => [fmtK(v), "Sales"]}
                contentStyle={tooltipStyle} />
              <Bar dataKey="total_sales" radius={[0, 4, 4, 0]}>
                {(byFamily || []).slice(0, 10).map((_, i) => (
                  <Cell key={i} fill={ORANGE_PALETTE[i % ORANGE_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Oil Price Trend (Ecuador)">
          <div className="info-note">
            Ecuador is oil-dependent — price shocks directly affect consumer spending
          </div>
          <ResponsiveContainer width="100%" height={235}>
            <LineChart data={(oilData || []).slice(-36)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 9 }} interval={5} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} />
              <Tooltip formatter={(v) => [`$${v}`, "Oil Price"]}
                contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="oil_price"
                stroke="#fdba74" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Page: Stores
───────────────────────────────────────── */
function Stores() {
  const { data: stores, loading: l1 } = useFetch("/api/stores");
  const { data: byCity,  loading: l2 } = useFetch("/api/sales/by-city");
  const [typeFilter, setTypeFilter] = useState("All");

  if (l1 || l2) return <Loader />;

  const types = ["All", ...new Set((stores || []).map((s) => s.type).filter(Boolean))];
  const filtered = (stores || []).filter(
    (s) => typeFilter === "All" || s.type === typeFilter
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Store Analytics</h1>
        <span className="page-sub">54 stores across Ecuador</span>
      </div>

      <div className="grid-2">
        <Card title="Sales Distribution by City">
          <ResponsiveContainer width="100%" height={270}>
            <PieChart>
              <Pie data={byCity || []} dataKey="total_sales" nameKey="city"
                cx="50%" cy="50%" outerRadius={100}
                label={({ city, percent }) =>
                  `${city} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: "#444" }}>
                {(byCity || []).map((_, i) => (
                  <Cell key={i} fill={ORANGE_PALETTE[i % ORANGE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [fmtK(v), "Sales"]}
                contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top 10 Stores by Sales">
          <ResponsiveContainer width="100%" height={270}>
            <BarChart
              data={(stores || [])
                .sort((a, b) => b.total_sales - a.total_sales)
                .slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="store_nbr" tick={{ fill: "#666", fontSize: 10 }}
                tickFormatter={(v) => `S${v}`} />
              <YAxis tickFormatter={fmtK} tick={{ fill: "#666", fontSize: 10 }} />
              <Tooltip formatter={(v) => [fmtK(v), "Sales"]}
                contentStyle={tooltipStyle} />
              <Bar dataKey="total_sales" radius={[4, 4, 0, 0]} fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="All Stores">
        <div className="filter-row">
          {types.map((t) => (
            <button key={t}
              className={`filter-btn ${typeFilter === t ? "active" : ""}`}
              onClick={() => setTypeFilter(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>City</th><th>State</th>
                <th>Type</th><th>Cluster</th><th>Total Sales</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.store_nbr}>
                  <td><span className="store-badge">S{s.store_nbr}</span></td>
                  <td>{s.city}</td>
                  <td>{s.state}</td>
                  <td><span className={`type-tag type-${s.type}`}>{s.type}</span></td>
                  <td>{s.cluster}</td>
                  <td className="num-cell">{fmtK(s.total_sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────
   Page: Forecast
───────────────────────────────────────── */
function Forecast() {
  const [storeNbr, setStoreNbr] = useState(1);
  const [days, setDays]         = useState(16);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);

  const runForecast = () => {
    setLoading(true);
    fetch(`/api/forecast?store_nbr=${storeNbr}&days=${days}`)
      .then((r) => r.json())
      .then((d) => { setResult(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // Run on mount
  useEffect(() => { runForecast(); }, []); // eslint-disable-line

  const preds  = result?.predictions || [];
  const total  = preds.reduce((s, r) => s + r.predicted_sales, 0);
  const peak   = preds.length
    ? preds.reduce((a, b) => (a.predicted_sales > b.predicted_sales ? a : b))
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sales Forecast</h1>
        <span className="page-sub">LightGBM · seasonal + event features</span>
      </div>

      <Card title="Parameters">
        <div className="controls">
          <div className="ctrl-group">
            <label>Store Number</label>
            <input type="number" min={1} max={54} value={storeNbr}
              onChange={(e) => setStoreNbr(Number(e.target.value))}
              className="ctrl-input" />
          </div>
          <div className="ctrl-group">
            <label>Horizon: {days} days</label>
            <input type="range" min={7} max={30} value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="ctrl-range" />
          </div>
          <button className="run-btn" onClick={runForecast} disabled={loading}>
            {loading ? "⏳ Running…" : "▶  Run Forecast"}
          </button>
        </div>
      </Card>

      {loading && <Loader />}

      {!loading && preds.length > 0 && (
        <>
          <div className="stats-grid">
            <StatCard label="Total Projected" value={fmtK(total)}             icon="📈" accent="#f97316" />
            <StatCard label="Daily Average"   value={fmtK(total / days)}      icon="📊" accent="#fb923c" />
            <StatCard label="Peak Day"        value={peak?.date?.slice(5)}     icon="🏆" accent="#ea580c"
              sub={`${fmtK(peak?.predicted_sales)} units`} />
            <StatCard label="Store"           value={`#${storeNbr}`}           icon="🏪" accent="#c2410c"
              sub={`${days}-day window`} />
          </div>

          <Card title={`Forecast — Store ${storeNbr}`}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={preds}>
                <defs>
                  <linearGradient id="fcastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 9 }}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tickFormatter={fmtK} tick={{ fill: "#666", fontSize: 10 }} />
                <Tooltip formatter={(v) => [fmtK(v), "Predicted"]}
                  contentStyle={tooltipStyle} labelStyle={{ color: "#f97316" }} />
                <Area type="monotone" dataKey="predicted_sales"
                  stroke="#f97316" fill="url(#fcastGrad)"
                  strokeWidth={2.5} dot={{ fill: "#f97316", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Daily Breakdown">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Day</th><th>Predicted Sales</th><th>vs Avg</th></tr>
                </thead>
                <tbody>
                  {preds.map((r, i) => {
                    const avg  = total / days;
                    const diff = ((r.predicted_sales - avg) / avg * 100).toFixed(1);
                    const dow  = new Date(r.date).toLocaleDateString("en-US", { weekday: "short" });
                    return (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td>{dow}</td>
                        <td className="num-cell">{fmtK(r.predicted_sales)}</td>
                        <td>
                          <span className={`delta ${Number(diff) >= 0 ? "pos" : "neg"}`}>
                            {Number(diff) >= 0 ? "+" : ""}{diff}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Page: Agent
───────────────────────────────────────── */
function Agent() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "👋 Welcome! I'm the **Favorita Forecasting Agent**.\n\nAsk me anything about store sales, forecasts, economic drivers, or product families.\n\n**Try:**\n• Forecast store 5 sales\n• Which stores perform best?\n• How does oil affect sales?\n• Tell me about the 2016 earthquake\n• Explain the payday effect"
    }
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.response }]);
    } catch {
      setMessages((m) => [...m, {
        role: "assistant",
        text: "❌ Cannot connect to backend. Make sure Flask is running on port 5000."
      }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  // Render **bold** inline
  const renderText = (text) =>
    text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );

  const chips = [
    "Forecast store 1 sales",
    "Which stores perform best?",
    "How does oil affect sales?",
    "Explain the payday effect",
    "Tell me about the 2016 earthquake"
  ];

  return (
    <div className="page agent-page">
      <div className="page-header">
        <h1>AI Forecasting Agent</h1>
        <span className="page-sub">Natural language queries powered by the forecasting engine</span>
      </div>

      <div className="chat-box">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="msg-avatar">{m.role === "assistant" ? "🤖" : "👤"}</div>
              <div className="msg-bubble">
                {m.text.split("\n").map((line, j) => (
                  <p key={j}>{renderText(line)}</p>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg assistant">
              <div className="msg-avatar">🤖</div>
              <div className="msg-bubble typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chips">
          {chips.map((c, i) => (
            <button key={i} className="chip" onClick={() => setInput(c)}>{c}</button>
          ))}
        </div>

        <div className="chat-footer">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about forecasts, sales, economic factors…"
            className="chat-input"
          />
          <button className="send-btn" onClick={send} disabled={loading || !input.trim()}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Root App
───────────────────────────────────────── */
const NAV = [
  { id: "overview", icon: "📊", label: "Overview"  },
  { id: "stores",   icon: "🏪", label: "Stores"    },
  { id: "forecast", icon: "📈", label: "Forecast"  },
  { id: "agent",    icon: "🤖", label: "Agent"     },
];

export default function App() {
  const [page, setPage] = useState("overview");

  return (
    <>
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-name">FAVORITA</div>
          <div className="logo-tag">FORECASTING DASHBOARD</div>
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => setPage(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          Corporación Favorita<br />
          Ecuador · 2013–2017
        </div>
      </aside>

      <main className="main-content">
        {page === "overview" && <Overview />}
        {page === "stores"   && <Stores />}
        {page === "forecast" && <Forecast />}
        {page === "agent"    && <Agent />}
      </main>
    </>
  );
}