const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const SECRET_PIN = "1234"; // Aap apna PIN yahan change karen

// Mock Data (Yahan aap apne DB se data fetch karenge)
const getStockData = () => {
    return [
        { name: "Item A", qty: 100, amount: 5000 },
        { name: "Item B", qty: 50, amount: 2000 },
    ];
};

// Middleware for PIN Verification
const verifyPin = (req, res, next) => {
    const userPin = req.headers['x-access-pin'];
    if (userPin === SECRET_PIN) {
        next();
    } else {
        res.status(403).json({ error: "Wrong PIN! Access Denied." });
    }
};

// API Endpoint for Reports
app.get('/api/stock', verifyPin, (req, res) => {
    const data = getStockData();
    res.json(data);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}. Mobile can connect now.`);
});