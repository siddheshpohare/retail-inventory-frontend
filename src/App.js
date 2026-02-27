import React, { useState, useEffect } from 'react';
import { 
  Store, Tag, Percent, Truck, Search, 
  Cpu, Terminal, Activity, AlertCircle 
} from 'lucide-react';

/**
 * ENVIRONMENT FIX:
 * If you see a Tailwind CSS PostCSS error, it's because your project is 
 * trying to compile Tailwind in 'index.css'. 
 * FIX: Delete the contents of your 'src/index.css' file.
 * This App uses INLINE STYLES and does not require Tailwind configuration.
 */

// Sample data inspired by Rossmann Dataset
const ROSSMANN_STORES = [
  { id: 101, type: 'a', assortment: 'a', compDist: 1270, sales: 5263, stock: 45 },
  { id: 102, type: 'c', assortment: 'a', compDist: 590, sales: 6710, stock: 80 },
  { id: 103, type: 'd', assortment: 'c', compDist: 24130, sales: 4200, stock: 20 },
];

export default function App() {
  const [stores, setStores] = useState(ROSSMANN_STORES);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- Inline Styles Object ---
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    header: {
      maxWidth: '1200px',
      margin: '0 auto 2.5rem auto',
    },
    headerTitleBox: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '0.5rem',
    },
    iconBox: {
      padding: '0.5rem',
      backgroundColor: '#ef4444',
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: '900',
      textTransform: 'uppercase',
      fontStyle: 'italic',
      margin: 0,
      letterSpacing: '-0.025em',
    },
    subtitle: {
      color: '#94a3b8',
      fontSize: '0.875rem',
      margin: 0,
    },
    mainGrid: {
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '2rem',
    },
    storeList: {
      gridColumn: 'span 2',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    sectionLabel: {
      fontSize: '0.75rem',
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.2em',
      marginBottom: '1rem',
    },
    storeCard: {
      backgroundColor: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid #334155',
      padding: '1.5rem',
      borderRadius: '1rem',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      transition: 'border-color 0.2s',
    },
    storeInfoGroup: {
      display: 'flex',
      gap: '1.5rem',
    },
    infoItem: {
      display: 'flex',
      flexDirection: 'column',
    },
    infoLabel: {
      fontSize: '0.625rem',
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      marginBottom: '0.25rem',
    },
    infoValue: {
      fontSize: '1.125rem',
      fontWeight: '900',
    },
    tag: {
      fontSize: '0.75rem',
      fontWeight: 'bold',
      backgroundColor: '#1e293b',
      padding: '0.25rem 0.5rem',
      borderRadius: '0.25rem',
    },
    compDist: {
      fontSize: '0.875rem',
      fontWeight: 'bold',
      color: '#fb923c',
    },
    actionGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
    },
    stockValue: (low) => ({
      fontSize: '1.25rem',
      fontWeight: '900',
      color: low ? '#ef4444' : '#10b981',
    }),
    button: {
      backgroundColor: '#ffffff',
      color: '#000000',
      padding: '0.5rem 1rem',
      borderRadius: '0.75rem',
      fontWeight: 'bold',
      fontSize: '0.875rem',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      transition: 'all 0.2s',
    },
    console: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      border: '1px solid #334155',
      borderRadius: '1.5rem',
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    consoleHeader: {
      padding: '1rem',
      borderBottom: '1px solid #334155',
      backgroundColor: 'rgba(30, 41, 59, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    consoleTitle: {
      fontSize: '0.625rem',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: '#94a3b8',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    logArea: {
      flex: 1,
      overflowY: 'auto',
      padding: '1rem',
      fontFamily: 'monospace',
      fontSize: '0.6875rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    },
    logItem: (type) => ({
      paddingBottom: '0.5rem',
      borderBottom: '1px solid rgba(15, 23, 42, 0.5)',
      color: type === 'error' ? '#f87171' : type === 'success' ? '#34d399' : '#cbd5e1',
    }),
    timestamp: {
      opacity: 0.4,
      marginRight: '0.5rem',
    }
  };

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [{ t: new Date().toLocaleTimeString(), m: msg, type }, ...prev].slice(0, 20));
  };

  const runAIOptimization = async (store) => {
    setLoading(true);
    addLog(`Initiating CrewAI for Rossmann Store ${store.id}...`);
    
    try {
      const response = await fetch('http://localhost:8000/process-store-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: store.id,
          store_type: store.type,
          assortment: store.assortment,
          current_sales: store.sales,
          competition_dist: store.compDist,
          stock_level: store.stock
        }),
      });
      
      const data = await response.json();
      addLog(`AI Result: ${data.ai_report.substring(0, 100)}...`, 'success');
      
      if (data.ai_report.toLowerCase().includes('restock') || data.ai_report.toLowerCase().includes('increase')) {
        setStores(prev => prev.map(s => s.id === store.id ? { ...s, stock: s.stock + 50 } : s));
      }
    } catch (err) {
      addLog("Connection failed. Is the Python backend running?", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerTitleBox}>
          <div style={styles.iconBox}><Store size={24} color="white"/></div>
          <h1 style={styles.title}>Rossmann Multi-Agent System</h1>
        </div>
        <p style={styles.subtitle}>Optimizing {ROSSMANN_STORES.length} stores using CrewAI & Ollama</p>
      </header>

      <main style={styles.mainGrid}>
        <div style={styles.storeList}>
          <h2 style={styles.sectionLabel}>Active Rossmann Outlets</h2>
          {stores.map(store => (
            <div key={store.id} style={styles.storeCard} className="store-card-hover">
              <div style={styles.storeInfoGroup}>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Store ID</div>
                  <div style={styles.infoValue}>#{store.id}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Type / Assortment</div>
                  <div style={styles.tag}>Type {store.type} / Level {store.assortment}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Competition</div>
                  <div style={styles.compDist}>{store.compDist}m</div>
                </div>
              </div>

              <div style={styles.actionGroup}>
                <div style={{ textAlign: 'right' }}>
                  <div style={styles.infoLabel}>Stock Level</div>
                  <div style={styles.stockValue(store.stock < 30)}>
                    {store.stock}
                  </div>
                </div>
                <button 
                  onClick={() => runAIOptimization(store)}
                  disabled={loading}
                  style={{
                    ...styles.button,
                    opacity: loading ? 0.5 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Cpu size={16} /> {loading ? 'Analyzing...' : 'Run AI'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.console}>
          <div style={styles.consoleHeader}>
            <span style={styles.consoleTitle}>
              <Terminal size={14} color="#ef4444" /> CrewAI Output
            </span>
          </div>
          <div style={styles.logArea}>
            {logs.map((log, i) => (
              <div key={i} style={styles.logItem(log.type)}>
                <span style={styles.timestamp}>[{log.t}]</span> {log.m}
              </div>
            ))}
            {logs.length === 0 && <div style={{ color: '#475569', fontStyle: 'italic' }}>Waiting for agent signals...</div>}
          </div>
        </div>
      </main>

      <style>
        {`
          .store-card-hover:hover {
            border-color: #ef4444 !important;
          }
          button:hover:not(:disabled) {
            background-color: #ef4444 !important;
            color: white !important;
          }
        `}
      </style>
    </div>
  );
}