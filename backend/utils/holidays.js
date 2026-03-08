/* =====================================================
   Holiday Utility — Hari Libur Nasional Indonesia
   Static list of national holidays, updated for 2026.
   ===================================================== */

/**
 * Get Indonesian national holidays for a given year.
 * These are fixed-date holidays. Islamic holidays shift each year
 * and should be updated annually.
 */
function getHolidays(year = new Date().getFullYear()) {
    // Fixed holidays (same date every year)
    const fixed = [
        { month: 1, day: 1, name: 'Tahun Baru Masehi' },
        { month: 2, day: 1, name: 'Tahun Baru Imlek' },
        { month: 3, day: 29, name: 'Hari Raya Nyepi' },
        { month: 5, day: 1, name: 'Hari Buruh Internasional' },
        { month: 5, day: 29, name: 'Hari Kenaikan Yesus Kristus' },
        { month: 6, day: 1, name: 'Hari Lahir Pancasila' },
        { month: 8, day: 17, name: 'Hari Kemerdekaan RI' },
        { month: 12, day: 25, name: 'Hari Natal' },
    ];

    // Islamic holidays (approximate dates for 2026, update annually)
    const islamic2026 = [
        { month: 1, day: 27, name: 'Isra Miraj Nabi Muhammad SAW' },
        { month: 3, day: 20, name: 'Hari Raya Idul Fitri 1447H (Hari 1)' },
        { month: 3, day: 21, name: 'Hari Raya Idul Fitri 1447H (Hari 2)' },
        { month: 5, day: 27, name: 'Hari Raya Idul Adha 1447H' },
        { month: 6, day: 17, name: 'Tahun Baru Islam 1448H' },
        { month: 8, day: 26, name: 'Maulid Nabi Muhammad SAW' },
    ];

    // Buddhist & Hindu holidays (approximate for 2026)
    const other2026 = [
        { month: 5, day: 12, name: 'Hari Raya Waisak' },
    ];

    // Cuti Bersama (joint leave, update annually)
    const cutiBersama2026 = [
        { month: 3, day: 19, name: 'Cuti Bersama Idul Fitri' },
        { month: 3, day: 22, name: 'Cuti Bersama Idul Fitri' },
        { month: 3, day: 23, name: 'Cuti Bersama Idul Fitri' },
        { month: 12, day: 24, name: 'Cuti Bersama Natal' },
        { month: 12, day: 26, name: 'Cuti Bersama Natal' },
    ];

    const allHolidays = [...fixed];

    // Only add year-specific holidays for matching year
    if (year === 2026) {
        allHolidays.push(...islamic2026, ...other2026, ...cutiBersama2026);
    }

    return allHolidays.map(h => ({
        date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
        name: h.name,
        month: h.month,
        day: h.day
    })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Check if a specific date is a national holiday.
 * @param {Date|string} date
 * @returns {{ isHoliday: boolean, name?: string }}
 */
function isHoliday(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const dateStr = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const holidays = getHolidays(year);
    const match = holidays.find(h => h.date === dateStr);

    // Also check Sunday
    const isSunday = d.getDay() === 0;

    return {
        isHoliday: !!match || isSunday,
        name: match ? match.name : (isSunday ? 'Hari Minggu' : null),
        isSunday
    };
}

module.exports = { getHolidays, isHoliday };
