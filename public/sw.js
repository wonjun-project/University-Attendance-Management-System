// Service Worker for background GPS tracking
let isTracking = false;
let attendanceId = null;
let trackingInterval = null;
let sessionData = null;

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'START_TRACKING':
      startLocationTracking(data.attendanceId, data.sessionData);
      break;
    case 'STOP_TRACKING':
      stopLocationTracking();
      break;
    case 'GET_STATUS':
      event.ports[0].postMessage({
        isTracking,
        attendanceId,
        sessionData
      });
      break;
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(syncLocation());
  }
});

async function startLocationTracking(attId, sessData) {
  if (isTracking) return;

  attendanceId = attId;
  sessionData = sessData;
  isTracking = true;

  console.log('🎯 Service Worker: GPS 추적 시작', attendanceId);

  // Initial location check
  await trackLocation();

  // Set up periodic tracking (every 30 seconds)
  trackingInterval = setInterval(async () => {
    await trackLocation();
  }, 30000);

  // Notify main thread
  notifyClients('TRACKING_STARTED', { attendanceId, sessionData });
}

function stopLocationTracking() {
  if (!isTracking) return;

  console.log('🛑 Service Worker: GPS 추적 중지');

  isTracking = false;
  attendanceId = null;
  sessionData = null;

  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  // Notify main thread
  notifyClients('TRACKING_STOPPED');
}

async function trackLocation() {
  if (!isTracking || !attendanceId) return;

  try {
    // Check if geolocation is available
    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported');
    }

    const position = await getCurrentPosition();
    const { latitude, longitude, accuracy } = position.coords;

    console.log('📍 Service Worker: 위치 확인', { latitude, longitude, accuracy });

    // Send location to server
    const response = await fetch('/api/location/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attendanceId,
        latitude,
        longitude,
        accuracy,
        source: 'service-worker'
      }),
    });

    const result = await response.json();

    if (response.ok) {
      const locationValid = Boolean(result.locationValid);

      // Notify main thread about location status
      notifyClients('LOCATION_UPDATE', {
        latitude,
        longitude,
        accuracy,
        locationValid,
        distance: result.distance,
        allowedRadius: result.allowedRadius,
        timestamp: new Date().toISOString()
      });

      if (!locationValid) {
        console.warn('⚠️ Service Worker: 강의실 범위 이탈!', result);
      }
    } else {
      console.error('❌ Service Worker: 위치 추적 실패', result);
    }

  } catch (error) {
    console.error('❌ Service Worker: GPS 추적 오류', error);

    // Notify main thread about error
    notifyClients('TRACKING_ERROR', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      }
    );
  });
}

async function syncLocation() {
  if (isTracking && attendanceId) {
    await trackLocation();
  }
}

function notifyClients(type, data = {}) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type,
        data,
        timestamp: new Date().toISOString()
      });
    });
  });
}

// Handle background sync registration
self.addEventListener('backgroundsync', (event) => {
  if (event.tag === 'location-tracking') {
    event.waitUntil(syncLocation());
  }
});

// Periodic background task (when supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-periodic') {
    event.waitUntil(trackLocation());
  }
});