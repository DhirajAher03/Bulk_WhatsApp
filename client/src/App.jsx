import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import QRCode from 'qrcode.react';
import { fetchGroups, sendNow, scheduleSend, jobs } from './api';

const socket = io(import.meta.env.VITE_API_BASE || 'http://localhost:5000', { transports: ['websocket'] });

export default function App() {
  const [status, setStatus] = useState('connecting');
  const [qr, setQr] = useState('');
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('Hello from automation ✅');
  const [delay, setDelay] = useState(1200);
  const [file, setFile] = useState(null);
  const [runAt, setRunAt] = useState('');
  const [log, setLog] = useState([]);
  const [jobIds, setJobIds] = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    socket.on('status', (payload) => {
      setStatus(payload.status);
      if (payload.status === 'qr') setQr(payload.qr);
    });
    socket.on('log', (line) => setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`]));
    return () => { socket.off('status'); socket.off('log'); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const connected = useMemo(() => ['ready', 'authenticated'].includes(status), [status]);

  async function refreshGroups() {
    try {
      const gs = await fetchGroups();
      setGroups(gs);
    } catch {
      alert('Failed to load groups. Is WhatsApp connected?');
    }
  }

  async function refreshJobs() {
    try {
      const ids = await jobs();
      setJobIds(ids);
    } catch {}
  }

  async function onSendNow() {
    if (selected.length === 0) return alert('Select at least one group');
    const { success, message: msg } = await sendNow({ groupIds: selected, message, perGroupDelayMs: delay, file });
    alert(success ? 'Sent!' : ('Failed: ' + msg));
  }

  async function onSchedule() {
    if (selected.length === 0) return alert('Select at least one group');
    if (!runAt) return alert('Pick a date/time');
    const { success, message: msg } = await scheduleSend({ groupIds: selected, message, runAtISO: runAt, perGroupDelayMs: delay, file });
    if (success) { alert('Scheduled!'); refreshJobs(); } else { alert('Failed: ' + msg); }
  }

  return (
    <div className="container py-4" style={{ backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <h2 className="mb-3 text-success text-center">WhatsApp Multi-Group Bot</h2>
      <p className="text-center text-muted mb-4">
        ⚠️ Unofficial automation using whatsapp-web.js. Use responsibly.
      </p>

      <div className="row g-4">
        {/* Connection Card */}
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title text-success">Connection</h5>
              <p>Status: <span className="badge bg-info text-dark">{status}</span></p>
              {status === 'qr' && (
                <div className="text-center my-3">
                  <QRCode value={qr} size={220} />
                  <p className="mt-2 text-muted">Scan this QR in WhatsApp → Linked Devices</p>
                </div>
              )}
              <div className="d-flex gap-2">
                <button onClick={refreshGroups} className="btn btn-success" disabled={!connected}>
                  <i className="bi bi-arrow-repeat"></i> Fetch Groups
                </button>
                <button onClick={refreshJobs} className="btn btn-outline-secondary">
                  <i className="bi bi-list-task"></i> Refresh Jobs
                </button>
              </div>
              <div className="mt-3 text-muted">
                Active Jobs: {jobIds.length > 0 ? jobIds.join(', ') : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Compose Card */}
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title text-success">Compose Message</h5>
              <div className="mb-3">
                <label className="form-label">Message</label>
                <textarea className="form-control" rows={4} value={message} onChange={(e) => setMessage(e.target.value)}></textarea>
              </div>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Per-group Delay (ms)</label>
                  <input type="number" className="form-control" value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Media (optional)</label>
                  <input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Schedule</label>
                  <input type="datetime-local" className="form-control" onChange={(e) => setRunAt(new Date(e.target.value).toISOString())} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Groups & Actions */}
      <div className="row g-4 mt-3">
        <div className="col-lg-6">
          <div className="card shadow-sm" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <div className="card-body">
              <h5 className="card-title text-success">Groups</h5>
              {groups.length === 0 ? (
                <p className="text-muted">No groups loaded. Click “Fetch Groups”.</p>
              ) : (
                <ul className="list-group">
                  {groups.map((g) => (
                    <li key={g.id} className="list-group-item">
                      <label className="form-check-label">
                        <input
                          type="checkbox"
                          className="form-check-input me-2"
                          checked={selected.includes(g.id)}
                          onChange={(e) => {
                            setSelected((s) => e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id));
                          }}
                        />
                        {g.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title text-success">Actions</h5>
              <div className="d-flex gap-2 mb-3">
                <button onClick={onSendNow} className="btn btn-success">
                  <i className="bi bi-send-fill"></i> Send Now
                </button>
                <button onClick={onSchedule} className="btn btn-warning text-dark">
                  <i className="bi bi-clock-fill"></i> Schedule
                </button>
              </div>
              <div
                ref={logRef}
                className="bg-light border rounded p-2"
                style={{ height: '200px', overflowY: 'auto', fontSize: '0.9rem' }}
              >
                {log.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
