const express = require('express');
const router = express.Router();

// Hàm mock tạo vòng tròn lộ trình quanh user
function generateCircularRoute(center, radiusKm, numPoints = 12) {
  const routes = [];
  const earthRadius = 6371;

  for (let i = 0; i < 3; i++) {
    const coordinates = [];
    const angleOffset = i * 20;

    for (let j = 0; j <= numPoints; j++) {
      const angle = (2 * Math.PI * j) / numPoints + (angleOffset * Math.PI / 180);
      const dx = radiusKm / earthRadius * Math.cos(angle);
      const dy = radiusKm / earthRadius * Math.sin(angle);

      const lat = center.lat + (dy * 180) / Math.PI;
      const lng = center.lng + (dx * 180) / Math.PI / Math.cos(center.lat * Math.PI / 180);

      coordinates.push({ lat, lng });
    }

    routes.push({
      id: i + 1,
      coordinates,
      checkInPOI: `Viewpoint #${i + 1}`,
    });
  }

  return routes;
}

router.post('/plan', (req, res) => {
  const { latitude, longitude, distance } = req.body;

  if (!latitude || !longitude || !distance) {
    return res.status(400).json({ error: 'Missing input data' });
  }

  const center = { lat: latitude, lng: longitude };
  const routes = generateCircularRoute(center, distance / 2); // half distance = radius

  res.json({ routes });
});

module.exports = router;
