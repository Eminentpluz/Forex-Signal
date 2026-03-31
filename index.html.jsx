import { useState, useRef, useEffect } from "react";

const PAIRS = [
  "EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD",
  "NZD/USD","USD/CHF","GBP/JPY","EUR/GBP","EUR/JPY",
  "XAU/USD","GBP/AUD","EUR/AUD","USD/ZAR","GBP/NZD"
];
const TIMEFRAMES = ["M1","M5","M15","M30","H1","H4","D1","W1"];
const SMC_CONCEPTS = [
  { id: "engineered_liquidity", label: "Engineered Liquidity", icon: "⚡", color: "#f59e0b" },
  { id: "inducement",           label: "Inducement",           icon: "🎯", color: "#818cf8" },
  { id: "sideways",             label: "Sideways / Range",     icon: "↔",  color: "#94a3b8" },
  { id: "choch",                label: "Change of Character",  icon: "🔄", color: "#fb923c" },
  { id: "bos",                  label: "Break of Structure",   icon: "💥", color: "#34d399" },
  { id: "liquidity_sweep",      label: "Liquidity Sweep",      icon: "🌊", color: "#38bdf8" },
];

const SESSIONS = ["London","New York","Tokyo","Sydney","Overlap (London/NY)"];

function TerminalLine({ text, color = "#94a3b8", delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      fontSize: "12px",
      color,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.3s",
      lineHeight: "1.8",
      letterSpacing: "0.02em"
    }}>{text}</div>
  );
}

function SignalBadge({ type }) {
  const config = {
    BUY:  { bg: "linear-gradient(135deg,#064e3b,#059669)", border: "#10b981", text: "▲ BUY LONG",  glow: "#059669" },
    SELL: { bg: "linear-gradient(135deg,#7f1d1d,#dc2626)", border: "#ef4444", text: "▼ SELL SHORT", glow: "#dc2626" },
    WAIT: { bg: "linear-gradient(135deg,#1c1917,#57534e)", border: "#78716c", text: "⏸ WAIT / OBSERVE", glow: "#78716c" },
  };
  const c = config[type] || config.WAIT;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "8px",
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: "4px", padding: "8px 18px",
      fontFamily: "'Courier New', monospace",
      fontWeight: "bold", fontSize: "15px", color: "#fff",
      boxShadow: `0 0 18px ${c.glow}55`,
      letterSpacing: "0.1em"
    }}>{c.text}</div>
  );
}

function ConceptTag({ concept, selected, onToggle }) {
  return (
    <button
      onClick={() => onToggle(concept.id)}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "6px 12px",
        background: selected ? `${concept.color}22` : "#0f172a",
        border: `1px solid ${selected ? concept.color : "#334155"}`,
        borderRadius: "3px",
        color: selected ? concept.color : "#64748b",
        fontFamily: "'Courier New', monospace",
        fontSize: "11px", cursor: "pointer",
        transition: "all 0.2s",
        letterSpacing: "0.05em"
      }}
    >
      <span>{concept.icon}</span>
      <span>{concept.label}</span>
    </button>
  );
}

function parseSignal(text) {
  const upper = text.toUpperCase();
  if (upper.includes("BUY") && !upper.includes("SELL"))  return "BUY";
  if (upper.includes("SELL") && !upper.includes("BUY"))  return "SELL";
  if (upper.includes("BUY") && upper.includes("SELL")) {
    const bi = upper.indexOf("BUY"), si = upper.indexOf("SELL");
    return bi < si ? "BUY" : "SELL";
  }
  return "WAIT";
}

function parseSections(text) {
  const sections = {};
  const patterns = [
    ["bias",     /(?:bias|direction)[:\s]+([^\n.]+)/i],
    ["entry",    /(?:entry|enter)[:\s]+([^\n.]+)/i],
    ["sl",       /(?:stop.?loss|sl)[:\s]+([^\n.]+)/i],
    ["tp",       /(?:take.?profit|tp\d*)[:\s]+([^\n.]+)/i],
    ["rr",       /(?:risk.?reward|r:r|r\/r)[:\s]+([^\n.]+)/i],
    ["session",  /(?:session|timing)[:\s]+([^\n.]+)/i],
    ["invalidation",/(?:invalidat)[^\n.]+?([^\n.]+)/i],
  ];
  for (const [k, re] of patterns) {
    const m = text.match(re);
    if (m) sections[k] = m[1].trim();
  }
  return sections;
}

export default function App() {
  const [pair,      setPair]      = useState("XAU/USD");
  const [tf,        setTf]        = useState("H4");
  const [session,   setSession]   = useState("London");
  const [concepts,  setConcepts]  = useState([]);
  const [context,   setContext]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);
  const outputRef = useRef(null);

  const toggleConcept = (id) =>
    setConcepts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  async function generateSignal() {
    if (concepts.length === 0) { setError("Select at least one SMC concept."); return; }
    setError(null); setResult(null); setLoading(true);

    const conceptLabels = concepts.map(id => SMC_CONCEPTS.find(c => c.id === id)?.label).join(", ");

    const prompt = `You are an elite Smart Money Concepts (SMC) forex analyst. 
Analyze the following setup and provide a precise technical call.

Pair: ${pair}
Timeframe: ${tf}
Session: ${session}
SMC Concepts Observed: ${conceptLabels}
Additional Context: ${context || "No additional context provided."}

Provide a structured analysis with:
1. BIAS (Bullish/Bearish/Neutral) with one-sentence reasoning
2. SMC STRUCTURE BREAKDOWN — explain how the detected concepts interact (e.g., engineered liquidity swept → inducement formed → BOS confirmed)
3. ENTRY ZONE (price level or description)
4. STOP LOSS placement (below/above key level)
5. TAKE PROFIT targets (TP1, TP2, TP3 if applicable)
6. RISK:REWARD ratio
7. SESSION TIMING for execution
8. INVALIDATION level — when does this setup fail?
9. FINAL SIGNAL — BUY or SELL or WAIT (one word on its own line)
10. CONFIDENCE — Low / Medium / High with brief rationale

Be decisive, concise, and technically precise. Use SMC terminology throughout.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error("Non-JSON response from API"); }

      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }

      if (data.type === "error") {
        throw new Error(data.error?.message || "API returned an error");
      }

      const text = Array.isArray(data.content)
        ? data.content.map(b => b.text || "").join("")
        : "";

      if (!text) throw new Error("Empty response from model");

      setResult(text);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const signal   = result ? parseSignal(result)    : null;
  const sections = result ? parseSections(result)  : {};

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060b14",
      backgroundImage: "radial-gradient(ellipse at 20% 0%, #0f2040 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #0a1628 0%, transparent 60%)",
      fontFamily: "'Courier New', monospace",
      color: "#e2e8f0",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1e3a5f",
        padding: "16px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "#04080f",
        position: "sticky", top: 0, zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "#10b981", boxShadow: "0 0 8px #10b981",
            animation: "pulse 2s infinite"
          }} />
          <span style={{ color: "#38bdf8", fontSize: "11px", letterSpacing: "0.15em" }}>SMC TERMINAL</span>
          <span style={{ color: "#1e3a5f" }}>|</span>
          <span style={{ color: "#64748b", fontSize: "10px", letterSpacing: "0.1em" }}>SMART MONEY CONCEPTS · FOREX SIGNAL ENGINE</span>
        </div>
        <div style={{ fontSize: "10px", color: "#334155", letterSpacing: "0.1em" }}>
          {new Date().toUTCString().replace(" GMT", " UTC")}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scanline { 0%{top:-10%} 100%{top:110%} }
        select,textarea { outline:none; }
        select option { background:#0f172a; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#0f172a; }
        ::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
      `}</style>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "28px 24px" }}>

        {/* Intro terminal lines */}
        <div style={{ marginBottom: "28px", padding: "16px", background: "#04080f", border: "1px solid #1e293b", borderRadius: "4px" }}>
          <TerminalLine text="> INITIALIZING SMC SIGNAL ENGINE v2.4..." color="#38bdf8" delay={0} />
          <TerminalLine text="> LOADING: Engineered Liquidity · Inducement · BOS · CHOCH · Liquidity Sweep" color="#64748b" delay={200} />
          <TerminalLine text="> STATUS: READY — Configure your setup below and generate a signal call." color="#10b981" delay={500} />
        </div>

        {/* Config Panel */}
        <div style={{
          background: "#04080f", border: "1px solid #1e3a5f",
          borderRadius: "4px", overflow: "hidden", marginBottom: "20px"
        }}>
          <div style={{
            padding: "10px 16px", background: "#071020",
            borderBottom: "1px solid #1e3a5f",
            fontSize: "10px", letterSpacing: "0.15em", color: "#38bdf8"
          }}>
            ◆ SETUP CONFIGURATION
          </div>
          <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            {/* Pair */}
            <div>
              <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: "#64748b", marginBottom: "6px" }}>INSTRUMENT</div>
              <select value={pair} onChange={e => setPair(e.target.value)} style={{
                width: "100%", background: "#0f172a", border: "1px solid #334155",
                color: "#f59e0b", padding: "8px 10px", borderRadius: "3px",
                fontFamily: "'Courier New', monospace", fontSize: "13px", cursor: "pointer"
              }}>
                {PAIRS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {/* Timeframe */}
            <div>
              <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: "#64748b", marginBottom: "6px" }}>TIMEFRAME</div>
              <select value={tf} onChange={e => setTf(e.target.value)} style={{
                width: "100%", background: "#0f172a", border: "1px solid #334155",
                color: "#f59e0b", padding: "8px 10px", borderRadius: "3px",
                fontFamily: "'Courier New', monospace", fontSize: "13px", cursor: "pointer"
              }}>
                {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {/* Session */}
            <div>
              <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: "#64748b", marginBottom: "6px" }}>SESSION</div>
              <select value={session} onChange={e => setSession(e.target.value)} style={{
                width: "100%", background: "#0f172a", border: "1px solid #334155",
                color: "#f59e0b", padding: "8px 10px", borderRadius: "3px",
                fontFamily: "'Courier New', monospace", fontSize: "13px", cursor: "pointer"
              }}>
                {SESSIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* SMC Concepts */}
        <div style={{
          background: "#04080f", border: "1px solid #1e3a5f",
          borderRadius: "4px", overflow: "hidden", marginBottom: "20px"
        }}>
          <div style={{
            padding: "10px 16px", background: "#071020",
            borderBottom: "1px solid #1e3a5f",
            fontSize: "10px", letterSpacing: "0.15em", color: "#38bdf8"
          }}>
            ◆ SMC CONCEPTS OBSERVED ON CHART
          </div>
          <div style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {SMC_CONCEPTS.map(c => (
              <ConceptTag
                key={c.id}
                concept={c}
                selected={concepts.includes(c.id)}
                onToggle={toggleConcept}
              />
            ))}
          </div>
          <div style={{ padding: "0 16px 8px", fontSize: "9px", color: "#334155", letterSpacing: "0.08em" }}>
            SELECT ALL THAT APPLY — the AI analyst will synthesize them into a cohesive signal narrative.
          </div>
        </div>

        {/* Context */}
        <div style={{
          background: "#04080f", border: "1px solid #1e3a5f",
          borderRadius: "4px", overflow: "hidden", marginBottom: "24px"
        }}>
          <div style={{
            padding: "10px 16px", background: "#071020",
            borderBottom: "1px solid #1e3a5f",
            fontSize: "10px", letterSpacing: "0.15em", color: "#38bdf8"
          }}>
            ◆ ADDITIONAL MARKET CONTEXT <span style={{ color: "#334155" }}>(OPTIONAL)</span>
          </div>
          <div style={{ padding: "16px" }}>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. Price swept previous week highs, formed bearish engulfing on H4, HTF bias is bearish, currently at 4H premium zone..."
              style={{
                width: "100%", minHeight: "80px",
                background: "#0f172a", border: "1px solid #334155",
                color: "#94a3b8", padding: "10px 12px", borderRadius: "3px",
                fontFamily: "'Courier New', monospace", fontSize: "12px",
                resize: "vertical", boxSizing: "border-box",
                lineHeight: "1.6"
              }}
            />
          </div>
        </div>

        {/* Generate Button */}
        {error && (
          <div style={{ marginBottom: "16px", padding: "10px 14px", background: "#1f0a0a", border: "1px solid #7f1d1d", borderRadius: "3px", color: "#fca5a5", fontSize: "12px" }}>
            ⚠ {error}
          </div>
        )}

        <button
          onClick={generateSignal}
          disabled={loading}
          style={{
            width: "100%", padding: "14px",
            background: loading ? "#0f172a" : "linear-gradient(135deg, #0c4a6e, #0284c7)",
            border: `1px solid ${loading ? "#334155" : "#38bdf8"}`,
            borderRadius: "4px", color: loading ? "#475569" : "#fff",
            fontFamily: "'Courier New', monospace", fontSize: "13px",
            letterSpacing: "0.15em", cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.3s",
            boxShadow: loading ? "none" : "0 0 20px #0284c755",
            marginBottom: "28px"
          }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span style={{ animation: "blink 1s infinite" }}>█</span>
              ANALYZING MARKET STRUCTURE...
              <span style={{ animation: "blink 1s infinite 0.5s" }}>█</span>
            </span>
          ) : "▶ GENERATE SMC SIGNAL CALL"}
        </button>

        {/* Output */}
        {result && (
          <div ref={outputRef} style={{ animation: "fadeIn 0.4s ease" }}>
            {/* Signal Badge */}
            <div style={{
              background: "#04080f", border: "1px solid #1e3a5f",
              borderRadius: "4px", overflow: "hidden", marginBottom: "20px"
            }}>
              <div style={{
                padding: "10px 16px", background: "#071020",
                borderBottom: "1px solid #1e3a5f",
                fontSize: "10px", letterSpacing: "0.15em", color: "#38bdf8",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span>◆ SIGNAL OUTPUT — {pair} {tf}</span>
                <span style={{ color: "#334155" }}>{session} SESSION</span>
              </div>

              {/* Quick stats row */}
              <div style={{
                display: "flex", gap: "0", borderBottom: "1px solid #0f172a"
              }}>
                {[
                  ["PAIR",    pair,    "#f59e0b"],
                  ["TF",      tf,      "#38bdf8"],
                  ["SESSION", session, "#818cf8"],
                  ["CONCEPTS", concepts.length.toString(), "#34d399"],
                ].map(([k, v, c]) => (
                  <div key={k} style={{
                    flex: 1, padding: "12px 16px",
                    borderRight: "1px solid #0f172a"
                  }}>
                    <div style={{ fontSize: "8px", color: "#475569", letterSpacing: "0.15em", marginBottom: "3px" }}>{k}</div>
                    <div style={{ fontSize: "13px", color: c, fontWeight: "bold" }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Signal badge */}
              <div style={{ padding: "20px 16px", textAlign: "center" }}>
                <SignalBadge type={signal} />
              </div>

              {/* Key levels row */}
              {(sections.entry || sections.sl || sections.tp) && (
                <div style={{
                  display: "flex", gap: "0",
                  borderTop: "1px solid #0f172a", borderBottom: "1px solid #0f172a"
                }}>
                  {[
                    ["ENTRY",       sections.entry, "#38bdf8"],
                    ["STOP LOSS",   sections.sl,    "#ef4444"],
                    ["TAKE PROFIT", sections.tp,    "#10b981"],
                    ["R:R",         sections.rr,    "#f59e0b"],
                  ].filter(([,v]) => v).map(([k, v, c]) => (
                    <div key={k} style={{ flex: 1, padding: "12px 16px", borderRight: "1px solid #0f172a" }}>
                      <div style={{ fontSize: "8px", color: "#475569", letterSpacing: "0.15em", marginBottom: "3px" }}>{k}</div>
                      <div style={{ fontSize: "11px", color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Full analysis */}
            <div style={{
              background: "#04080f", border: "1px solid #1e3a5f",
              borderRadius: "4px", overflow: "hidden"
            }}>
              <div style={{
                padding: "10px 16px", background: "#071020",
                borderBottom: "1px solid #1e3a5f",
                fontSize: "10px", letterSpacing: "0.15em", color: "#38bdf8"
              }}>
                ◆ FULL ANALYSIS BREAKDOWN
              </div>
              <div style={{ padding: "20px" }}>
                {result.split("\n").map((line, i) => {
                  const isHeader = /^\d+\.|^[A-Z\s:]+:/.test(line.trim());
                  const isFinal  = /FINAL SIGNAL|CONFIDENCE/i.test(line);
                  return (
                    <div key={i} style={{
                      fontFamily: "'Courier New', monospace",
                      fontSize: "12px",
                      color: isFinal ? "#f59e0b" : isHeader ? "#38bdf8" : "#94a3b8",
                      lineHeight: "1.9",
                      marginBottom: isHeader ? "4px" : "0",
                      marginTop: isHeader && i > 0 ? "12px" : "0",
                      fontWeight: isHeader || isFinal ? "bold" : "normal",
                      letterSpacing: "0.02em"
                    }}>{line || " "}</div>
                  );
                })}
              </div>

              {/* Concepts used */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid #0f172a", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "9px", color: "#334155", letterSpacing: "0.1em", marginRight: "4px" }}>CONCEPTS:</span>
                {concepts.map(id => {
                  const c = SMC_CONCEPTS.find(x => x.id === id);
                  return (
                    <span key={id} style={{
                      fontSize: "9px", padding: "2px 7px",
                      background: `${c.color}11`, border: `1px solid ${c.color}44`,
                      color: c.color, borderRadius: "2px", letterSpacing: "0.05em"
                    }}>{c.icon} {c.label}</span>
                  );
                })}
              </div>

              <div style={{
                padding: "10px 16px", borderTop: "1px solid #0f172a",
                fontSize: "9px", color: "#334155", letterSpacing: "0.05em"
              }}>
                ⚠ This is an AI-generated technical analysis for educational purposes only. Not financial advice. Always manage risk with proper position sizing and your own due diligence.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
