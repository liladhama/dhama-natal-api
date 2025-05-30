const express = require("express");
const cors = require("cors");
const natalHandler = require("./natal"); // твой файл с расчетами

const app = express();

app.use(cors({
  origin: "https://dhama-sage.vercel.app", // твой фронт
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "1mb" }));

// эндпоинт для расчетов
app.post("/api/natal", natalHandler);

// опционально: обработка preflight-запросов (OPTIONS)
app.options("/api/natal", (req, res) => {
  res.sendStatus(204);
});

// опционально: healthcheck
app.get("/", (req, res) => res.send("API alive"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});