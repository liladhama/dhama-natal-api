const { DateTime } = require("luxon");
const julian = require("astronomia/lib/julian");
const planetposition = require("astronomia/lib/planetposition");
const data = require("astronomia/data");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { year, month, day, hour, minute, latitude, longitude, tzOffset } = req.body;
    if (
      year === undefined || month === undefined || day === undefined ||
      hour === undefined || minute === undefined ||
      latitude === undefined || longitude === undefined
    ) {
      res.status(400).json({ error: "Missing parameters" });
      return;
    }

    // Время в UTC, учтем смещение часового пояса
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    // Юлианская дата
    const jd =
      julian.CalendarGregorianToJD(dt.year, dt.month, dt.day) +
      (dt.hour + dt.minute / 60) / 24;

    // Список планет и соответствующие данные VSOP87B
    const PLANETS = [
      { name: "Sun", key: "sun", data: data.vsop87Bearth }, // Sun рассчитывается как позиция Земли
      { name: "Mercury", key: "mercury", data: data.vsop87Bmercury },
      { name: "Venus", key: "venus", data: data.vsop87Bvenus },
      { name: "Mars", key: "mars", data: data.vsop87Bmars },
      { name: "Jupiter", key: "jupiter", data: data.vsop87Bjupiter },
      { name: "Saturn", key: "saturn", data: data.vsop87Bsaturn }
    ];

    // Посчитаем эклиптическую долготу для каждой планеты
    const positions = {};
    for (const planet of PLANETS) {
      let pos;
      if (planet.key === "sun") {
        // Для Солнца: берём позицию Земли и делаем геоцентрическую долготу
        pos = planetposition.sun(planet.data, jd);
      } else {
        pos = planetposition.position(planet.data, jd);
      }
      positions[planet.key] = {
        deg: Math.round((pos.lon % 360) * 1000) / 1000,
        sign: getZodiac(pos.lon % 360)
      };
    }

    res.status(200).json({ planets: positions });
  } catch (e) {
    console.error("Natal API error:", e, JSON.stringify(req.body));
    res.status(500).json({ error: e.message });
  }
};

// Определение знака зодиака по градусам
function getZodiac(deg) {
  const signs = [
    "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
    "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"
  ];
  return signs[Math.floor(deg / 30)];
}