// ============================================
// Capsim Strategist — Helper Utilities
// ============================================

'use strict';

// --- Parsing Helpers ---

function parseIntSafe(val) {
    if (!val) return 0;
    var cleaned = val.toString().replace(/[$,%\s]/g, '').replace(/,/g, '');
    var n = parseInt(cleaned, 10);
    return isNaN(n) ? 0 : n;
}

function parseFloatSafe(val) {
    if (!val) return 0;
    var cleaned = val.toString().replace(/[$,%\s]/g, '').replace(/,/g, '');
    var n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function parseDollar(val) {
    if (!val) return 0;
    var cleaned = val.toString().replace(/[$,\s]/g, '');
    var n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function parsePercentInt(val) {
    if (!val) return 0;
    var cleaned = val.toString().replace(/[%\s]/g, '');
    var n = parseInt(cleaned, 10);
    return isNaN(n) ? 0 : n;
}

// --- Lookup Helpers ---

function findProduct(name) {
    for (var i = 0; i < appState.products.length; i++) {
        if (appState.products[i].name === name) return appState.products[i];
    }
    return null;
}

function getSegmentDisplayName(key) {
    var names = {
        'traditional': 'Traditional',
        'lowEnd': 'Low End',
        'highEnd': 'High End',
        'performance': 'Performance',
        'size': 'Size'
    };
    return names[key] || key;
}

// --- Date/Year Helpers ---
// These are used by products.js, simulation.js, and insights.js,
// so they live here (loaded first) to avoid load-order issues.

function getBaseYear() {
    // Determines the calendar year for the upcoming round.
    // If Round 2 ended Dec 31, 2028 → upcoming Round 3 covers 2029.
    if (!appState.endDate) return 2027 + (appState.upcomingRound || 1);
    var yearMatch = appState.endDate.match(/(\d{4})/);
    if (yearMatch) return parseInt(yearMatch[1], 10) + 1;
    return 2029;
}

function dateToMonth(dateStr, baseYear) {
    // Converts a date string to a month number (1-12) within baseYear.
    // Returns null if the date is not in baseYear.
    // Handles two formats:
    //   ISO: "2029-06-15" → month 6
    //   US:  "6/15/2029" or "6/15/29" → month 6
    if (!dateStr) return null;
    var parts;
    if (dateStr.indexOf('-') !== -1) {
        parts = dateStr.split('-');
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10);
        if (year !== baseYear) return null;
        return month;
    }
    parts = dateStr.split('/');
    if (parts.length >= 3) {
        var yr = parseInt(parts[2], 10);
        if (yr < 100) yr += 2000; // handle 2-digit years like "29" → 2029
        if (yr !== baseYear) return null;
        return parseInt(parts[0], 10);
    }
    return null;
}

// --- Multi-Year Date Helpers ---
// Used by simulation.js and products.js to handle the full multi-year timeline.

function getYearFromDate(dateStr) {
    // Extracts the 4-digit calendar year from either ISO "2029-06-15" or US "6/15/2029" format.
    if (!dateStr) return null;
    if (dateStr.indexOf('-') !== -1) return parseInt(dateStr.split('-')[0], 10);
    var parts = dateStr.split('/');
    if (parts.length >= 3) { var y = parseInt(parts[2], 10); return y < 100 ? y + 2000 : y; }
    return null;
}

function dateToGlobalMonth(dateStr, parsedRound) {
    // Converts a date string to a "global month" number.
    // Global month 0 = January of the first simulated year (round parsedRound+1).
    // E.g., if parsedRound=2, first year is 2029. "2029-06-15" -> globalMonth 6.
    //        "2030-03-10" -> globalMonth 15 (month 3 of second year).
    if (!dateStr) return null;
    var baseYear = getBaseYear();
    var year = getYearFromDate(dateStr);
    if (!year) return null;
    var monthInYear = null;
    if (dateStr.indexOf('-') !== -1) { monthInYear = parseInt(dateStr.split('-')[1], 10); }
    else { var parts = dateStr.split('/'); monthInYear = parseInt(parts[0], 10); }
    if (!monthInYear) return null;
    // Global month = (year - baseYear) * 12 + monthInYear
    return (year - baseYear) * 12 + monthInYear;
}

function globalMonthToInfo(globalMonth, parsedRound) {
    // Converts a global month number back to human-readable info.
    // Returns { round, year, monthIndex, monthName, fullMonthName, label }
    var baseYear = getBaseYear();
    var yearOffset = Math.floor(globalMonth / 12);
    var monthInYear = globalMonth % 12;
    var calendarYear = baseYear + yearOffset;
    var round = (parsedRound + 1) + yearOffset;
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var fullMonthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return {
        round: round,
        year: calendarYear,
        monthIndex: monthInYear,
        monthName: monthNames[monthInYear],
        fullMonthName: fullMonthNames[monthInYear],
        label: 'Round ' + round + ' \u2014 ' + fullMonthNames[monthInYear] + ' ' + daysInMonth[monthInYear] + ', ' + calendarYear
    };
}

// --- Summary Display ---

function showSummary(el, type, message) {
    el.className = 'parse-summary ' + type;
    el.innerHTML = '<p>' + message + '</p>';
    el.classList.remove('hidden');
}

function displaySuccessSummary(el, warnings) {
    var productCount = appState.products.length;
    var myProducts = appState.products.filter(function(p) { return p.company === appState.myCompany; });
    var segCount = Object.keys(appState.segments).length;
    var companies = [];
    appState.products.forEach(function(p) {
        if (companies.indexOf(p.company) === -1) companies.push(p.company);
    });

    var html = '';
    html += '<div class="round-display">Round ' + appState.round + ' parsed successfully (' + (appState.endDate || 'unknown date') + ')</div>';
    html += '<ul>';
    html += '<li>Found ' + productCount + ' products across ' + companies.length + ' companies</li>';
    // Per-company breakdown
    var companyBreakdown = [];
    for (var c = 0; c < companies.length; c++) {
        var count = appState.products.filter(function(p) { return p.company === companies[c]; }).length;
        companyBreakdown.push(companies[c] + ': ' + count);
    }
    html += '<li>' + companyBreakdown.join(', ') + '</li>';
    html += '<li>Extracted buying criteria for ' + segCount + ' segment' + (segCount !== 1 ? 's' : '') + '</li>';
    html += '<li>You are playing as <strong>' + appState.myCompany + '</strong> (' + myProducts.length + ' products)</li>';
    html += '<li>Upcoming round: <strong>' + appState.upcomingRound + '</strong></li>';
    html += '</ul>';

    if (warnings.length > 0) {
        html += '<h3 style="margin-top:0.75rem;color:#d97706;">Warnings</h3><ul>';
        for (var i = 0; i < warnings.length; i++) {
            html += '<li class="warning-item">' + warnings[i] + '</li>';
        }
        html += '</ul>';
    }

    var type = warnings.length > 0 ? 'has-warnings' : 'success';
    el.className = 'parse-summary ' + type;
    el.innerHTML = html;
    el.classList.remove('hidden');
}