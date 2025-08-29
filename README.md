# WhatsApp Multi-Group Bot (Advanced UI)

> Unofficial automation using `whatsapp-web.js`. Use responsibly. Avoid spam.

## Run

### Server
```bash
cd server
cp .env.example .env   # optional edit PORT and CORS_ORIGIN
npm install
npm run dev            # or: npm start
```
Open console and scan the QR shown in the **client** app (Connection panel).

### Client
```bash
cd ../client
npm install
npm run dev
```
Open http://localhost:5173

If your server runs on a different URL, create `client/.env` with:
```
VITE_API_BASE=http://localhost:5000
```

## Features
- Fetch and select groups
- Send message to multiple groups
- Attach media (image/pdf) with caption
- Schedule messages at a future time
- Live logs and connection status
