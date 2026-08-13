'use strict';
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { optionalAuth } = require('./middlewares/auth');
const { notFound, errorHandler } = require('./middlewares/errors');
const { attachLiveSession } = require('./socket/liveSession');

const app = express();
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'https://your-deployed-frontend-url.com',
];
const extraOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = {
  origin: [...allowedOrigins, ...extraOrigins],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(optionalAuth);

// static assets for the mobile WebView gesture engine (MediaPipe wasm/model)
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use(require('./routes/health'));
app.use(require('./routes/auth'));
app.use(require('./routes/refreshToken'));
app.use(require('./routes/form'));
app.use(require('./routes/schedule'));
app.use(require('./routes/analytics'));
app.use(require('./routes/search'));
app.use(require('./routes/sessions'));
app.use(require('./routes/coach'));
app.use(require('./routes/tts'));
app.use(require('./routes/catalog'));
app.use(require('./routes/food'));

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
attachLiveSession(server);

if (require.main === module) {
  server.listen(env.port, () => {
    console.log(`🚀 @ai-coach/api listening on :${env.port}`);
    console.log(`   compute engine : native-cpp (or js-fallback)`);
    console.log(`   ws live-session: ws://localhost:${env.port}/live-session`);
  });
}

module.exports = { app, server };
