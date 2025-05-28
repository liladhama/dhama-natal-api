const { DateTime } = require("luxon");
const astronomia = require("astronomia");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    // Проверка входных параметров
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
      astronomia.julian.CalendarGregorianToJD(dt.year, dt.month, dt.day) +
      (dt.hour + dt.minute / 60) / 24;

    // Для теста: выведем, что есть в astronomia.planetposition
    const ppKeys = Object.keys(astronomia.planetposition);
    // Для теста: выведем, что есть в astronomia
    const aKeys = Object.keys(astronomia);

    // Пример: расчёт долготы Солнца через Землю (если возможно)
    let sunLon = null;
    if (
      astronomia.planetposition &&
      typeof astronomia.planetposition.earth === "function"
    ) {
      try {
        const earth = astronomia.planetposition.earth(jd);
        sunLon = ((earth.lon + 180) % 360);
      } catch (e) {
        sunLon = null;
      }
    }

    // Вернём отладочную информацию для дальнейшей настройки
    res.status(200).json({
      jd,
      "astronomia.planetposition keys": ppKeys,
      "astronomia keys": aKeys,
      "sun longitude": sunLon,
      "message": "Скопируй этот ответ и пришли его сюда – я подберу точный рабочий способ для твоей версии!"
    });
  } catch (e) {
    console.error("Natal API error:", e, JSON.stringify(req.body));
    res.status(500).json({ error: e.message });
  }
};