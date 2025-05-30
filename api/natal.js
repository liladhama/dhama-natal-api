const { DateTime } = require("luxon");
const swe = require("swisseph"); // добавляем swisseph для ведической точности
const Astronomy = require("astronomy-engine");
const Body = Astronomy.Body;

const JD_J2000 = 2451545.0;

// Используем swisseph для точной Лахири айанамши (ведическое стандартное)
function getLahiriAyanamsa(jd) {
    return swe.get_ayanamsa_ut_sync(jd);
}

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
function meanLunarNodeLongitude(jd) {
    const T = (jd - JD_J2000) / 36525.0;
    let omega = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
    omega = ((omega % 360) + 360) % 360;
    return omega;
}

// ВАЖНО: Разрешаем CORS только для нужного домена!
function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://dhama-sage.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function eclipticLongitude(ra, dec, date) {
    const time = Astronomy.MakeTime(date);
    const radRA = ra * 15 * Math.PI / 180;
    const radDec = dec * Math.PI / 180;
    const x = Math.cos(radDec) * Math.cos(radRA);
    const y = Math.cos(radDec) * Math.sin(radRA);
    const z = Math.sin(radDec);
    const vec = { x, y, z, t: time };
    const ecl = Astronomy.Ecliptic(vec);
    let lon = ecl.elon;
    lon = (lon + 360) % 360;
    return lon;
}

// ============= ОСНОВНОЙ ЭКСПОРТ ==============
module.exports = async (req, res) => {
    setCORSHeaders(res);

    // Явная обработка preflight-запроса
    if (req.method === 'OPTIONS') {
        setCORSHeaders(res);
        return res.status(204).end();
    }

    // Безопасный парсер тела запроса с таймаутом
    if (req.method === 'POST' && !req.body) {
        let body = '';
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            req.destroy();
        }, 3000);

        try {
            await new Promise((resolve, reject) => {
                req.on('data', (chunk) => {
                    if (!timedOut) body += chunk;
                });
                req.on('end', () => {
                    clearTimeout(timeout);
                    if (!timedOut) resolve();
                });
                req.on('error', (e) => {
                    clearTimeout(timeout);
                    reject(e);
                });
            });
            if (timedOut) throw new Error('Timeout reading body');
            req.body = JSON.parse(body);
        } catch (e) {
            setCORSHeaders(res);
            res.status(400).json({ error: 'Invalid or empty JSON in request body', stack: e.stack });
            return;
        }
    }

    if (req.method !== "POST") {
        setCORSHeaders(res);
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
            setCORSHeaders(res);
            res.status(400).json({ error: "Missing parameters" });
            return;
        }

        // Переводим дату в UTC без смещения (tzOffset - в часах)
        const dt = DateTime.fromObject(
            { year, month, day, hour, minute },
            { zone: "UTC" }
        ).minus({ hours: tzOffset || 0 });

        const date = new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute));

        const astroTime = Astronomy.MakeTime(date);
        const jd = astroTime && typeof astroTime.ut === 'number'
            ? astroTime.ut + JD_J2000
            : null;

        if (!jd) {
            setCORSHeaders(res);
            res.status(500).json({ error: "JD (Julian Day) calculation failed" });
            return;
        }

        // ======= ВЕДИЧЕСКИЙ АЯНАМША С ПОМОЩЬЮ swisseph =======
        swe.set_ephe_path(__dirname);
        swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0);
        const ayanamsa = swe.get_ayanamsa_ut_sync(jd);

        const planetNames = [
            'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'
        ];
        const positions = {};

        for (const pname of planetNames) {
            let siderealLon = null;
            try {
                const resSw = swe.calc_ut_sync(jd, swe[pname.toUpperCase()], swe.FLAG_SIDEREAL);
                siderealLon = (resSw.longitude + 360) % 360;
                positions[pname.toLowerCase()] = {
                    deg: Math.round(siderealLon * 1000) / 1000,
                    sign: getZodiac(siderealLon),
                    deg_in_sign: getDegreeInSign(siderealLon),
                    deg_in_sign_str: getDegreeInSignStr(siderealLon)
                };
            } catch (err) {
                positions[pname.toLowerCase()] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: err.message };
            }
        }

        // Раху и Кету по swisseph
        try {
            const rahuRes = swe.calc_ut_sync(jd, swe.MEAN_NODE, swe.FLAG_SIDEREAL);
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
        let ascSidereal = null;
        try {
            const ascRes = swe.houses_ex_sync(jd, latitude, longitude, 'P', swe.FLAG_SIDEREAL);
            ascSidereal = (ascRes.ascendant + 360) % 360;
            positions["asc"] = {
                deg: Math.round(ascSidereal * 1000) / 1000,
                sign: getZodiac(ascSidereal),
                deg_in_sign: getDegreeInSign(ascSidereal),
                deg_in_sign_str: getDegreeInSignStr(ascSidereal)
            };
        } catch (e) {
            positions["asc"] = { deg: null, sign: null, deg_in_sign: null, deg_in_sign_str: null, error: e.message };
        }

        setCORSHeaders(res);
        res.status(200).json({
            date: date.toISOString(),
            jd,
            ayanamsa,
            planets: positions
        });
    } catch (e) {
        setCORSHeaders(res);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
};