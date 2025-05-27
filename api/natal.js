const { DateTime } = require("luxon");
const { julian, planetposition, data } = require("astronomia");

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

    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    const jd =
      julian.CalendarGregorianToJD(dt.year, dt.month, dt.day) +
      (dt.hour + dt.minute / 60) / 24;

    const PLANETS = [
      { name: "Sun", key: "sun", data: data.sun },
      { name: "Moon", key: "moon", data: data.moon },
      { name: "Mercury", key: "mercury", data: data.mercury },
      { name: "Venus", key: "venus", data: data.venus },
      { name: "Mars", key: "mars", data: data.mars },
      { name: "Jupiter", key: "jupiter", data: data.jupiter },
      { name: "Saturn", key: "saturn", data: data.saturn }
    ];

    const positions = {};
    for (const planet of PLANETS) {
      let pos;
      if (planet.key === "moon") {
        pos = planetposition.moon(data.earth, jd);
      } else if (planet.key === "sun") {
        pos = planetposition.sun(data.earth, jd);
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