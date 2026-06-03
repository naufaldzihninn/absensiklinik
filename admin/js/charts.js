/* =====================================================
   Charts Module — Chart.js Renderers
   ===================================================== */

const Charts = (() => {
    /**
     * Render attendance donut chart
     */
    function renderAttendanceDonut(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Tepat Waktu', 'Terlambat', 'Alpa'],
                datasets: [{
                    data: [data.tepatWaktu, data.telat, data.alpa],
                    backgroundColor: ['#22C55E', '#F59E0B', '#EF4444'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                            font: { family: 'Inter', size: 12, weight: '500' }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render weekly attendance bar chart
     * @param {string} canvasId - Canvas element ID
     * @param {Array} trendData - Array of { label, tepatWaktu, terlambat }
     */
    function renderWeeklyBar(canvasId, trendData) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        // Fallback to empty placeholders if no real data yet
        const data = trendData && trendData.length > 0 ? trendData : [
            { label: 'Sen', tepatWaktu: 0, terlambat: 0 },
            { label: 'Sel', tepatWaktu: 0, terlambat: 0 },
            { label: 'Rab', tepatWaktu: 0, terlambat: 0 },
            { label: 'Kam', tepatWaktu: 0, terlambat: 0 },
            { label: 'Jum', tepatWaktu: 0, terlambat: 0 },
        ];

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.label),
                datasets: [
                    {
                        label: 'Tepat Waktu',
                        data: data.map(d => d.tepatWaktu),
                        backgroundColor: '#22C55E',
                        borderRadius: 6,
                        barPercentage: 0.6
                    },
                    {
                        label: 'Terlambat',
                        data: data.map(d => d.terlambat),
                        backgroundColor: '#F59E0B',
                        borderRadius: 6,
                        barPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter', size: 12 } }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { font: { family: 'Inter', size: 12 }, stepSize: 2 },
                        grid: { color: '#F1F5F9' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                            font: { family: 'Inter', size: 12, weight: '500' }
                        }
                    }
                }
            }
        });
    }

    return { renderAttendanceDonut, renderWeeklyBar };
})();
