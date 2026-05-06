// ============================================
// Capsim Strategist — Performance Review Tab
// Renders trend chart, comparison table, insights, and round cards
// using data from appState.history (filtered by appState.compareRounds).
// ============================================
'use strict';

var PERF_COMPANIES = ['Andrews', 'Baldwin', 'Chester', 'Digby', 'Erie', 'Ferris'];
var PERF_METRICS = [
    { key: 'sales', label: 'Sales', format: 'dollar' },
    { key: 'ebit', label: 'EBIT', format: 'dollar' },
    { key: 'profit', label: 'Net Profit', format: 'dollar' },
    { key: 'cumulativeProfit', label: 'Cumulative Profit', format: 'dollar' },
    { key: 'ros', label: 'ROS (%)', format: 'percent' },
    { key: 'roa', label: 'ROA (%)', format: 'percent' },
    { key: 'stockPrice', label: 'Stock Price', format: 'dollar2' }
];

// --- Main entry point ---
function renderPerformanceTab() {
    var empty = document.getElementById('performance-empty');
    var content = document.getElementById('performance-content');

    if (appState.history.length < 2) {
        empty.classList.remove('hidden');
        content.classList.add('hidden');
        return;
    }
    empty.classList.add('hidden');
    content.classList.remove('hidden');

    // Always sync compareRounds with history: remove stale entries, add missing ones
    var historyRounds = appState.history.map(function(h) { return h.round; });
    appState.compareRounds = appState.compareRounds.filter(function(r) { return historyRounds.indexOf(r) !== -1; });
    // If fewer than 2 remain (or empty), reset to all saved rounds
    if (appState.compareRounds.length < 2) {
        appState.compareRounds = historyRounds.slice();
    }

    var html = '';
    html += renderRoundFilter();
    html += '<div id="perf-sections">';
    html += renderTrendChart();
    html += renderComparisonTable();
    html += renderDeterministicInsights();
    html += renderRoundCards();
    html += renderAiReview();
    html += '</div>';
    content.innerHTML = html;

    attachFilterListenersPerf();
    attachMetricDropdownListener();
    attachAiReviewListener();
}

// --- Round Filter Checkboxes ---
function renderRoundFilter() {
    var h = '<div class="perf-filter-row">';
    h += '<span class="perf-filter-label">Compare rounds:</span>';
    appState.history.forEach(function(snap) {
        var checked = appState.compareRounds.indexOf(snap.round) !== -1 ? ' checked' : '';
        h += '<label class="perf-pill"><input type="checkbox" class="perf-round-cb" value="' + snap.round + '"' + checked + '> R' + snap.round + '</label>';
    });
    h += '</div>';
    return h;
}

// --- Section 5: AI Strategic Review ---
// Uses the same Gemini integration as the Insights tab but with a retrospective prompt.

function renderAiReview() {
    var h = '<h3 class="section-heading">AI Strategic Review</h3>';
    h += '<p class="ai-description">Generate a Gemini-powered retrospective analysis of your team\'s performance across saved rounds.</p>';
    h += '<button class="btn-primary" id="perf-ai-btn">Generate AI Strategic Review</button>';
    h += '<div id="perf-ai-response" class="ai-response hidden"></div>';
    return h;
}

function attachAiReviewListener() {
    var btn = document.getElementById('perf-ai-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
        var key = appState.geminiKey;
        if (!key) {
            var responseDiv = document.getElementById('perf-ai-response');
            responseDiv.classList.remove('hidden');
            responseDiv.innerHTML = '<div class="ai-error">Please enter your Gemini API key in the Insights tab first.</div>';
            return;
        }
        callPerfAi(key);
    });
}

function callPerfAi(key) {
    var responseDiv = document.getElementById('perf-ai-response');
    var btn = document.getElementById('perf-ai-btn');
    responseDiv.classList.remove('hidden');
    responseDiv.innerHTML = '<div class="ai-loading">Generating strategic review\u2026</div>';
    btn.disabled = true;

    var prompt = buildPerfAiPrompt();
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
    var body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1800 }
    });

    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: body })
        .then(function(res) {
            if (!res.ok) throw new Error('API error: ' + res.status);
            return res.json();
        })
        .then(function(data) {
            var text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
            if (!text) throw new Error('No response.');
            responseDiv.innerHTML = '<div class="ai-response-text">' + text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</div>';
            btn.disabled = false;
        })
        .catch(function(err) {
            responseDiv.innerHTML = '<div class="ai-error">' + err.message + '</div>';
            btn.disabled = false;
        });
}

function buildPerfAiPrompt() {
    var filtered = getFilteredHistory();
    var p = 'You are a Capsim strategy coach reviewing team Andrews\' performance across ' + filtered.length + ' rounds. Be direct and specific.\n\n';
    p += 'ROUND DATA (only checked rounds):\n';
    filtered.forEach(function(snap) {
        var fin = snap.financials.Andrews || {};
        p += 'R' + snap.round + ': Sales $' + ((fin.sales||0)/1e6).toFixed(1) + 'M, Profit $' + ((fin.profit||0)/1e6).toFixed(1) + 'M, CumProfit $' + ((fin.cumulativeProfit||0)/1e6).toFixed(1) + 'M, ROS ' + (fin.ros||0) + '%, Stock $' + (fin.stockPrice||0);
        if (fin.emergencyLoan > 0) p += ' [EMERGENCY LOAN $' + (fin.emergencyLoan/1e6).toFixed(1) + 'M]';
        p += '\n';
    });
    p += '\nCOMPETITOR COMPARISON (latest round R' + filtered[filtered.length-1].round + '):\n';
    var lastSnap = filtered[filtered.length-1];
    PERF_COMPANIES.forEach(function(co) {
        if (co === 'Andrews') return;
        var fin = lastSnap.financials[co] || {};
        p += co + ': Sales $' + ((fin.sales||0)/1e6).toFixed(0) + 'M, CumProfit $' + ((fin.cumulativeProfit||0)/1e6).toFixed(0) + 'M, Stock $' + (fin.stockPrice||0) + '\n';
    });
    p += '\nTASK: Produce a 300-word strategic retrospective covering:\n1. What went right for Andrews\n2. What went wrong\n3. Current competitive position\n4. Recommendations for remaining rounds\n\nBe direct, specific to the numbers, and actionable.';
    return p;
}

function attachFilterListenersPerf() {
    document.querySelectorAll('.perf-round-cb').forEach(function(cb) {
        cb.addEventListener('change', function() {
            // Rebuild compareRounds from checked boxes
            var checked = [];
            document.querySelectorAll('.perf-round-cb:checked').forEach(function(c) {
                checked.push(parseInt(c.value));
            });
            // Enforce minimum 2
            if (checked.length < 2) {
                cb.checked = true; // revert
                return;
            }
            appState.compareRounds = checked.sort(function(a, b) { return a - b; });
            // Re-render sections only (not the filter itself)
            var sections = document.getElementById('perf-sections');
            if (sections) {
                sections.innerHTML = renderTrendChart() + renderComparisonTable() + renderDeterministicInsights() + renderRoundCards();
                attachMetricDropdownListener();
            }
        });
    });
}

// --- Helper: get filtered history ---
function getFilteredHistory() {
    return appState.history.filter(function(h) {
        return appState.compareRounds.indexOf(h.round) !== -1;
    });
}

// --- Section 1: Trend Chart (SVG) ---
function renderTrendChart() {
    var h = '<h3 class="section-heading">Trend Lines</h3>';
    h += '<div class="perf-chart-controls"><label>Metric: </label>';
    h += '<select id="perf-metric-select">';
    PERF_METRICS.forEach(function(m, i) {
        h += '<option value="' + m.key + '"' + (i === 0 ? ' selected' : '') + '>' + m.label + '</option>';
    });
    h += '</select></div>';
    h += '<div id="perf-chart-container">' + buildTrendSvg('sales') + '</div>';
    return h;
}

function attachMetricDropdownListener() {
    var sel = document.getElementById('perf-metric-select');
    if (!sel) return;
    sel.addEventListener('change', function() {
        var container = document.getElementById('perf-chart-container');
        if (container) container.innerHTML = buildTrendSvg(sel.value);
    });
}

function buildTrendSvg(metricKey) {
    var filtered = getFilteredHistory();
    if (filtered.length < 2) return '<p class="empty-state">Not enough data.</p>';

    var W = 600, H = 250, PAD = 50;
    var rounds = filtered.map(function(h) { return h.round; });

    // Get all values for Y-axis scaling
    var allVals = [];
    filtered.forEach(function(snap) {
        PERF_COMPANIES.forEach(function(co) {
            var v = snap.financials[co] ? snap.financials[co][metricKey] : 0;
            if (v !== undefined) allVals.push(v);
        });
    });
    var minVal = Math.min.apply(null, allVals);
    var maxVal = Math.max.apply(null, allVals);
    if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
    var range = maxVal - minVal;

    function xPos(idx) { return PAD + (idx / (filtered.length - 1)) * (W - 2 * PAD); }
    function yPos(val) { return H - PAD - ((val - minVal) / range) * (H - 2 * PAD); }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="perf-chart-svg">';
    // Y-axis labels
    for (var t = 0; t <= 4; t++) {
        var v = minVal + (t / 4) * range;
        var y = yPos(v);
        svg += '<line x1="' + PAD + '" y1="' + y + '" x2="' + (W - PAD) + '" y2="' + y + '" stroke="#e5e7eb" stroke-width="0.5"/>';
        svg += '<text x="' + (PAD - 5) + '" y="' + (y + 3) + '" text-anchor="end" font-size="9" fill="#6b7280">' + formatMetricShort(v, metricKey) + '</text>';
    }
    // X-axis labels
    filtered.forEach(function(snap, idx) {
        var x = xPos(idx);
        svg += '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="middle" font-size="10" fill="#374151">R' + snap.round + '</text>';
    });
    // Lines per company
    PERF_COMPANIES.forEach(function(co) {
        var color = co === 'Andrews' ? '#2563eb' : '#9ca3af';
        var width = co === 'Andrews' ? '2.5' : '1';
        var points = [];
        filtered.forEach(function(snap, idx) {
            var val = snap.financials[co] ? snap.financials[co][metricKey] || 0 : 0;
            points.push(xPos(idx) + ',' + yPos(val));
        });
        svg += '<polyline fill="none" stroke="' + color + '" stroke-width="' + width + '" points="' + points.join(' ') + '"/>';
        // Dots
        filtered.forEach(function(snap, idx) {
            var val = snap.financials[co] ? snap.financials[co][metricKey] || 0 : 0;
            var r = co === 'Andrews' ? '4' : '2.5';
            svg += '<circle cx="' + xPos(idx) + '" cy="' + yPos(val) + '" r="' + r + '" fill="' + color + '"/>';
        });
    });
    svg += '</svg>';
    return svg;
}

function formatMetricShort(val, key) {
    if (key === 'ros' || key === 'roa' || key === 'roe') return val.toFixed(1) + '%';
    if (key === 'stockPrice') return '$' + val.toFixed(0);
    if (Math.abs(val) >= 1000000) return '$' + (val / 1000000).toFixed(0) + 'M';
    if (Math.abs(val) >= 1000) return '$' + (val / 1000).toFixed(0) + 'K';
    return '$' + val.toFixed(0);
}

// --- Section 2: Comparison Table ---
function renderComparisonTable() {
    var filtered = getFilteredHistory();
    var metricKey = 'sales'; // default, could be dynamic later
    var h = '<h3 class="section-heading">Comparison Table (Sales)</h3>';
    h += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Company</th>';
    filtered.forEach(function(snap) { h += '<th>R' + snap.round + '</th>'; });
    h += '</tr></thead><tbody>';
    PERF_COMPANIES.forEach(function(co) {
        var cls = co === 'Andrews' ? ' style="font-weight:700;color:#2563eb"' : '';
        h += '<tr' + cls + '><td>' + co + '</td>';
        filtered.forEach(function(snap) {
            var val = snap.financials[co] ? snap.financials[co].sales || 0 : 0;
            h += '<td>$' + (val / 1000000).toFixed(1) + 'M</td>';
        });
        h += '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
}

// --- Section 3: Deterministic Insights ---
function renderDeterministicInsights() {
    var filtered = getFilteredHistory();
    if (filtered.length < 2) return '';
    var h = '<h3 class="section-heading">Insights</h3><ul class="perf-insights-list">';

    var first = filtered[0];
    var last = filtered[filtered.length - 1];

    // Rank by cumulative profit
    function getRank(snap) {
        var sorted = PERF_COMPANIES.slice().sort(function(a, b) {
            var va = snap.financials[a] ? snap.financials[a].cumulativeProfit || 0 : 0;
            var vb = snap.financials[b] ? snap.financials[b].cumulativeProfit || 0 : 0;
            return vb - va;
        });
        return sorted.indexOf('Andrews') + 1;
    }
    var rankFirst = getRank(first);
    var rankLast = getRank(last);
    h += '<li>Andrews moved from rank ' + rankFirst + ' to rank ' + rankLast + ' in cumulative profit between R' + first.round + ' and R' + last.round + '</li>';

    // Largest revenue gainer
    var maxGain = 0, gainer = '';
    PERF_COMPANIES.forEach(function(co) {
        var s1 = first.financials[co] ? first.financials[co].sales || 0 : 0;
        var s2 = last.financials[co] ? last.financials[co].sales || 0 : 0;
        if (s2 - s1 > maxGain) { maxGain = s2 - s1; gainer = co; }
    });
    if (gainer) h += '<li>Largest revenue gainer: ' + gainer + ' (+$' + (maxGain / 1000000).toFixed(1) + 'M)</li>';

    // Emergency loans
    var loanRounds = [];
    filtered.forEach(function(snap) {
        var loan = snap.financials.Andrews ? snap.financials.Andrews.emergencyLoan || 0 : 0;
        if (loan > 0) loanRounds.push('R' + snap.round);
    });
    if (loanRounds.length > 0) h += '<li>\u26a0 Andrews took emergency loans in: ' + loanRounds.join(', ') + '</li>';

    // Strongest segment
    var lastSnap = last;
    var myProds = lastSnap.products.filter(function(p) { return p.company === 'Andrews' && p.released; });
    var segShares = {};
    myProds.forEach(function(p) {
        if (!p.segmentKey) return;
        var sd = p.segmentData && p.segmentData[p.segmentKey];
        if (sd && sd.marketShare) {
            if (!segShares[p.segmentKey] || sd.marketShare > segShares[p.segmentKey]) {
                segShares[p.segmentKey] = sd.marketShare;
            }
        }
    });
    var bestSeg = '', bestShare = 0;
    Object.keys(segShares).forEach(function(k) { if (segShares[k] > bestShare) { bestShare = segShares[k]; bestSeg = k; } });
    if (bestSeg) h += '<li>Strongest segment for Andrews (R' + last.round + '): ' + getSegmentDisplayName(bestSeg) + ' (' + bestShare + '% share)</li>';

    h += '</ul>';
    return h;
}

// --- Section 4: Round-by-Round Cards ---
function renderRoundCards() {
    var filtered = getFilteredHistory();
    var h = '<h3 class="section-heading">Round-by-Round Summary</h3>';

    filtered.forEach(function(snap) {
        var fin = snap.financials.Andrews || {};
        // Compute rank by cumulative profit
        var sorted = PERF_COMPANIES.slice().sort(function(a, b) {
            var va = snap.financials[a] ? snap.financials[a].cumulativeProfit || 0 : 0;
            var vb = snap.financials[b] ? snap.financials[b].cumulativeProfit || 0 : 0;
            return vb - va;
        });
        var rank = sorted.indexOf('Andrews') + 1;

        h += '<div class="perf-round-card">';
        h += '<div class="perf-round-card-header">Round ' + snap.round + ' \u2014 ' + (snap.endDate || '?') + '</div>';
        h += '<div class="perf-round-card-body">';
        h += 'Sales: $' + ((fin.sales || 0) / 1000000).toFixed(1) + 'M | ';
        h += 'Net Profit: $' + ((fin.profit || 0) / 1000000).toFixed(1) + 'M | ';
        h += 'Rank: ' + rank + ' of 6';
        h += '<br>Cumulative Profit: $' + ((fin.cumulativeProfit || 0) / 1000000).toFixed(1) + 'M';
        if (fin.emergencyLoan && fin.emergencyLoan > 0) {
            h += '<br><span class="perf-warning">\u26a0 Took emergency loan: $' + (fin.emergencyLoan / 1000000).toFixed(1) + 'M</span>';
        }
        h += '</div></div>';
    });

    return h;
}
