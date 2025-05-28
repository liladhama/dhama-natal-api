const { DateTime } = require("luxon");
const astronomia = require("astronomia");

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

    // Время в UTC, с учётом смещения
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    // Юлианская дата
    const jd =
      astronomia.julian.CalendarGregorianToJD(dt.year, dt.month, dt.day) +
      (dt.hour + dt.minute / 60) / 24;

    // Определяем список планет и нужные функции
    const planets = [
      {
        key: "sun",
        name: "Солнце",
        getPos: () => astronomia.planetposition.sun(jd)
      },
      {
        key: "mercury",
        name: "Меркурий",
        getPos: () => astronomia.planetposition.mercury(jd)
      },
      {
        key: "venus",
        name: "Венера",
        getPos: () => astronomia.planetposition.venus(jd)
      },
      {
        key: "mars",
        name: "Марс",
        getPos: () => astronomia.planetposition.mars(jd)
      },
      {
        key: "jupiter",
        name: "Юпитер",
        getPos: () => astronomia.planetposition.jupiter(jd)
      },
      {
        key: "saturn",
        name: "Сатурн",
        getPos: () => astronomia.planetposition.saturn(jd)
      }
    ];

    // Собираем позиции
    const positions = {};
    for (const planet of planets) {
      let pos = planet.getPos();
      // pos может быть объектом с полем lon или просто числом (зависит от версии astronomia)
      let lon = typeof pos === 'object' && 'lon' in pos ? pos.lon : pos;
      lon = ((lon % 360) + 360) % 360; // нормализуем
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

// Определение знака Зодиака по градусам
function getZodiac(deg) {
  const signs = [
    "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
    "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"
  ];
  return signs[Math.floor(deg / 30)];
}