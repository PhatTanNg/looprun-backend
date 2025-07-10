const express = require('express');
const axios = require('axios');
const router = express.Router();

// Your Google Maps API key - should be in environment variables for production
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAsVf-rZCQmjfEK0_Al8JQLQGvDvqm4KGw';

// Generate strategic waypoints for Google Maps routing
function generateCircularWaypoints(center, radiusKm) {
  const waypoints = [];
  const numWaypoints = 4; // Fewer waypoints work better with Google Directions API
  
  const kmToLatDeg = 1 / 110.574;
  const kmToLngDeg = 1 / (111.320 * Math.cos(center.lat * Math.PI / 180));

  // Generate waypoints around the circle
  for (let i = 0; i < numWaypoints; i++) {
    const angle = (2 * Math.PI * i) / numWaypoints;
    
    // Vary the radius to make routes more interesting
    const currentRadius = radiusKm * (0.7 + Math.random() * 0.6);
    
    const lat = center.lat + currentRadius * Math.sin(angle) * kmToLatDeg;
    const lng = center.lng + currentRadius * Math.cos(angle) * kmToLngDeg;
    
    waypoints.push({ lat, lng });
  }

  return waypoints;
}

// Get actual runnable routes using Google Maps Directions API
async function getGoogleMapsRoutes(center, targetDistance) {
  const routes = [];
  
  try {
    // Generate 3 different routes with slight variations
    for (let i = 0; i < 3; i++) {
      const waypoints = generateCircularWaypoints(center, targetDistance * (0.8 + i * 0.1));
      
      // Build waypoints string for Google Maps API
      const waypointsStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${center.lat},${center.lng}&destination=${center.lat},${center.lng}&waypoints=optimize:true|${waypointsStr}&mode=walking&avoid=highways|tolls|ferries&units=metric&key=${GOOGLE_MAPS_API_KEY}`;
      
      const response = await axios.get(url);
      
      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        
        // Calculate total distance and duration
        const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000; // Convert to km
        const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60; // Convert to minutes
        
        // Extract coordinates from the route
        const coordinates = [];
        route.legs.forEach(leg => {
          leg.steps.forEach(step => {
            const polyline = step.polyline.points;
            const decoded = decodePolyline(polyline);
            coordinates.push(...decoded);
          });
        });
        
        // Extract turn-by-turn instructions
        const instructions = route.legs.map(leg => 
          leg.steps.map(step => ({
            instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
            distance: step.distance.text,
            duration: step.duration.text
          }))
        ).flat();
        
        routes.push({
          id: i + 1,
          coordinates,
          checkInPOI: `Runnable Route #${i + 1}`,
          distance: `${totalDistance.toFixed(1)} km`,
          duration: `${Math.round(totalDuration)} min`,
          description: `Actual runnable route following roads and paths`,
          isRunnable: true,
          instructions,
          startAddress: route.legs[0].start_address,
          endAddress: route.legs[route.legs.length - 1].end_address
        });
      }
    }
  } catch (error) {
    console.error('Error fetching Google Maps routes:', error);
    throw error;
  }
  
  return routes;
}

// Decode Google Maps polyline
function decodePolyline(encoded) {
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return poly;
}

// Main route planning endpoint - only returns actual runnable routes
router.post('/plan', async (req, res) => {
  try {
    const { latitude, longitude, distance } = req.body;
    
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
    if (dist <= 0 || dist > 20) {
      return res.status(400).json({ 
        error: 'Distance must be between 0 and 20 km for running routes' 
      });
    }

    const center = { lat: baseLat, lng: baseLng };
    
    // Get only actual runnable routes from Google Maps
    const routes = await getGoogleMapsRoutes(center, dist);
    
    if (routes.length === 0) {
      return res.status(500).json({
        error: 'Unable to generate runnable routes for this location. Please try a different area.'
      });
    }

    res.json({ 
      routes,
      center,
      distance: dist,
      routeType: 'runnable',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating routes:', error);
    
    // Provide more specific error messages
    if (error.response && error.response.data) {
      const googleError = error.response.data.error_message || error.response.data.status;
      return res.status(500).json({ 
        error: `Google Maps API error: ${googleError}` 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error while generating routes' 
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    googleMapsApiConfigured: !!GOOGLE_MAPS_API_KEY
  });
});

module.exports = router;