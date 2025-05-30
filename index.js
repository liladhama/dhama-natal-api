const express = require('express');
const natalApi = require('./api/natal.js');
const app = express();

app.use(express.json());
app.post('/api/natal', natalApi);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});