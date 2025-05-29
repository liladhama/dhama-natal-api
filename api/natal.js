const { DateTime } = require("luxon");
const Astronomy = require("astronomy-engine");

const JD_J2000 = 2451545.0;

// Лахири айанамша
function getLahiriAyanamsa(jd) {
    const t = (jd - JD_J2000) / 36525;
    return 22.460148 + 1.396042 * t + 3.08e-4 * t * t;
}

function getZodiac(deg) {
  const signs = [
    "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
    "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"
  ];
  return signs[Math.floor((deg % 360) / 30)];
}

// Средний лунный узел (Раху, mean node)
function meanLunarNodeLongitude(jd) {
  const T = (jd - JD_J2000) / 36525.0;
  let omega = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T)/450000;
  omega = ((omega % 360) + 360) % 360;
  return omega;
}

// CORS
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

    if (
      year === undefined || month === undefined || day === undefined ||
      hour === undefined || minute === undefined ||
      latitude === undefined || longitude === undefined
    ) {
      setCORSHeaders(res);
      res.status(400).json({ error: "Missing parameters" });
      return;
    }

    // Переводим дату в UTC без смещения (tzOffset - в часах)
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    const date = new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute));

    const astroTime = Astronomy.MakeTime(date);
    const jd = astroTime && typeof astroTime.ut === 'number'
      ? astroTime.ut + JD_J2000
      : null;

    if (!jd) {
      setCORSHeaders(res);
      res.status(500).json({ error: "JD (Julian Day) calculation failed" });
      return;
    }

    const ayanamsa = getLahiriAyanamsa(jd);

    // Только классические ведические планеты
    const planetNames = [
      'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'
    ];
    const positions = {};

    // Считаем долготы всех планет
    for (const pname of planetNames) {
      let lon = Astronomy.EclipticLongitude(Astronomy.Body[pname], date);
      let sidereal = (lon - ayanamsa + 360) % 360;
      positions[pname.toLowerCase()] = {
        deg: Math.round(sidereal * 1000) / 1000,
        sign: getZodiac(sidereal)
      };
    }

    // Раху и Кету (сидерические координаты)
    let rahuTropical = meanLunarNodeLongitude(jd);
    let rahuSidereal = (rahuTropical - ayanamsa + 360) % 360;
    positions["rahu"] = {
      deg: Math.round(rahuSidereal * 1000) / 1000,
      sign: getZodiac(rahuSidereal)
    };
    let ketuSidereal = (rahuSidereal + 180) % 360;
    positions["ketu"] = {
      deg: Math.round(ketuSidereal * 1000) / 1000,
      sign: getZodiac(ketuSidereal)
    };

    // Асцендент (лагна)
    const observer = new Astronomy.Observer(latitude, longitude, 0);
    const ascHorizon = Astronomy.Horizon(date, observer, 90, 0, "normal");
    let ascEcliptic = ascHorizon ? ascHorizon.elon : null;
    let ascSidereal = (ascEcliptic !== null && ayanamsa !== null) ? (ascEcliptic - ayanamsa + 360) % 360 : null;
    positions["asc"] = {
      deg: ascSidereal !== null ? Math.round(ascSidereal * 1000) / 1000 : null,
      sign: ascSidereal !== null ? getZodiac(ascSidereal) : null
    };

    setCORSHeaders(res);
    res.status(200).json({
      date: date.toISOString(),
      jd,
      ayanamsa,
      planets: positions
    });
  } catch (e) {
    setCORSHeaders(res);
    console.error('ERROR:', e, e.stack);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
};