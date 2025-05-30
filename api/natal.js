const { DateTime } = require("luxon");
const swe = require("swisseph");
const path = require("path");
const Astronomy = require("astronomy-engine");

// Указываем путь к эфемеридам
swe.set_ephe_path(path.join(__dirname, '../ephe'));

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

// Promise-обёртка для swisseph calc_ut
function calcUtAsync(jd, planet, flags) {
    return new Promise((resolve, reject) => {
        swe.calc_ut(jd, planet, flags, (res) => {
            if (res.error) reject(new Error(res.error));
            else resolve(res);
        });
    });
}

// Promise-обёртка для swisseph houses
function housesAsync(jd, lat, lon, hsys) {
    return new Promise((resolve, reject) => {
        swe.houses(jd, lat, lon, hsys, (res) => {
            if (res.error) reject(new Error(res.error));
            else resolve(res);
        });
    });
}

// Promise-обёртка для swisseph get_ayanamsa
function ayanamsaAsync(jd) {
    return new Promise((resolve, reject) => {
        swe.get_ayanamsa(jd, (res) => {
            if (res.error) reject(new Error(res.error));
            else resolve(res.ayanamsa);
        });
    });
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
        const { year, month, day, hour, minute, latitude, longitude, tzOffset } = req.body || {};

        if (
            year === undefined || month === undefined || day === undefined ||
            hour === undefined || minute === undefined ||
            latitude === undefined || longitude === undefined
        ) {
            res.status(400).json({ error: "Missing parameters" });
            return;
        }

        // Переводим дату в UTC без смещения (tzOffset - в часах)
        const dt = DateTime.fromObject(
            { year, month, day, hour, minute },
            { zone: "UTC" }
        ).minus({ hours: tzOffset || 0 });

        const date = new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute));
        const JD_J2000 = 2451545.0;
        const astroTime = Astronomy.MakeTime(date);
        const jd = astroTime && typeof astroTime.ut === 'number'
            ? astroTime.ut + JD_J2000
            : null;

        if (!jd) {
            res.status(500).json({ error: "JD (Julian Day) calculation failed" });
            return;
        }

        // Получаем айанамшу
        let ayanamsa = null;
        try {
            ayanamsa = await ayanamsaAsync(jd);
        } catch (e) {
            res.status(500).json({ error: "Ayanamsa calculation failed", stack: e.stack });
            return;
        }

        const planetNames = [
            { key: 'sun', val: swe.SUN },
            { key: 'moon', val: swe.MOON },
            { key: 'mercury', val: swe.MERCURY },
            { key: 'venus', val: swe.VENUS },
            { key: 'mars', val: swe.MARS },
            { key: 'jupiter', val: swe.JUPITER },
            { key: 'saturn', val: swe.SATURN }
        ];
        const positions = {};

        for (const { key, val } of planetNames) {
            try {
                const resSw = await calcUtAsync(jd, val, swe.FLAG_SIDEREAL);
                const siderealLon = (resSw.longitude + 360) % 360;
                positions[key] = {
                    deg: Math.round(siderealLon * 1000) / 1000,
                    sign: getZodiac(siderealLon),
                    deg_in_sign: getDegreeInSign(siderealLon),
                    deg_in_sign_str: getDegreeInSignStr(siderealLon)
                };
            } catch (err) {
                positions[key] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: err.message };
            }
        }

        // Раху и Кету
        try {
            const rahuRes = await calcUtAsync(jd, swe.MEAN_NODE, swe.FLAG_SIDEREAL);
            const rahuSidereal = (rahuRes.longitude + 360) % 360;
            positions["rahu"] = {
                deg: Math.round(rahuSidereal * 1000) / 1000,
                sign: getZodiac(rahuSidereal),
                deg_in_sign: getDegreeInSign(rahuSidereal),
                deg_in_sign_str: getDegreeInSignStr(rahuSidereal)
            };
            const ketuSidereal = (rahuSidereal + 180) % 360;
            positions["ketu"] = {
                deg: Math.round(ketuSidereal * 1000) / 1000,
                sign: getZodiac(ketuSidereal),
                deg_in_sign: getDegreeInSign(ketuSidereal),
                deg_in_sign_str: getDegreeInSignStr(ketuSidereal)
            };
        } catch (err) {
            positions["rahu"] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: err.message };
            positions["ketu"] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: err.message };
        }

        // Асцендент (лагна)
        try {
            const ascRes = await housesAsync(jd, latitude, longitude, 'P');
            const ascSidereal = (ascRes.ascendant + 360) % 360;
            positions["asc"] = {
                deg: Math.round(ascSidereal * 1000) / 1000,
                sign: getZodiac(ascSidereal),
                deg_in_sign: getDegreeInSign(ascSidereal),
                deg_in_sign_str: getDegreeInSignStr(ascSidereal)
            };
        } catch (e) {
            positions["asc"] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: e.message };
        }

        res.status(200).json({
            date: date.toISOString(),
            jd,
            ayanamsa,
            planets: positions
        });
    } catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
};