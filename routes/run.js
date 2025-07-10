const express = require('express');
const router = express.Router();
const Run = require('../models/Run');

router.post('/save', async (req, res) => {
  try {
    const { distanceKm, durationMin, coordinates } = req.body;

    const run = new Run({
      distanceKm,
      durationMin,
      coordinates
    });

    await run.save();
    res.status(201).json({ message: 'Run saved successfully', run });
  } catch (err) {
    console.error('Error saving run:', err);
    res.status(500).json({ error: 'Failed to save run' });
  }
});

module.exports = router;
