import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, ScatterChart, Scatter
} from 'recharts';

const API = 'http://localhost:5000/api';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      '#0B1120',
  surface: '#111827',
  card:    '#1a2236',
  border:  '#1f2f4a',
  accent:  '#22d3a5',
  accent2: '#f59e0b',
  accent3: '#6366f1',
  text:    '#e2e8f0',
  muted:   '#64748b',
};

const FAMILY_COLORS = [
  '#22d3a5','#f59e0b','#6366f1','#f43f5e','#38bdf8','#a3e635','#fb923c','#c084fc'
];

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const r = await fetch(`${API}${path}`);
  return r.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color }) {
  color = color || C.accent;
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '20px 24px',
      flex: 1,
      minWidth: 160,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ color: C.muted, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: C.text, fontSize: 26, fontWeight: 700, fontFamily: 'monospace' }}>
        {value}
      </div>
      {sub && <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      color: C.accent,
      fontSize: 13,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      marginBottom: 16,
      marginTop: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{ width: 18, height: 2, background: C.accent, display: 'inline-block' }} />
      {children}
    </h2>
  );
}

function ChartCard({ title, children, style }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 20,
      ...style
    }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: '#0d1a2d',
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: '10px 14px'
    }}>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload.map(function(p, i) {
        return (
          <div key={i} style={{ color: p.color || C.accent, fontSize: 13, fontFamily: 'monospace' }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ summary, stores, selStore, setSelStore, trend, familySales, topItems, storeComp }) {
  var fmt = function(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); };

  return (
    <div>
      {summary && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <KPICard label="Total Unit Sales"     value={fmt(summary.total_sales)}         color={C.accent} />
          <KPICard label="Total Transactions"   value={fmt(summary.total_transactions)}  color={C.accent2} />
          <KPICard label="Top Product"          value={summary.top_item}  sub="by volume" color={C.accent3} />
          <KPICard label="Top Store"            value={summary.top_store} sub="by volume" color="#f43f5e" />
        </div>
      )}

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: C.muted, fontSize: 13 }}>Filter by store:</span>
        <select
          value={selStore}
          onChange={function(e) { setSelStore(Number(e.target.value)); }}
          style={{
            background: C.card, border: `1px solid ${C.border}`, color: C.text,
            borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
          }}
        >
          {stores.map(function(s) {
            return <option key={s.store_nbr} value={s.store_nbr}>{s.name}</option>;
          })}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <ChartCard title="Monthly Sales Trend" style={{ gridColumn: '1 / -1' }}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="unit_sales" stroke={C.accent} strokeWidth={2}
                dot={{ r: 3, fill: C.accent }} name="Unit Sales" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sales by Product Family">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={familySales}
                dataKey="total_sales"
                nameKey="family"
                cx="50%" cy="50%"
                outerRadius={90}
                label={function(entry) { return entry.family.replace('_', ' '); }}
                labelLine={{ stroke: C.muted }}
                fontSize={10}
              >
                {familySales.map(function(_, i) {
                  return <Cell key={i} fill={FAMILY_COLORS[i % FAMILY_COLORS.length]} />;
                })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Products">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topItems} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis dataKey="item_name" type="category" width={115} tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="unit_sales" fill={C.accent2} radius={[0, 4, 4, 0]} name="Sales" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Store Performance Comparison">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={storeComp}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="unit_sales" radius={[4, 4, 0, 0]} name="Total Sales">
              {storeComp.map(function(_, i) {
                return <Cell key={i} fill={FAMILY_COLORS[i % FAMILY_COLORS.length]} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ── Forecast Tab ──────────────────────────────────────────────────────────────
function ForecastTab({ stores, items, selStore, setSelStore, selItem, setSelItem }) {
  var [fcDays, setFcDays]     = useState(30);
  var [forecast, setForecast] = useState(null);
  var [loading, setLoading]   = useState(false);

  var runForecast = useCallback(function() {
    setLoading(true);
    apiFetch('/forecast?store_nbr=' + selStore + '&item_nbr=' + selItem + '&days=' + fcDays)
      .then(function(d) { setForecast(d); setLoading(false); });
  }, [selStore, selItem, fcDays]);

  var avgFc = forecast
    ? (forecast.forecast.reduce(function(s, r) { return s + r.predicted_sales; }, 0) / forecast.forecast.length).toFixed(2)
    : null;

  return (
    <div>
      <h1 style={{ color: C.accent, fontSize: 22, marginBottom: 6, marginTop: 0 }}>AI Sales Forecasting</h1>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
        Gradient Boosting model — seasonal kharif/rabi patterns, holidays, promotions.
      </p>

      {/* Controls */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 20, marginBottom: 24, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end'
      }}>
        {[
          { label: 'Store', value: selStore, onChange: function(e) { setSelStore(Number(e.target.value)); },
            options: stores.map(function(s) { return { value: s.store_nbr, label: s.name }; }), minWidth: 220 },
          { label: 'Product', value: selItem, onChange: function(e) { setSelItem(Number(e.target.value)); },
            options: items.map(function(it) { return { value: it.item_nbr, label: it.item_name }; }), minWidth: 200 },
          { label: 'Horizon', value: fcDays, onChange: function(e) { setFcDays(Number(e.target.value)); },
            options: [7,14,30,60,90].map(function(d) { return { value: d, label: d + ' days' }; }), minWidth: 120 },
        ].map(function(sel) {
          return (
            <div key={sel.label}>
              <label style={{ color: C.muted, fontSize: 12, display: 'block', marginBottom: 6 }}>{sel.label}</label>
              <select value={sel.value} onChange={sel.onChange} style={{
                background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                borderRadius: 6, padding: '8px 12px', fontSize: 13, minWidth: sel.minWidth,
              }}>
                {sel.options.map(function(o) {
                  return <option key={o.value} value={o.value}>{o.label}</option>;
                })}
              </select>
            </div>
          );
        })}
        <button
          onClick={runForecast}
          disabled={loading}
          style={{
            background: C.accent, color: '#0B1120', border: 'none',
            borderRadius: 6, padding: '9px 24px', fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer', fontSize: 13,
            opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
          }}
        >
          {loading ? 'Running…' : '▶ Run Forecast'}
        </button>
      </div>

      {forecast && (
        <div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <KPICard label="Product"            value={forecast.item_name}  color={C.accent} />
            <KPICard label="Store"              value={forecast.store_name} color={C.accent2} />
            <KPICard label="Forecast Days"      value={fcDays}              color={C.accent3} />
            <KPICard label="Avg Daily Forecast" value={avgFc} sub="units/day" color="#f43f5e" />
          </div>

          <ChartCard title="Actuals vs Forecast" style={{ marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line data={forecast.actuals}  type="monotone" dataKey="unit_sales"
                  stroke={C.accent}  strokeWidth={2} name="Actual"   dot={false} />
                <Line data={forecast.forecast} type="monotone" dataKey="predicted_sales"
                  stroke={C.accent2} strokeWidth={2} strokeDasharray="5 5" name="Forecast" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Forecast table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
              <SectionTitle>Forecast Detail</SectionTitle>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.surface }}>
                    {['Date', 'Predicted Sales', 'Day Trend'].map(function(h) {
                      return (
                        <th key={h} style={{
                          padding: '10px 20px', textAlign: 'left', color: C.muted,
                          fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em'
                        }}>{h}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {forecast.forecast.map(function(row, i) {
                    var prev  = forecast.forecast[i - 1];
                    var delta = prev ? row.predicted_sales - prev.predicted_sales : 0;
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: '9px 20px', color: C.muted, fontFamily: 'monospace' }}>{row.date}</td>
                        <td style={{ padding: '9px 20px', color: C.text,  fontFamily: 'monospace', fontWeight: 600 }}>
                          {row.predicted_sales}
                        </td>
                        <td style={{ padding: '9px 20px', color: delta >= 0 ? C.accent : '#f43f5e' }}>
                          {delta >= 0 ? '▲ +' + delta.toFixed(2) : '▼ ' + delta.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stores Tab ────────────────────────────────────────────────────────────────
function StoresTab({ stores }) {
  return (
    <div>
      <h1 style={{ color: C.accent, fontSize: 22, marginBottom: 20, marginTop: 0 }}>Store Directory</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
        {stores.map(function(s) {
          return (
            <div key={s.store_nbr} style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 20,
              borderLeft: `4px solid ${FAMILY_COLORS[s.store_nbr % FAMILY_COLORS.length]}`
            }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{s.name}</div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>{s.city}, {s.state}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['Type', s.type], ['Cluster', s.cluster]].map(function(kv) {
                  return (
                    <span key={kv[0]} style={{
                      background: C.surface, border: `1px solid ${C.border}`,
                      borderRadius: 4, padding: '3px 8px', fontSize: 11, color: C.muted,
                    }}>
                      {kv[0]}: <strong style={{ color: C.text }}>{kv[1]}</strong>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Items Tab ─────────────────────────────────────────────────────────────────
var FAMILIES = ['WSF_FERTILIZER','STRAIGHT_FERT','MICRONUTRIENT','SOIL_AMENDMENT','FERTIGATION','LIQUID_FOLIAR'];

function ItemsTab({ items }) {
  return (
    <div>
      <h1 style={{ color: C.accent, fontSize: 22, marginBottom: 20, marginTop: 0 }}>Product Catalog</h1>
      <div style={{ overflowX: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              {['#', 'Product Name', 'Family', 'Class', 'Perishable'].map(function(h) {
                return (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', color: C.muted,
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '0.06em', whiteSpace: 'nowrap'
                  }}>{h}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.map(function(it, i) {
              var fi    = FAMILIES.indexOf(it.family);
              var color = FAMILY_COLORS[fi % FAMILY_COLORS.length];
              return (
                <tr key={it.item_nbr} style={{
                  borderTop: `1px solid ${C.border}`,
                  background: i % 2 === 0 ? 'transparent' : C.surface + '40'
                }}>
                  <td style={{ padding: '10px 16px', color: C.muted, fontFamily: 'monospace' }}>{it.item_nbr}</td>
                  <td style={{ padding: '10px 16px', color: C.text, fontWeight: 500 }}>{it.item_name}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      background: color + '30', color: color,
                      borderRadius: 4, padding: '2px 8px', fontSize: 11
                    }}>
                      {it.family.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: C.muted, fontFamily: 'monospace' }}>{it.class}</td>
                  <td style={{ padding: '10px 16px', color: it.perishable ? C.accent2 : C.muted }}>
                    {it.perishable ? '⚡ Yes (1.25×)' : 'No'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Evaluation Tab ────────────────────────────────────────────────────────────
function MetricBadge({ label, value, unit, color, description }) {
  color = color || C.accent;
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '18px 22px', flex: 1, minWidth: 150,
      borderTop: '3px solid ' + color, position: 'relative',
    }}>
      <div style={{ color: C.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: color, fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>
        {value}<span style={{ fontSize: 13, color: C.muted, marginLeft: 3 }}>{unit}</span>
      </div>
      {description && (
        <div style={{ color: C.muted, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{description}</div>
      )}
    </div>
  );
}

function EvalSection({ title, children, style }) {
  return (
    <div style={{
      background: C.card, border: '1px solid ' + C.border,
      borderRadius: 12, padding: 20, marginBottom: 20,
      width: '100%', boxSizing: 'border-box',
      ...style,
    }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function EvaluationTab() {
  var [data, setData]       = useState(null);
  var [loading, setLoading] = useState(false);
  var [loaded, setLoaded]   = useState(false);

  function load() {
    setLoading(true);
    apiFetch('/evaluation').then(function(d) {
      setData(d);
      setLoading(false);
      setLoaded(true);
    });
  }

  // Score label helpers
  function r2Label(v) {
    if (v >= 0.9) return { text: 'Excellent', color: C.accent };
    if (v >= 0.75) return { text: 'Good', color: C.accent2 };
    if (v >= 0.5) return { text: 'Moderate', color: '#fb923c' };
    return { text: 'Poor', color: '#f43f5e' };
  }
  function mapeLabel(v) {
    if (v <= 10) return { text: 'Excellent', color: C.accent };
    if (v <= 20) return { text: 'Good', color: C.accent2 };
    if (v <= 35) return { text: 'Acceptable', color: '#fb923c' };
    return { text: 'Poor', color: '#f43f5e' };
  }

  if (!loaded) {
    return (
      <div>
        <h1 style={{ color: C.accent, fontSize: 22, marginBottom: 6, marginTop: 0 }}>Model Evaluation</h1>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>
          Runs time-based train/validation split, cross-validation, residual analysis, and feature importance.
        </p>
        <div style={{
          background: C.card, border: '1px solid ' + C.border, borderRadius: 12,
          padding: 40, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔬</div>
          <div style={{ color: C.text, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Ready to evaluate the model
          </div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 24, maxWidth: 460, margin: '0 auto 24px' }}>
            Clicking below will run the full evaluation pipeline:
            80/20 time split · 5-fold cross-validation · residual analysis · feature importance
          </div>
          <button onClick={load} disabled={loading} style={{
            background: C.accent, color: '#0B1120', border: 'none',
            borderRadius: 6, padding: '10px 28px', fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer', fontSize: 14, fontFamily: 'inherit',
          }}>
            {loading ? '⏳ Evaluating…' : '▶ Run Evaluation'}
          </button>
        </div>
      </div>
    );
  }

  var m  = data.metrics;
  var cv = data.cross_validation;
  var r2Info   = r2Label(m.r2);
  var mapeInfo = mapeLabel(m.mape);

  // Prepare feature importance for chart (top 10)
  var fiData = data.feature_importance.slice(0, 10).map(function(f) {
    return { feature: f.feature, importance: +(f.importance * 100).toFixed(2) };
  });

  // CV folds for grouped bar chart
  var cvData = cv.folds.map(function(f) {
    return { fold: 'Fold ' + f.fold, MAE: f.mae, RMSE: f.rmse, R2: +(f.r2 * 100).toFixed(1) };
  });

  return (
    <div>
      <h1 style={{ color: C.accent, fontSize: 22, marginBottom: 4, marginTop: 0 }}>Model Evaluation</h1>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
        Validation set: {data.split.val_start} → {data.split.val_end} &nbsp;·&nbsp;
        {data.split.val_rows} rows &nbsp;·&nbsp; Strategy: {data.split.split_strategy}
      </p>

      {/* ── Core Metrics ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap', width: '100%' }}>
        <MetricBadge
          label="MAE" value={m.mae} color={C.accent}
          description="Mean Absolute Error — average units off per prediction"
        />
        <MetricBadge
          label="RMSE" value={m.rmse} color={C.accent2}
          description="Root Mean Squared Error — penalises large errors more"
        />
        <MetricBadge
          label="R² Score" value={m.r2} color={r2Info.color}
          description={'Variance explained · ' + r2Info.text}
        />
        <MetricBadge
          label="MAPE" value={m.mape.toFixed(2)} unit="%" color={mapeInfo.color}
          description={'Mean Absolute % Error · ' + mapeInfo.text}
        />
        <MetricBadge
          label="NWRMSLE" value={m.nwrmsle} color={C.accent3}
          description="Competition metric — weighted log error (perishable 1.25×)"
        />
      </div>

      {/* ── Train / Val Split info ── */}
      <EvalSection title="Train / Validation Split">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', width: '100%' }}>
          {[
            ['Split Ratio',    data.split.split_ratio],
            ['Strategy',       data.split.split_strategy],
            ['Train Rows',     data.split.train_rows],
            ['Val Rows',       data.split.val_rows],
            ['Train Ends',     data.split.train_cutoff],
            ['Val Period',     data.split.val_start + ' → ' + data.split.val_end],
          ].map(function(kv) {
            return (
              <div key={kv[0]} style={{
                background: C.surface, border: '1px solid ' + C.border,
                borderRadius: 8, padding: '10px 16px', minWidth: 170, flex: 1,
              }}>
                <div style={{ color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {kv[0]}
                </div>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
                  {kv[1]}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 14, lineHeight: 1.7 }}>
          <strong style={{ color: C.accent2 }}>Why time-based split?</strong> — A random split would leak future information into the training set.
          By cutting at the 80th percentile date, the model is trained only on past data and validated on future data, exactly as it would work in production.
        </div>
      </EvalSection>

      {/* ── Actual vs Predicted ── */}
      <EvalSection title="Actual vs Predicted (Validation Sample)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.actual_vs_predicted}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} interval={14} />
            <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="actual"    stroke={C.accent}  strokeWidth={2} dot={false} name="Actual" />
            <Line type="monotone" dataKey="predicted" stroke={C.accent2} strokeWidth={2} dot={false} strokeDasharray="4 4" name="Predicted" />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 10 }}>
          A well-fitted model tracks the actual line closely. Consistent gaps indicate systematic bias; random gaps are acceptable noise.
        </div>
      </EvalSection>

      {/* ── Error Distribution + Residuals by Month ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, width: '100%' }}>
        <EvalSection title="Error Distribution" style={{ marginBottom: 0 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.error_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="bucket" tick={{ fill: C.muted, fontSize: 11 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4,4,0,0]} name="Rows">
                {data.error_distribution.map(function(_, i) {
                  return <Cell key={i} fill={FAMILY_COLORS[i % FAMILY_COLORS.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>
            Absolute error buckets (units). Majority of errors in 0–1 range = model is stable.
          </div>
        </EvalSection>

        <EvalSection title="Residuals by Month" style={{ marginBottom: 0 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.residuals_by_month}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="mean_residual" name="Mean Residual" radius={[4,4,0,0]}>
                {data.residuals_by_month.map(function(row, i) {
                  return <Cell key={i} fill={row.mean_residual >= 0 ? C.accent : '#f43f5e'} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>
            Green = model under-predicts · Red = model over-predicts. Ideal: bars near zero with no consistent pattern.
          </div>
        </EvalSection>
      </div>

      {/* ── Feature Importance ── */}
      <EvalSection title="Feature Importance (Top 10)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={fiData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
            <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} unit="%" />
            <YAxis dataKey="feature" type="category" width={120} tick={{ fill: C.muted, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="importance" name="Importance %" radius={[0,4,4,0]}>
              {fiData.map(function(_, i) {
                return <Cell key={i} fill={FAMILY_COLORS[i % FAMILY_COLORS.length]} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 10 }}>
          Importance = how much each feature reduces prediction error across all 120 trees.
          High <strong style={{ color: C.text }}>item_nbr</strong> and <strong style={{ color: C.text }}>store_nbr</strong> means
          individual product and store identity drives sales more than calendar features.
        </div>
      </EvalSection>

      {/* ── Cross Validation ── */}
      <EvalSection title="5-Fold Time-Series Cross-Validation">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cvData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="fold" tick={{ fill: C.muted, fontSize: 11 }} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="MAE"  fill={C.accent}  radius={[3,3,0,0]} />
            <Bar dataKey="RMSE" fill={C.accent2} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', width: '100%' }}>
          {[
            ['Mean MAE',  cv.mean_mae,  C.accent],
            ['Mean RMSE', cv.mean_rmse, C.accent2],
            ['Mean R²',   cv.mean_r2,   C.accent3],
            ['Std MAE',   cv.std_mae,   C.muted],
          ].map(function(item) {
            return (
              <div key={item[0]} style={{
                background: C.surface, border: '1px solid ' + C.border,
                borderRadius: 8, padding: '10px 16px', textAlign: 'center', flex: 1, minWidth: 110,
              }}>
                <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {item[0]}
                </div>
                <div style={{ color: item[2], fontFamily: 'monospace', fontWeight: 700, fontSize: 18 }}>
                  {item[1]}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 14, lineHeight: 1.7 }}>
          <strong style={{ color: C.accent2 }}>Why TimeSeriesSplit?</strong> — Each fold trains on earlier dates and validates on later dates.
          This mimics real deployment. A low <strong style={{ color: C.text }}>Std MAE ({cv.std_mae})</strong> means the model performs
          consistently across different time periods — it has not overfit to one particular season.
        </div>
      </EvalSection>

      {/* ── Per-Family and Per-Store MAE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, width: '100%' }}>
        <EvalSection title="MAE by Product Family">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.family_mae} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis dataKey="family" type="category" width={115} tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="mae" name="MAE" radius={[0,4,4,0]}>
                {data.family_mae.map(function(_, i) {
                  return <Cell key={i} fill={FAMILY_COLORS[i % FAMILY_COLORS.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>
            Higher MAE for a family = harder to forecast (volatile demand or few training samples).
          </div>
        </EvalSection>

        <EvalSection title="MAE by Store">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.store_mae}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 9 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="mae" name="MAE" radius={[4,4,0,0]}>
                {data.store_mae.map(function(_, i) {
                  return <Cell key={i} fill={FAMILY_COLORS[i % FAMILY_COLORS.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>
            Stores with more training rows generally show lower MAE due to more learned patterns.
          </div>
        </EvalSection>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  var [summary,     setSummary]     = useState(null);
  var [stores,      setStores]      = useState([]);
  var [items,       setItems]       = useState([]);
  var [trend,       setTrend]       = useState([]);
  var [familySales, setFamily]      = useState([]);
  var [topItems,    setTopItems]    = useState([]);
  var [storeComp,   setStoreComp]   = useState([]);
  var [selStore,    setSelStore]    = useState(1);
  var [selItem,     setSelItem]     = useState(1);
  var [activeTab,   setActiveTab]   = useState('dashboard');

  useEffect(function() {
    apiFetch('/summary').then(setSummary);
    apiFetch('/stores').then(setStores);
    apiFetch('/items').then(setItems);
    apiFetch('/sales_by_family').then(setFamily);
    apiFetch('/store_comparison').then(setStoreComp);
  }, []);

  useEffect(function() {
    apiFetch('/sales_trend?store_nbr=' + selStore).then(function(d) {
      var weekly = {};
      d.forEach(function(row) {
        var wk = row.date.slice(0, 7);
        weekly[wk] = (weekly[wk] || 0) + row.unit_sales;
      });
      setTrend(Object.entries(weekly).map(function(kv) {
        return { date: kv[0], unit_sales: +kv[1].toFixed(2) };
      }));
    });
    apiFetch('/top_items?store_nbr=' + selStore).then(setTopItems);
  }, [selStore]);

  var TABS = ['dashboard', 'forecast', 'evaluation', 'stores', 'items'];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '0 32px', display: 'flex', alignItems: 'center', gap: 32,
        height: 60, position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, background: C.accent, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>🌿</div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>
              Richfield Fertilisers
            </div>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: '0.06em' }}>
              FORECAST INTELLIGENCE
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {TABS.map(function(t) {
            return (
              <button
                key={t}
                onClick={function() { setActiveTab(t); }}
                style={{
                  background: activeTab === t ? C.accent + '20' : 'transparent',
                  border: activeTab === t ? `1px solid ${C.accent}40` : '1px solid transparent',
                  color: activeTab === t ? C.accent : C.muted,
                  borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
                  fontSize: 13, textTransform: 'capitalize', fontFamily: 'inherit',
                }}
              >{t}</button>
            );
          })}
        </nav>

        {summary && (
          <div style={{ color: C.muted, fontSize: 11 }}>
            {summary.date_range.start} → {summary.date_range.end}
          </div>
        )}
      </header>

      {/* Main content */}
      <main style={{ padding: '28px 32px', maxWidth: '100%', width: '100%', boxSizing: 'border-box' }}>
        {activeTab === 'dashboard' && (
          <DashboardTab
            summary={summary} stores={stores}
            selStore={selStore} setSelStore={setSelStore}
            trend={trend} familySales={familySales}
            topItems={topItems} storeComp={storeComp}
          />
        )}
        {activeTab === 'forecast' && (
          <ForecastTab
            stores={stores} items={items}
            selStore={selStore} setSelStore={setSelStore}
            selItem={selItem}  setSelItem={setSelItem}
          />
        )}
        {activeTab === 'evaluation' && <EvaluationTab />}
        {activeTab === 'stores'     && <StoresTab stores={stores} />}
        {activeTab === 'items'    && <ItemsTab  items={items}   />}
      </main>
    </div>
  );
}