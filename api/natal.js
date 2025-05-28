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

    // UTC время с учётом смещения
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    // Юлианская дата
    const jd =
      julian.CalendarGregorianToJD(dt.year, dt.month, dt.day) +
      (dt.hour + dt.minute / 60) / 24;

    // Определяем долготы планет
    const planets = [
      {
        key: "sun",
        name: "Солнце",
        getPos: () => planetposition.sun(jd)
      },
      {
        key: "mercury",
        name: "Меркурий",
        getPos: () => planetposition.mercury(jd)
      },
      {
        key: "venus",
        name: "Венера",
        getPos: () => planetposition.venus(jd)
      },
      {
        key: "mars",
        name: "Марс",
        getPos: () => planetposition.mars(jd)
      },
      {
        key: "jupiter",
        name: "Юпитер",
        getPos: () => planetposition.jupiter(jd)
      },
      {
        key: "saturn",
        name: "Сатурн",
        getPos: () => planetposition.saturn(jd)
      }
    ];

    const positions = {};
    for (const planet of planets) {
      let pos = planet.getPos();
      let lon = typeof pos === 'object' && 'lon' in pos ? pos.lon : pos;
      lon = ((lon % 360) + 360) % 360;
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