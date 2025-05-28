const { DateTime } = require("luxon");
const Astronomy = require("astronomy-engine");

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

    // Время UTC c учётом смещения
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: "UTC" }
    ).minus({ hours: tzOffset || 0 });

    // Astronomy-engine использует JavaScript Date в UTC
    const date = new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute));

    const planetNames = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
    const positions = {};

    for (const pname of planetNames) {
      const ecl = Astronomy.EclipticLongitude(Astronomy.Body[pname], date);
      let lon = ((ecl + 360) % 360);
      positions[pname.toLowerCase()] = {
        deg: Math.round(lon * 1000) / 1000,
        sign: getZodiac(lon)
      };
    }

    res.status(200).json({ date: date.toISOString(), planets: positions });
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