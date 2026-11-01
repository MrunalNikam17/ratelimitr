import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const API = '/rl'

const ROUTES = [
  { path: '', label: 'default - token bucket, 100 per 60s' },
  { path: '/api/search', label: '/api/search - token bucket, 100 per 60s' },
  { path: '/api/login', label: '/api/login - sliding log, 5 per 60s' },
  { path: '/api/reports', label: '/api/reports - leaky bucket, 10 per 30s' },
  { path: '/api/stream', label: '/api/stream - sliding counter, 200 per 60s' },
]

type CheckResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetMs: number
  resetEpochMs: number
  retryAfterSec?: number
}
type LogRow = { id: number; time: string; key: string; route: string; status: number; allowed: boolean; remaining: number; ms: number }

async function check(body: Record<string, unknown>) {
  const t0 = performance.now()
  const res = await fetch(`${API}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { status: res.status, data, ms: Math.round(performance.now() - t0) }
}

function Gauge({ remaining, limit }: { remaining: number; limit: number }) {
  const cells = Math.min(limit, 40)
  const filled = Math.round((remaining / limit) * cells)
  return (
    <div className="gauge" aria-label={`${remaining} of ${limit} remaining`}>
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={i < filled ? 'cell on' : 'cell'} />
      ))}
    </div>
  )
}

function Playground() {
  const [key, setKey] = useState('alice')
  const [route, setRoute] = useState('/api/login')
  const [clientId, setClientId] = useState('')
  const [cost, setCost] = useState(1)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const nextId = useRef(1)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  async function send(times: number) {
    setBusy(true)
    setError('')
    try {
      for (let i = 0; i < times; i++) {
        const body: Record<string, unknown> = { key, cost }
        if (route) body.route = route
        if (clientId) body.clientId = clientId
        const { status, data, ms } = await check(body)
        if (status === 400) {
          setError('The backend rejected the request: ' + JSON.stringify(data.details ?? data))
          break
        }
        setResult(data)
        setLog((l) =>
          [{ id: nextId.current++, time: new Date().toLocaleTimeString(), key, route: route || 'default', status, allowed: data.allowed, remaining: data.remaining, ms }, ...l].slice(0, 50),
        )
        if (times > 1) await new Promise((r) => setTimeout(r, 120))
      }
    } catch {
      setError('Backend unreachable. Check that it is running (Docker: http://localhost/health) and restart this dev server.')
    }
    setBusy(false)
  }

  const secondsLeft = result ? Math.max(0, Math.ceil((result.resetEpochMs - now) / 1000)) : 0

  return (
    <div className="grid2">
      <section className="panel">
        <h2>Send a request</h2>
        <label>Key
          <input value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label>Route rule
          <select value={route} onChange={(e) => setRoute(e.target.value)}>
            {ROUTES.map((r) => <option key={r.path} value={r.path}>{r.label}</option>)}
          </select>
        </label>
        <label>Client ID (optional, try tier_premium)
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </label>
        <label>Cost
          <input type="number" min={1} value={cost} onChange={(e) => setCost(Math.max(1, Number(e.target.value)))} />
        </label>
        <div className="row">
          <button disabled={busy || !key} onClick={() => send(1)}>Send request</button>
          <button className="ghost" disabled={busy || !key} onClick={() => send(10)}>Send 10 in a row</button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <h2>Result</h2>
        {!result ? (
          <p className="muted">Send a request to see how much quota is left.</p>
        ) : (
          <>
            <p className={result.allowed ? 'verdict ok' : 'verdict no'}>{result.allowed ? 'Allowed' : 'Blocked'}</p>
            <Gauge remaining={result.remaining} limit={result.limit} />
            <p className="big">{result.remaining}<span> of {result.limit} left</span></p>
            <p className="muted">
              Resets in {secondsLeft}s
              {result.retryAfterSec ? ` - retry after ${result.retryAfterSec}s` : ''}
            </p>
          </>
        )}
      </section>

      <section className="panel wide">
        <h2>Request log</h2>
        {log.length === 0 ? (
          <p className="muted">Nothing sent yet.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead><tr><th>Time</th><th>Key</th><th>Route</th><th>HTTP</th><th>Result</th><th>Left</th><th>Latency</th></tr></thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.id}>
                    <td>{r.time}</td><td>{r.key}</td><td>{r.route}</td>
                    <td>{r.status}</td>
                    <td className={r.allowed ? 'ok' : 'no'}>{r.allowed ? 'allowed' : 'blocked'}</td>
                    <td>{r.remaining}</td><td>{r.ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

type Totals = { allowed: number; blocked: number; errors: number; latSum: number; latCount: number }

function parseMetrics(text: string): Totals {
  const t: Totals = { allowed: 0, blocked: 0, errors: 0, latSum: 0, latCount: 0 }
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.includes(' ')) continue
    const value = Number(line.slice(line.lastIndexOf(' ') + 1))
    if (Number.isNaN(value)) continue
    if (line.startsWith('ratelimit_requests_total')) {
      if (line.includes('status="allowed"')) t.allowed += value
      else if (line.includes('status="blocked"')) t.blocked += value
    } else if (line.startsWith('ratelimit_store_errors_total')) t.errors += value
    else if (line.startsWith('ratelimit_duration_seconds_sum')) t.latSum += value
    else if (line.startsWith('ratelimit_duration_seconds_count')) t.latCount += value
  }
  return t
}

type Point = { t: string; allowed: number; blocked: number }

function Dashboard() {
  const [totals, setTotals] = useState<Totals | null>(null)
  const [health, setHealth] = useState<{ status: string; uptime: number } | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [error, setError] = useState('')
  const prev = useRef<Totals | null>(null)

  useEffect(() => {
    let live = true
    async function pollMetrics() {
      try {
        const res = await fetch(`${API}/metrics`)
        const cur = parseMetrics(await res.text())
        if (!live) return
        setError('')
        setTotals(cur)
        const p = prev.current
        if (p) {
          const pt = { t: new Date().toLocaleTimeString(), allowed: Math.max(0, cur.allowed - p.allowed), blocked: Math.max(0, cur.blocked - p.blocked) }
          setPoints((a) => [...a, pt].slice(-40))
        }
        prev.current = cur
      } catch {
        if (live) setError('Backend unreachable. Check that it is running and restart this dev server.')
      }
    }
    async function pollHealth() {
      try {
        const res = await fetch(`${API}/health`)
        const j = await res.json()
        if (live) setHealth(j)
      } catch { /* shown by the metrics error */ }
    }
    pollMetrics(); pollHealth()
    const a = setInterval(pollMetrics, 3000)
    const b = setInterval(pollHealth, 5000)
    return () => { live = false; clearInterval(a); clearInterval(b) }
  }, [])

  const total = totals ? totals.allowed + totals.blocked : 0
  const blockRate = totals && total ? ((totals.blocked / total) * 100).toFixed(1) : '0.0'
  const avgMs = totals && totals.latCount ? ((totals.latSum / totals.latCount) * 1000).toFixed(2) : '0.00'

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {health && health.status !== 'ok' && <p className="error">The limiter reports it is degraded. Its store is not responding.</p>}
      <div className="stats">
        <div><b>{total}</b><span>checks</span></div>
        <div><b className="ok">{totals?.allowed ?? 0}</b><span>allowed</span></div>
        <div><b className="no">{totals?.blocked ?? 0}</b><span>blocked</span></div>
        <div><b>{blockRate}%</b><span>block rate</span></div>
        <div><b>{avgMs} ms</b><span>avg check time</span></div>
        <div><b>{totals?.errors ?? 0}</b><span>store errors</span></div>
        <div><b>{health ? `${Math.floor(health.uptime / 60)}m` : '-'}</b><span>uptime</span></div>
      </div>
      <section className="panel">
        <h2>Requests per refresh (every 3s)</h2>
        {points.length < 2 ? (
          <p className="muted">Send some requests from the Playground. The chart fills in as new traffic arrives.</p>
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={points}>
                <CartesianGrid stroke="#d5dbe1" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="allowed" stroke="#0f8a7e" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="blocked" stroke="#c8442f" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<'play' | 'live'>('play')
  return (
    <main className="shell">
      <header>
        <h1>ratelimitr</h1>
        <nav>
          <button className={tab === 'play' ? 'tab active' : 'tab'} onClick={() => setTab('play')}>Playground</button>
          <button className={tab === 'live' ? 'tab active' : 'tab'} onClick={() => setTab('live')}>Live metrics</button>
        </nav>
      </header>
      {tab === 'play' ? <Playground /> : <Dashboard />}
    </main>
  )
}