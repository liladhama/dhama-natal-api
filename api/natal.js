const { DateTime } = require("luxon");
const Astronomy = require("astronomy-engine");

const JD_J2000 = 2451545.0;

function getLahiriAyanamsa(jd) {
    // JD на эпоху 1900-01-01 12:00 UT
    const jd0 = 2415020.0;
    const t = (jd - jd0) / 36525;
    return (22.460148 + 1.396042 * t + 3.08e-4 * t * t);
}

// Средний лунный узел (mean node) — градусы
function meanLunarNodeLongitude(jd) {
  const T = (jd - JD_J2000) / 36525.0;
  let Ω = 125.04452 - 1934.136261 * T + 0.0020708 * T*T + (T*T*T)/450000;
  Ω = ((Ω % 360) + 360) % 360;
  return Ω;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
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
      res.status(400).json({ error: "Missing parameters" });
      return;
    }

    // UTC время с учётом смещения
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    const date = new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute));
    const jd = Astronomy.MakeTime(date).julianDay;

    // 1. Лахири айанамша
    const ayanamsa = getLahiriAyanamsa(jd);

    // 2. Тропические долготы планет
    const planetNames = [
      'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'
    ];
    const positions = {};

    for (const pname of planetNames) {
      let lon;
      if (pname === "Sun") {
        // Солнце: долгота Земли + 180°
        const earthEclLon = Astronomy.EclipticLongitude(Astronomy.Body.Earth, date);
        lon = (earthEclLon + 180) % 360;
      } else {
        lon = Astronomy.EclipticLongitude(Astronomy.Body[pname], date);
      }
      // Переводим в сидерический зодиак
      let sidereal = (lon - ayanamsa + 360) % 360;
      positions[pname.toLowerCase()] = {
        deg: Math.round(sidereal * 1000) / 1000,
        sign: getZodiac(sidereal)
      };
    }

    // Раху (mean node, средний лунный узел)
    let rahuTropical = meanLunarNodeLongitude(jd);
    let rahuSidereal = (rahuTropical - ayanamsa + 360) % 360;
    positions["rahu"] = {
      deg: Math.round(rahuSidereal * 1000) / 1000,
      sign: getZodiac(rahuSidereal)
    };

    // Кету (противоположная точка)
    let ketuSidereal = (rahuSidereal + 180) % 360;
    positions["ketu"] = {
      deg: Math.round(ketuSidereal * 1000) / 1000,
      sign: getZodiac(ketuSidereal)
    };

    // Асцендент (лагна)
    const observer = new Astronomy.Observer(latitude, longitude, 0);
    const ascEcliptic = Astronomy.Horizon(date, observer, 90, 0, "normal").elon;
    let ascSidereal = (ascEcliptic - ayanamsa + 360) % 360;
    positions["asc"] = {
      deg: Math.round(ascSidereal * 1000) / 1000,
      sign: getZodiac(ascSidereal)
    };

    res.status(200).json({ date: date.toISOString(), ayanamsa, planets: positions });
  } catch (e) {
    console.error("Natal API error:", e, JSON.stringify(req.body));
    res.status(500).json({ error: e.message });
  }
};

function getZodiac(deg) {
  const signs = [
    "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
    "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"
  ];
  return signs[Math.floor(deg / 30)];
}