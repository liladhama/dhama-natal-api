const { DateTime } = require("luxon");
const { julian, planetposition } = require("astronomia");

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

    // Время UTC с учётом смещения
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    // Юлианская дата
    const jd = julian.CalendarGregorianToJD(dt.year, dt.month, dt.day) +
      (dt.hour + dt.minute / 60) / 24;

    // Для новых версий astronomia используем planetposition.vsop87b
    // Документация: https://www.npmjs.com/package/astronomia#vsop87b
    const planets = [
      { key: "mercury", fn: planetposition.vsop87b.mercury },
      { key: "venus", fn: planetposition.vsop87b.venus },
      { key: "mars", fn: planetposition.vsop87b.mars },
      { key: "jupiter", fn: planetposition.vsop87b.jupiter },
      { key: "saturn", fn: planetposition.vsop87b.saturn }
    ];

    // Земля для расчёта долготы Солнца
    const earthPos = planetposition.vsop87b.earth(jd);
    let sunLon = (earthPos.lon + 180) % 360;

    const positions = {
      sun: {
        deg: Math.round(sunLon * 1000) / 1000,
        sign: getZodiac(sunLon)
      }
    };

    for (const planet of planets) {
      const pos = planet.fn(jd);
      let lon = ((pos.lon % 360) + 360) % 360;
      positions[planet.key] = {
        deg: Math.round(lon * 1000) / 1000,
        sign: getZodiac(lon)
      };
    }

    res.status(200).json({ jd, planets: positions });
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