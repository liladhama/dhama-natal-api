const { DateTime } = require("luxon");
const Astronomy = require("astronomy-engine");

// ... остальные функции ...

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCORSHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- Критический блок: ручной парсер JSON для Vercel ---
  if (req.method === 'POST' && !req.body) {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', resolve);
    });
    try {
      req.body = JSON.parse(body);
    } catch (e) {
      setCORSHeaders(res);
      res.status(400).json({ error: 'Invalid JSON', stack: e.stack });
      return;
    }
  }

  try {
    // ... твой основной код ...
  } catch (e) {
    setCORSHeaders(res);
    console.error('ERROR:', e, e.stack);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
};