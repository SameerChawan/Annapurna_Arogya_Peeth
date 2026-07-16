const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Function to read data from JSON file
function readData(fileName) {
  const filePath = path.join(__dirname, 'data', fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Routes
app.get('/', (req, res) => {
  const products = readData('products.json');
  res.render('index', { products, lang: 'en' });
});

app.get('/mr', (req, res) => {
  const products = readData('products.json');
  res.render('index', { products, lang: 'mr' });
});

app.get('/market-research', (req, res) => {
  res.render('market_research', { lang: 'mr' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
