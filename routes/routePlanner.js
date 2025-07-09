const express = require('express');
const router = express.Router();

// Function to generate circular routes around user location
function generateCircularRoute(center, radiusKm, numPoints = 12) {
  const routes = [];
  
  // Degrees per kilometer (approximate)
  const kmToLatDeg = 1 / 110.574; // 1 degree latitude ≈ 110.574 km
  const kmToLngDeg = 1 / (111.320 * Math.cos(center.lat * Math.PI / 180)); // longitude varies by latitude

  for (let i = 0; i < 3; i++) {
    const coordinates = [];
    const angleOffset = i * 120; // 120 degrees apart for better distribution

    for (let j = 0; j <= numPoints; j++) {
      const angle = (2 * Math.PI * j) / numPoints + (angleOffset * Math.PI / 180);
      
      // Calculate offset in degrees
      const latOffset = radiusKm * Math.sin(angle) * kmToLatDeg;
      const lngOffset = radiusKm * Math.cos(angle) * kmToLngDeg;

      const lat = center.lat + latOffset;
      const lng = center.lng + lngOffset;

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

// Function to generate linear routes from user location
function generateLinearRoutes(center, distanceKm) {
  const fakePOIs = ['Park View', 'City Square', 'Lake Side', 'Hill Point', 'River Trail'];
  
  // Degrees per kilometer (approximate)
  const kmToLatDeg = 1 / 110.574; // 1 degree latitude ≈ 110.574 km
  const kmToLngDeg = 1 / (111.320 * Math.cos(center.lat * Math.PI / 180)); // longitude varies by latitude

  const routes = [0, 90, 180].map((angle, i) => {
    const rad = angle * (Math.PI / 180);
    
    // Calculate the midpoint of the route
    const latOffset = (distanceKm / 2) * Math.sin(rad) * kmToLatDeg;
    const lngOffset = (distanceKm / 2) * Math.cos(rad) * kmToLngDeg;

    const midLat = center.lat + latOffset;
    const midLng = center.lng + lngOffset;

    return {
      id: i + 1,
      checkInPOI: fakePOIs[i] || `POI #${i + 1}`,
      coordinates: [
        { lat: center.lat, lng: center.lng }, // Start at user location
        { lat: midLat, lng: midLng },         // Midpoint
        { lat: center.lat, lng: center.lng }  // Return to start
      ]
    };
  });

  return routes;
}

router.post('/plan', (req, res) => {
  try {
    const { latitude, longitude, distance, routeType } = req.body;
    
    // Input validation
    if (!latitude || !longitude || !distance) {
      return res.status(400).json({ 
        error: 'Missing required fields: latitude, longitude, distance' 
      });
    }

    const baseLat = parseFloat(latitude);
    const baseLng = parseFloat(longitude);
    const dist = parseFloat(distance);

    // Validate parsed values
    if (isNaN(baseLat) || isNaN(baseLng) || isNaN(dist)) {
      return res.status(400).json({ 
        error: 'Invalid numeric values for latitude, longitude, or distance' 
      });
    }

    // Validate latitude and longitude ranges
    if (baseLat < -90 || baseLat > 90) {
      return res.status(400).json({ 
        error: 'Latitude must be between -90 and 90 degrees' 
      });
    }

    if (baseLng < -180 || baseLng > 180) {
      return res.status(400).json({ 
        error: 'Longitude must be between -180 and 180 degrees' 
      });
    }

    // Validate distance
    if (dist <= 0 || dist > 1000) {
      return res.status(400).json({ 
        error: 'Distance must be between 0 and 1000 km' 
      });
    }

    const center = { lat: baseLat, lng: baseLng };
    let routes;

    // Choose route generation method based on routeType parameter
    if (routeType === 'circular') {
      routes = generateCircularRoute(center, dist);
    } else {
      // Default to linear routes
      routes = generateLinearRoutes(center, dist);
    }

    res.json({ 
      routes,
      center,
      distance: dist,
      routeType: routeType || 'linear'
    });

  } catch (error) {
    console.error('Error generating routes:', error);
    res.status(500).json({ 
      error: 'Internal server error while generating routes' 
    });
  }
});

module.exports = router;