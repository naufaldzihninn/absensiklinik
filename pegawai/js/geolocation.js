/* =====================================================
   Geolocation Module — GPS & Geo-fencing
   ===================================================== */

const Geolocation = (() => {
    // Default clinic location (will be fetched from API in production)
    let clinicLat = -6.200000;
    let clinicLng = 106.816666;
    let radiusMeters = 50;

    /**
     * Set clinic coordinates (from settings)
     */
    function setClinicLocation(lat, lng, radius) {
        clinicLat = lat;
        clinicLng = lng;
        if (radius) radiusMeters = radius;
    }

    /**
     * Get current GPS position
     * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
     */
    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('GPS tidak didukung oleh browser ini.'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            reject(new Error('Akses GPS ditolak. Silakan aktifkan izin lokasi.'));
                            break;
                        case error.POSITION_UNAVAILABLE:
                            reject(new Error('Informasi lokasi tidak tersedia.'));
                            break;
                        case error.TIMEOUT:
                            reject(new Error('Permintaan lokasi timeout. Coba lagi.'));
                            break;
                        default:
                            reject(new Error('Gagal mendapatkan lokasi GPS.'));
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     * @returns {number} Distance in meters
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Check if user is within clinic radius
     * @returns {Promise<{inRange: boolean, distance: number, coords: object}>}
     */
    async function checkInRange() {
        const position = await getCurrentPosition();
        const distance = calculateDistance(
            position.latitude, position.longitude,
            clinicLat, clinicLng
        );

        return {
            inRange: distance <= radiusMeters,
            distance: Math.round(distance),
            coords: position,
            radius: radiusMeters
        };
    }

    /**
     * Mock check for development (always in range)
     */
    function mockCheckInRange() {
        return Promise.resolve({
            inRange: true,
            distance: Math.floor(Math.random() * 30) + 5,
            coords: {
                latitude: clinicLat + (Math.random() - 0.5) * 0.001,
                longitude: clinicLng + (Math.random() - 0.5) * 0.001,
                accuracy: 10
            },
            radius: radiusMeters
        });
    }

    return {
        setClinicLocation,
        getCurrentPosition,
        calculateDistance,
        haversineDistance: calculateDistance,
        checkInRange,
        mockCheckInRange
    };
})();
