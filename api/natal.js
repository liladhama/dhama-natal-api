const { DateTime } = require("luxon");
const swe = require("swisseph");
const Astronomy = require("astronomy-engine");

const JD_J2000 = 2451545.0;

function getZodiac(deg) {
    const signs = [
        "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
        "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"
    ];
    return signs[Math.floor((deg % 360) / 30)];
}
function getDegreeInSign(deg) {
    return Math.round((deg % 30) * 1000) / 1000;
}
function getDegreeInSignStr(deg) {
    const d = Math.floor(deg % 30);
    const m = Math.round(((deg % 30) - d) * 60);
    return `${d}°${m < 10 ? "0" : ""}${m}'`;
}

function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://dhama-sage.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
    setCORSHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        console.log("swe exports", Object.keys(swe)); // <-- Дай вывод из Render логов!
        console.log("natal.js: req.body =", req.body);

        const { year, month, day, hour, minute, latitude, longitude, tzOffset } = req.body || {};

        if (
            year === undefined || month === undefined || day === undefined ||
            hour === undefined || minute === undefined ||
            latitude === undefined || longitude === undefined
        ) {
            console.error("natal.js: error = Missing parameters");
            res.status(400).json({ error: "Missing parameters" });
            return;
        }

        // Переводим дату в UTC без смещения (tzOffset - в часах)
        const dt = DateTime.fromObject(
            { year, month, day, hour, minute },
            { zone: "UTC" }
        ).minus({ hours: tzOffset || 0 });

        const date = new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute));
        console.log("natal.js: Calculated date =", date);

        const astroTime = Astronomy.MakeTime(date);
        const jd = astroTime && typeof astroTime.ut === 'number'
            ? astroTime.ut + JD_J2000
            : null;

        if (!jd) {
            console.error("natal.js: error = JD (Julian Day) calculation failed");
            res.status(500).json({ error: "JD (Julian Day) calculation failed" });
            return;
        }
        console.log("natal.js: JD =", jd);

        // ======= ТРОПИЧЕСКИЕ ДОЛГОТЫ ПЛАНЕТ =======
        const planetNames = [
            'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'
        ];
        const positions = {};

        for (const pname of planetNames) {
            try {
                const resSw = await swe.calc_ut(jd, swe[pname.toUpperCase()], 0);
                const lon = (resSw.longitude + 360) % 360;
                positions[pname.toLowerCase()] = {
                    deg: Math.round(lon * 1000) / 1000,
                    sign: getZodiac(lon),
                    deg_in_sign: getDegreeInSign(lon),
                    deg_in_sign_str: getDegreeInSignStr(lon)
                };
            } catch (err) {
                console.error(`natal.js: ${pname} error =`, err);
                positions[pname.toLowerCase()] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: err.message };
            }
        }

        // Раху и Кету по swisseph
        try {
            const rahuRes = await swe.calc_ut(jd, swe.MEAN_NODE, 0);
            const rahuLon = (rahuRes.longitude + 360) % 360;
            positions["rahu"] = {
                deg: Math.round(rahuLon * 1000) / 1000,
                sign: getZodiac(rahuLon),
                deg_in_sign: getDegreeInSign(rahuLon),
                deg_in_sign_str: getDegreeInSignStr(rahuLon)
            };
            const ketuLon = (rahuLon + 180) % 360;
            positions["ketu"] = {
                deg: Math.round(ketuLon * 1000) / 1000,
                sign: getZodiac(ketuLon),
                deg_in_sign: getDegreeInSign(ketuLon),
                deg_in_sign_str: getDegreeInSignStr(ketuLon)
            };
        } catch (err) {
            console.error("natal.js: Rahu/Ketu error =", err);
            positions["rahu"] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: err.message };
            positions["ketu"] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: err.message };
        }

        // Асцендент (лагна) — тоже тропический
        try {
            const ascRes = await swe.houses(jd, latitude, longitude, 'P');
            const ascLon = (ascRes.ascendant + 360) % 360;
            positions["asc"] = {
                deg: Math.round(ascLon * 1000) / 1000,
                sign: getZodiac(ascLon),
                deg_in_sign: getDegreeInSign(ascLon),
                deg_in_sign_str: getDegreeInSignStr(ascLon)
            };
        } catch (e) {
            console.error("natal.js: asc error =", e);
            positions["asc"] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: e.message };
        }

        console.log("natal.js: finished positions", positions);

        res.status(200).json({
            date: date.toISOString(),
            jd,
            planets: positions
        });
    } catch (e) {
        console.error("natal.js: error =", e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
};