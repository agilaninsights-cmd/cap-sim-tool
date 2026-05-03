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