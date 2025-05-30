const express = require("express");
const cors = require("cors");
const natalHandler = require("./api/natal"); // <-- фиксированный путь

const app = express();

app.use(cors({
  origin: "https://dhama-sage.vercel.app",
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "1mb" }));

app.post("/api/natal", natalHandler);
app.options("/api/natal", (req, res) => res.sendStatus(204));
app.get("/", (req, res) => res.send("API alive"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});