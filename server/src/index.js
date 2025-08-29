import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import { scheduleSend, JobRegistry } from './scheduler.js';
import { sleep, ok, fail } from './utils.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ✅ WhatsApp client with Chrome executablePath
const waClient = new Client({
  authStrategy: new LocalAuth({ clientId: 'multi-group-bot' }),
  puppeteer: {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', // ✅ Path to your Chrome
    headless: true, // set false if you want to see Chrome UI
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

const registry = new JobRegistry();

function emitStatus(status, extra = {}) { io.emit('status', { status, ...extra }); }
function emitLog(line) { io.emit('log', line); }

waClient.on('qr', (qr) => emitStatus('qr', { qr }));
waClient.on('ready', () => emitStatus('ready'));
waClient.on('authenticated', () => emitStatus('authenticated'));
waClient.on('disconnected', (reason) => emitStatus('disconnected', { reason }));

waClient.initialize();

async function requireReady(req, res) {
  try {
    const state = await waClient.getState();
    if (!state || state === 'CONFLICT' || state === 'UNPAIRED') {
      res.status(409).json(fail('WhatsApp not ready. Scan QR again.'));
      return true;
    }
    return false;
  } catch {
    res.status(409).json(fail('WhatsApp not ready.'));
    return true;
  }
}

// Routes
app.get('/api/health', (req, res) => res.json(ok()));
app.get('/api/groups', async (req, res) => {
  if (await requireReady(req, res)) return;
  const chats = await waClient.getChats();
  const groups = chats.filter(c => c.isGroup).map(g => ({ id: g.id._serialized, name: g.name }));
  res.json(ok({ groups }));
});

app.post('/api/send', upload.single('media'), async (req, res) => {
  if (await requireReady(req, res)) return;
  try {
    const { message = '', groupIds = '[]', perGroupDelayMs = '1200' } = req.body;
    const ids = Array.isArray(groupIds) ? groupIds : JSON.parse(groupIds);
    const delay = Number(perGroupDelayMs) || 1200;
    let media = null;
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      media = new MessageMedia(req.file.mimetype, base64, req.file.originalname);
    }
    const results = [];
    for (const id of ids) {
      try {
        if (media) {
          const r = await waClient.sendMessage(id, media, { caption: message });
          results.push({ id, status: 'sent', msgId: r.id._serialized });
        } else {
          const r = await waClient.sendMessage(id, message);
          results.push({ id, status: 'sent', msgId: r.id._serialized });
        }
        emitLog(`Sent to ${id}`);
      } catch (e) {
        results.push({ id, status: 'failed', error: e.message });
        emitLog(`Failed on ${id}: ${e.message}`);
      }
      await sleep(delay);
    }
    res.json(ok({ results }, 'sent'));
  } catch (e) {
    res.status(400).json(fail(e.message));
  }
});

app.post('/api/schedule', upload.single('media'), async (req, res) => {
  if (await requireReady(req, res)) return;
  try {
    const { message = '', groupIds = '[]', runAtISO = '', perGroupDelayMs = '1200' } = req.body;
    const ids = Array.isArray(groupIds) ? groupIds : JSON.parse(groupIds);
    const delay = Number(perGroupDelayMs) || 1200;
    const when = new Date(runAtISO);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() + 5000) {
      return res.status(400).json(fail('Invalid runAtISO (future time >= 5s)'));
    }

    let fileMeta = null;
    if (req.file) {
      fileMeta = { base64: req.file.buffer.toString('base64'), mimetype: req.file.mimetype, filename: req.file.originalname };
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    scheduleSend(registry, jobId, when, async () => {
      emitLog(`Running job ${jobId} @ ${new Date().toISOString()}`);
      try {
        for (const id of ids) {
          try {
            if (fileMeta) {
              const m = new MessageMedia(fileMeta.mimetype, fileMeta.base64, fileMeta.filename);
              await waClient.sendMessage(id, m, { caption: message });
            } else {
              await waClient.sendMessage(id, message);
            }
            emitLog(`[Scheduled] Sent to ${id}`);
          } catch (e) {
            emitLog(`[Scheduled] Failed on ${id}: ${e.message}`);
          }
          await sleep(delay);
        }
      } catch (e) {
        emitLog(`[Scheduled] Job error: ${e.message}`);
      } finally {
        registry.remove(jobId);
      }
    });

    res.json(ok({ jobId, runAtISO }, 'scheduled'));
  } catch (e) {
    res.status(400).json(fail(e.message));
  }
});

app.get('/api/jobs', (req, res) => { res.json(ok({ jobs: registry.list() })); });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on :${PORT}`));
