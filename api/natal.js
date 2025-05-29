const { DateTime } = require("luxon");
const Astronomy = require("astronomy-engine");

// ... вспомогательные функции тут ...

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

  // --- Безопасный парсер тела запроса с таймаутом ---
  if (req.method === 'POST' && !req.body) {
    let body = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      req.destroy();
    }, 3000);

    try {
      await new Promise((resolve, reject) => {
        req.on('data', (chunk) => {
          if (!timedOut) body += chunk;
        });
        req.on('end', () => {
          clearTimeout(timeout);
          if (!timedOut) resolve();
        });
        req.on('error', (e) => {
          clearTimeout(timeout);
          reject(e);
        });
      });
      if (timedOut) throw new Error('Timeout reading body');
      req.body = JSON.parse(body);
    } catch (e) {
      setCORSHeaders(res);
      res.status(400).json({ error: 'Invalid or empty JSON in request body', stack: e.stack });
      return;
    }
  }

  if (req.method !== "POST") {
    setCORSHeaders(res);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { year, month, day, hour, minute, latitude, longitude, tzOffset } = req.body || {};
    // ВАЖНО! Выводим значения в логи Vercel
    console.log('Параметры:', { year, month, day, hour, minute, latitude, longitude, tzOffset });

    if (
      year === undefined || month === undefined || day === undefined ||
      hour === undefined || minute === undefined ||
      latitude === undefined || longitude === undefined
    ) {
      setCORSHeaders(res);
      res.status(400).json({ error: "Missing parameters" });
      return;
    }

    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    console.log('Собранная дата:', dt.toISO());

    const date = new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute));
    console.log('Date для Astronomy:', date);

    const astroTime = Astronomy.MakeTime(date);
    console.log('astroTime:', astroTime);

    const jd = astroTime && astroTime.jd ? astroTime.jd : null;

    if (!jd) {
      setCORSHeaders(res);
      res.status(500).json({ error: "JD (Julian Day) calculation failed" });
      return;
    }

    // ... остальной код без изменений ...
    
    // Пример успешного ответа:
    setCORSHeaders(res);
    res.status(200).json({ date: date.toISOString(), jd, info: "Все параметры получены верно!" });
  } catch (e) {
    setCORSHeaders(res);
    console.error('ERROR:', e, e.stack);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
};