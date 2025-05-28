const { DateTime } = require("luxon");
const { julian, planetposition, data } = require("astronomia");

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

    // Юлианская дата
    const jd =
      julian.CalendarGregorianToJD(dt.year, dt.month, dt.day) +
      (dt.hour + dt.minute / 60) / 24;

    // Солнце: геоцентрическая долгота = долгота Земли + 180°
    const earth = new planetposition.Planet(data.vsop87Bearth, 'Earth');
    const earthPos = planetposition.position(earth, jd);
    let sunLon = (earthPos.lon + 180) % 360;

    // Остальные планеты
    const mercury = new planetposition.Planet(data.vsop87Bmercury, 'Mercury');
    const venus = new planetposition.Planet(data.vsop87Bvenus, 'Venus');
    const mars = new planetposition.Planet(data.vsop87Bmars, 'Mars');
    const jupiter = new planetposition.Planet(data.vsop87Bjupiter, 'Jupiter');
    const saturn = new planetposition.Planet(data.vsop87Bsaturn, 'Saturn');

    const positions = {
      sun: {
        deg: Math.round(sunLon * 1000) / 1000,
        sign: getZodiac(sunLon)
      },
      mercury: getPlanetPosition(mercury, jd),
      venus: getPlanetPosition(venus, jd),
      mars: getPlanetPosition(mars, jd),
      jupiter: getPlanetPosition(jupiter, jd),
      saturn: getPlanetPosition(saturn, jd)
    };

    res.status(200).json({ jd, planets: positions });
  } catch (e) {
    console.error("Natal API error:", e, JSON.stringify(req.body));
    res.status(500).json({ error: e.message });
  }
};

function getPlanetPosition(planet, jd) {
  const pos = planetposition.position(planet, jd);
  let lon = ((pos.lon % 360) + 360) % 360;
  return {
    deg: Math.round(lon * 1000) / 1000,
    sign: getZodiac(lon)
  };
}

function getZodiac(deg) {
  const signs = [
    "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
    "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"
  ];
  return signs[Math.floor(deg / 30)];
}