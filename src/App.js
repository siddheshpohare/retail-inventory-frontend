import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API = "http://localhost:5000/api";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#0B1120",
  surface: "#111827",
  card:    "#1a2236",
  border:  "#1f2f4a",
  accent:  "#22d3a5",
  accent2: "#f59e0b",
  accent3: "#6366f1",
  text:    "#e2e8f0",
  muted:   "#64748b",
};

const FAMILY_COLORS = [
  "#22d3a5","#f59e0b","#6366f1","#f43f5e","#38bdf8","#a3e635","#fb923c","#c084fc"
];

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const r = await fetch(`${API}${path}`);
  return r.json();
}

// ── Components ────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color = C.accent }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "20px 24px", flex: 1, minWidth: 160,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ color: C.muted, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ color: C.text, fontSize: 26, fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      color: C.accent, fontSize: 13, letterSpacing: "0.15em",
      textTransform: "uppercase", marginBottom: 16, marginTop: 0,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ width: 18, height: 2, background: C.accent, display: "inline-block" }} />
      {children}
    </h2>
  );
}

function ChartCard({ title, children, style = {} }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: 20, ...style
    }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1a2d", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.accent, fontSize: 13, fontFamily: "monospace" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [summary, setSummary]       = useState(null);
  const [stores, setStores]         = useState([]);
  const [items, setItems]           = useState([]);
  const [trend, setTrend]           = useState([]);
  const [familySales, setFamily]    = useState([]);
  const [topItems, setTopItems]     = useState([]);
  const [storeComp, setStoreComp]   = useState([]);
  const [forecast, setForecast]     = useState(null);
  const [selStore, setSelStore]     = useState(1);
  const [selItem, setSelItem]       = useState(1);
  const [fcDays, setFcDays]         = useState(30);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState("dashboard");

  useEffect(() => {
    apiFetch("/summary").then(setSummary);
    apiFetch("/stores").then(setStores);
    apiFetch("/items").then(setItems);
    apiFetch("/sales_by_family").then(setFamily);
    apiFetch("/store_comparison").then(setStoreComp);
  }, []);

  useEffect(() => {
    apiFetch(`/sales_trend?store_nbr=${selStore}`).then(d => {
      // aggregate by week for readability
      const weekly = {};
      d.forEach(row => {
        const wk = row.date.slice(0, 7); // month grouping
        weekly[wk] = (weekly[wk] || 0) + row.unit_sales;
      });
      setTrend(Object.entries(weekly).map(([k, v]) => ({ date: k, unit_sales: +v.toFixed(2) })));
    });
    apiFetch(`/top_items?store_nbr=${selStore}`).then(setTopItems);
  }, [selStore]);

  const runForecast = useCallback(() => {
    setLoading(true);
    apiFetch(`/forecast?store_nbr=${selStore}&item_nbr=${selItem}&days=${fcDays}`)
      .then(d => { setForecast(d); setLoading(false); });
  }, [selStore, selItem, fcDays]);

  const fmt = n => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  const tabs = ["dashboard", "forecast", "stores", "items"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 32px", display: "flex", alignItems: "center", gap: 32, height: 60,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 6,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize: 16 }}>🌿</div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Richfield Fertilisers</div>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.06em" }}>FORECAST INTELLIGENCE</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              background: activeTab === t ? C.accent + "20" : "transparent",
              border: activeTab === t ? `1px solid ${C.accent}40` : "1px solid transparent",
              color: activeTab === t ? C.accent : C.muted,
              borderRadius: 6, padding: "6px 14px", cursor: "pointer",
              fontSize: 13, textTransform: "capitalize", fontFamily: "inherit",
            }}>{t}</button>
          ))}
        </nav>
        {summary && (
          <div style={{ color: C.muted, fontSize: 11 }}>
            {summary.date_range.start} → {summary.date_range.end}
          </div>
        )}
      </header>

      <main style={{ padding: "20px 16px", maxWidth: "100%", margin: "0 auto" }}>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <>
            {/* KPI row */}
            {summary && (
              <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
                <KPICard label="Total Unit Sales" value={fmt(summary.total_sales)} color={C.accent} />
                <KPICard label="Total Transactions" value={fmt(summary.total_transactions)} color={C.accent2} />
                <KPICard label="Top Product" value={summary.top_item} sub="by volume" color={C.accent3} />
                <KPICard label="Top Store" value={summary.top_store} sub="by volume" color="#f43f5e" />
              </div>
            )}

            {/* Store selector */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: C.muted, fontSize: 13 }}>Filter by store:</span>
              <select value={selStore} onChange={e => setSelStore(+e.target.value)} style={{
                background: C.card, border: `1px solid ${C.border}`, color: C.text,
                borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer",
              }}>
                {stores.map(s => <option key={s.store_nbr} value={s.store_nbr}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 }}>
              {/* Monthly trend */}
              <ChartCard title="Monthly Sales Trend">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                    <Tooltip content={customTooltip} />
                    <Line type="monotone" dataKey="unit_sales" stroke={C.accent} strokeWidth={2}
                      dot={{ r: 3, fill: C.accent }} name="Unit Sales" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Family pie */}
              <ChartCard title="Sales by Product Family">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={familySales} dataKey="total_sales" nameKey="family"
                      cx="50%" cy="50%" outerRadius={85} label={({ family, percent }) =>
                        `${family.replace("_"," ")}: ${(percent*100).toFixed(0)}%`}
                      labelLine={{ stroke: C.muted }} fontSize={10} fill={C.accent}>
                      {familySales.map((_, i) => <Cell key={i} fill={FAMILY_COLORS[i % FAMILY_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={customTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Top items */}
              <ChartCard title="Top 10 Products">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topItems} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                    <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} />
                    <YAxis dataKey="item_name" type="category" width={110}
                      tick={{ fill: C.muted, fontSize: 10 }} />
                    <Tooltip content={customTooltip} />
                    <Bar dataKey="unit_sales" fill={C.accent2} radius={[0,4,4,0]} name="Sales" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Store comparison */}
            <ChartCard title="Store Performance Comparison">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={storeComp}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip content={customTooltip} />
                  <Bar dataKey="unit_sales" radius={[4,4,0,0]} name="Total Sales">
                    {storeComp.map((_, i) => <Cell key={i} fill={FAMILY_COLORS[i % FAMILY_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}

        {/* ── FORECAST TAB ── */}
        {activeTab === "forecast" && (
          <div>
            <h1 style={{ color: C.accent, fontSize: 22, marginBottom: 6, marginTop: 0 }}>
              AI Sales Forecasting
            </h1>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
              Gradient Boosting model trained on seasonal patterns, holidays, and promotion data.
            </p>

            {/* Controls */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 20, marginBottom: 24,
              display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end"
            }}>
              <div>
                <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Store</label>
                <select value={selStore} onChange={e => setSelStore(+e.target.value)} style={{
                  background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                  borderRadius: 6, padding: "8px 12px", fontSize: 13, minWidth: 220,
                }}>
                  {stores.map(s => <option key={s.store_nbr} value={s.store_nbr}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Product</label>
                <select value={selItem} onChange={e => setSelItem(+e.target.value)} style={{
                  background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                  borderRadius: 6, padding: "8px 12px", fontSize: 13, minWidth: 200,
                }}>
                  {items.map(it => <option key={it.item_nbr} value={it.item_nbr}>{it.item_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Forecast Horizon</label>
                <select value={fcDays} onChange={e => setFcDays(+e.target.value)} style={{
                  background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                  borderRadius: 6, padding: "8px 12px", fontSize: 13,
                }}>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              <button onClick={runForecast} disabled={loading} style={{
                background: C.accent, color: "#0B1120", border: "none",
                borderRadius: 6, padding: "9px 24px", fontWeight: 700, cursor: loading ? "wait" : "pointer",
                fontSize: 13, opacity: loading ? 0.7 : 1, fontFamily: "inherit",
              }}>
                {loading ? "Running…" : "▶ Run Forecast"}
              </button>
            </div>

            {forecast && (
              <>
                <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
                  <KPICard label="Product" value={forecast.item_name} color={C.accent} />
                  <KPICard label="Store" value={forecast.store_name} color={C.accent2} />
                  <KPICard label="Forecast Days" value={fcDays} color={C.accent3} />
                  <KPICard label="Avg Daily Forecast"
                    value={(forecast.forecast.reduce((s,r) => s + r.predicted_sales, 0) / forecast.forecast.length).toFixed(2)}
                    sub="units/day" color="#f43f5e" />
                </div>

                <ChartCard title="Actuals vs Forecast">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} />
                      <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
                      <Tooltip content={customTooltip} />
                      <Legend />
                      <Line data={forecast.actuals} type="monotone" dataKey="unit_sales"
                        stroke={C.accent} strokeWidth={2} name="Actual" dot={false} />
                      <Line data={forecast.forecast} type="monotone" dataKey="predicted_sales"
                        stroke={C.accent2} strokeWidth={2} strokeDasharray="5 5" name="Forecast" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Forecast table */}
                <div style={{ marginTop: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
                    <SectionTitle>Forecast Detail</SectionTitle>
                  </div>
                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: C.surface }}>
                          {["Date","Predicted Sales","Trend"].map(h => (
                            <th key={h} style={{ padding: "10px 20px", textAlign: "left", color: C.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {forecast.forecast.map((row, i) => {
                          const prev = forecast.forecast[i - 1];
                          const delta = prev ? row.predicted_sales - prev.predicted_sales : 0;
                          return (
                            <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                              <td style={{ padding: "9px 20px", color: C.muted, fontFamily: "monospace" }}>{row.date}</td>
                              <td style={{ padding: "9px 20px", color: C.text, fontFamily: "monospace", fontWeight: 600 }}>{row.predicted_sales}</td>
                              <td style={{ padding: "9px 20px", color: delta >= 0 ? C.accent : "#f43f5e" }}>
                                {delta >= 0 ? `▲ +${delta.toFixed(2)}` : `▼ ${delta.toFixed(2)}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STORES TAB ── */}
        {activeTab === "stores" && (
          <div>
            <h1 style={{ color: C.accent, fontSize: 22, marginBottom: 20, marginTop: 0 }}>Store Directory</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 16 }}>
              {stores.map(s => (
                <div key={s.store_nbr} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: 20,
                  borderLeft: `4px solid ${FAMILY_COLORS[s.store_nbr % FAMILY_COLORS.length]}`
                }}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{s.name}</div>
                  <div style={{ color: C.muted, fontSize: 13 }}>{s.city}, {s.state}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {[["Type", s.type], ["Cluster", s.cluster]].map(([k, v]) => (
                      <span key={k} style={{
                        background: C.surface, border: `1px solid ${C.border}`,
                        borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.muted
                      }}>{k}: <strong style={{ color: C.text }}>{v}</strong></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ITEMS TAB ── */}
        {activeTab === "items" && (
          <div>
            <h1 style={{ color: C.accent, fontSize: 22, marginBottom: 20, marginTop: 0 }}>Product Catalog</h1>
            <div style={{ overflowX: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.surface }}>
                    {["#","Product Name","Family","Class","Perishable"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.item_nbr} style={{ borderTop: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : C.surface + "40" }}>
                      <td style={{ padding: "10px 16px", color: C.muted, fontFamily: "monospace" }}>{it.item_nbr}</td>
                      <td style={{ padding: "10px 16px", color: C.text, fontWeight: 500 }}>{it.item_name}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{
                          background: FAMILY_COLORS[
                            ["WSF_FERTILIZER","STRAIGHT_FERT","MICRONUTRIENT","SOIL_AMENDMENT","FERTIGATION","LIQUID_FOLIAR"]
                              .indexOf(it.family) % FAMILY_COLORS.length] + "30",
                          color: FAMILY_COLORS[
                            ["WSF_FERTILIZER","STRAIGHT_FERT","MICRONUTRIENT","SOIL_AMENDMENT","FERTIGATION","LIQUID_FOLIAR"]
                              .indexOf(it.family) % FAMILY_COLORS.length],
                          borderRadius: 4, padding: "2px 8px", fontSize: 11
                        }}>{it.family.replace("_"," ")}</span>
                      </td>
                      <td style={{ padding: "10px 16px", color: C.muted, fontFamily: "monospace" }}>{it.class}</td>
                      <td style={{ padding: "10px 16px", color: it.perishable ? C.accent2 : C.muted }}>
                        {it.perishable ? "⚡ Yes (1.25×)" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}