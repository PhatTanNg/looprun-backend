const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const History = require('../models/History');

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

router.post('/', authMiddleware, async (req, res) => {
    const { distance } = req.body;
    if (!distance || distance <= 0) {
        return res.status(400).json({ message: 'Invalid distance' });
    }

    const history = new History({
        userId: req.userId,
        distance
    });

    await history.save();
    res.json({ message: 'Tracking saved' });
});

router.get('/', authMiddleware, async (req, res) => {
    const history = await History.find({ userId: req.userId });
    res.json(history);
});

module.exports = router;
