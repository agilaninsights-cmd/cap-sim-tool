// ============================================
// Capsim Strategist — Insights Tab
// ============================================
'use strict';

function renderInsightsTab() {
    var empty = document.getElementById('insights-empty');
    var content = document.getElementById('insights-content');
    if (!appState.products || !appState.products.length) {
        empty.classList.remove('hidden'); content.classList.add('hidden'); return;
    }
    empty.classList.add('hidden'); content.classList.remove('hidden');

    var snap0 = computeStateAtMonth(0);
    var snap12 = computeStateAtMonth(12);

    renderHealthCards(snap0, snap12);
    renderIdealTable(snap12);
    initAiCoach();
}

// ============================================
// Part A1 — Per-Product Strategic Cards
// ============================================

function renderHealthCards(snap0, snap12) {
    var container = document.getElementById('insights-cards');
    var myProducts0 = snap0.products.filter(function(p) { return p.company === appState.myCompany && p.released; });
    var html = '';

    myProducts0.forEach(function(p0) {
        var p12 = snap12.products.find(function(x) { return x.name === p0.name; });
        if (!p12 || !p0.css || !p12.css) return;

        var css0 = p0.css.total;
        var css12 = p12.css.total;
        var drop = css0 > 0 ? ((css0 - css12) / css0) * 100 : 0;

        // Status flag
        var status, statusClass;
        if (css12 < 40 || drop > 30) { status = '\ud83d\udd34 Critical'; statusClass = 'status-critical'; }
        else if (drop > 15) { status = '\ud83d\udfe1 Watch'; statusClass = 'status-watch'; }
        else { status = '\ud83d\udfe2 Healthy'; statusClass = 'status-healthy'; }

        // Find biggest drag
        var recommendation = getRecommendation(p12);

        // Check if any planned revision within the first year helps
        var revisionNote = '';
        var revs = appState.plannedRevisions[p0.name] || [];
        if (revs.length > 0) {
            var firstRev = revs[0];
            var revGm = dateToGlobalMonth(firstRev.revisionDate, appState.round);
            if (revGm !== null && revGm >= 1 && revGm <= 12) {
                var snapRev = computeStateAtMonth(revGm);
                var pRev = snapRev.products.find(function(x) { return x.name === p0.name; });
                if (pRev && pRev.css) {
                    revisionNote = 'After planned reposition on ' + firstRev.revisionDate + ', CSS recovers to ' + pRev.css.total.toFixed(1) + '.';
                }
            }
        }

        html += '<div class="insight-card ' + statusClass + '">';
        html += '<div class="insight-card-header">';
        html += '<span class="insight-card-title">' + p0.name + ' \u2014 ' + (p0.segment || '?') + '</span>';
        html += '<span class="insight-status">' + status + '</span>';
        html += '</div>';
        html += '<div class="insight-css-row">CSS: ' + css0.toFixed(1) + ' (Jan) \u2192 ' + css12.toFixed(1) + ' (Dec)';
        if (drop > 0) html += ' <span class="insight-drop">\u25bc ' + drop.toFixed(1) + '%</span>';
        html += '</div>';
        html += '<div class="insight-recommendation">\ud83d\udca1 ' + recommendation + '</div>';
        if (revisionNote) html += '<div class="insight-revision-note">' + revisionNote + '</div>';
        html += '</div>';
    });

    container.innerHTML = html || '<p class="empty-state">No released Andrews products found.</p>';
}

function getRecommendation(p) {
    if (!p.css) return 'Insufficient data.';
    if (p.css.ageRaw < 0.5) return 'Reposition this round to halve age and recover Age score. Current age (' + p.age.toFixed(1) + ') is far from ideal.';
    if (p.css.positionRaw < 0.7) return 'Drift is pushing this product toward the rough cut \u2014 reposition or risk score collapse.';
    if (p.css.priceRaw < 0.3) return 'Price is near the top of segment range \u2014 consider lowering.';
    if (p.css.mtbfRaw < 0.5) return 'MTBF is below segment expectations \u2014 increase reliability rating.';
    return 'Product is well-positioned. Monitor drift and age as the year progresses.';
}

// ============================================
// Part A2 — Ideal Position Analysis
// ============================================

function renderIdealTable(snap12) {
    var container = document.getElementById('insights-ideal-table');
    var segKeys = ['traditional', 'lowEnd', 'highEnd', 'performance', 'size'];
    var myProds12 = snap12.products.filter(function(p) { return p.company === appState.myCompany && p.released; });

    var html = '<table class="data-table"><thead><tr><th>Segment</th><th>Ideal (Dec)</th><th>Closest Product</th><th>Distance</th><th>Opportunity</th></tr></thead><tbody>';

    segKeys.forEach(function(key) {
        var seg = snap12.segments[key];
        if (!seg) return;
        var ideal = seg.idealSpot;

        // Find closest Andrews product in this segment
        var closest = null; var minDist = 999;
        myProds12.forEach(function(p) {
            if (p.segmentKey !== key) return;
            var d = Math.sqrt(Math.pow(p.pfmn - ideal.pfmn, 2) + Math.pow(p.size - ideal.size, 2));
            if (d < minDist) { minDist = d; closest = p; }
        });

        var segName = getSegmentDisplayName(key);
        var idealStr = '(' + ideal.pfmn.toFixed(1) + ', ' + ideal.size.toFixed(1) + ')';
        var prodStr = closest ? closest.name + ' (' + closest.pfmn.toFixed(1) + ', ' + closest.size.toFixed(1) + ')' : '\u2014';
        var distStr = closest ? minDist.toFixed(2) : '\u2014';
        var opp = closest ? segName + ': reposition ' + closest.name + ' to ' + idealStr + ' (distance ' + minDist.toFixed(1) + ')' : segName + ': no Andrews product in this segment.';

        html += '<tr><td>' + segName + '</td><td>' + idealStr + '</td><td>' + prodStr + '</td><td>' + distStr + '</td><td style="font-size:0.75rem">' + opp + '</td></tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ============================================
// Part B — AI Strategy Coach
// ============================================

function initAiCoach() {
    var btn = document.getElementById('ai-generate-btn');
    var keyInput = document.getElementById('gemini-key');
    var responseDiv = document.getElementById('ai-response');

    // Restore key if already entered
    if (appState.geminiKey) keyInput.value = appState.geminiKey;

    // Show last response if available
    if (appState.lastAiResponse) {
        responseDiv.classList.remove('hidden');
        responseDiv.innerHTML = formatAiResponse(appState.lastAiResponse);
    }

    var nb = btn.cloneNode(true); btn.parentNode.replaceChild(nb, btn);
    nb.addEventListener('click', function() {
        var key = keyInput.value.trim();
        if (!key) { showAiError(responseDiv, 'Please enter a valid API key.'); return; }
        appState.geminiKey = key;
        callGemini(key, responseDiv, nb);
    });
}

function callGemini(key, responseDiv, btn) {
    responseDiv.classList.remove('hidden');
    responseDiv.innerHTML = '<div class="ai-loading">Generating analysis\u2026</div>';
    btn.disabled = true;

    var prompt = buildGeminiPrompt();
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
    var body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1800 }
    });

    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: body })
        .then(function(res) {
            if (res.status === 401 || res.status === 403) throw new Error('Invalid API key. Please check and try again.');
            if (res.status === 429) throw new Error('Rate limit exceeded. Please wait a minute and try again.');
            if (!res.ok) throw new Error('Error: ' + res.status);
            return res.json();
        })
        .then(function(data) {
            var text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
            if (!text) throw new Error('No response from Gemini.');
            appState.lastAiResponse = text;
            responseDiv.innerHTML = formatAiResponse(text);
            btn.disabled = false;
        })
        .catch(function(err) {
            showAiError(responseDiv, err.message || 'Network error \u2014 check your connection.');
            btn.disabled = false;
        });
}

function buildGeminiPrompt() {
    var snap0 = computeStateAtMonth(0);
    var snap12 = computeStateAtMonth(12);
    var p = 'You are a Capsim strategy coach for team Andrews in Round ' + appState.upcomingRound + '. Be direct and specific.\n\n';

    p += 'SEGMENTS:\n';
    var segKeys = ['traditional', 'lowEnd', 'highEnd', 'performance', 'size'];
    segKeys.forEach(function(k) {
        var s = appState.segments[k];
        if (!s) return;
        var s12 = snap12.segments[k];
        p += '- ' + s.name + ': demand ' + s.totalDemand + ', growth ' + s.growthRate + '%, ideal moves from (' + snap0.segments[k].idealSpot.pfmn.toFixed(1) + ',' + snap0.segments[k].idealSpot.size.toFixed(1) + ') to (' + s12.idealSpot.pfmn.toFixed(1) + ',' + s12.idealSpot.size.toFixed(1) + ')\n';
    });

    p += '\nANDREWS PRODUCTS:\n';
    snap0.products.filter(function(x) { return x.company === appState.myCompany && x.released; }).forEach(function(pr) {
        var pr12 = snap12.products.find(function(x) { return x.name === pr.name; });
        p += '- ' + pr.name + ' (' + (pr.segment || '?') + '): Pfmn ' + pr.pfmn.toFixed(1) + ', Size ' + pr.size.toFixed(1) + ', MTBF ' + pr.mtbf + ', Price $' + pr.price.toFixed(2) + ', Age ' + pr.age.toFixed(1) + ', CSS Jan:' + (pr.css ? pr.css.total.toFixed(0) : '?') + ' Dec:' + (pr12 && pr12.css ? pr12.css.total.toFixed(0) : '?') + '\n';
    });

    // Planned revisions (multi-year)
    var revKeys = Object.keys(appState.plannedRevisions).filter(function(n) { return appState.plannedRevisions[n].length > 0; });
    if (revKeys.length > 0) {
        p += '\nPLANNED REVISIONS:\n';
        revKeys.forEach(function(n) {
            appState.plannedRevisions[n].forEach(function(rev) {
                p += '- ' + n + ': reposition to Pfmn ' + rev.pfmn + ', Size ' + rev.size + ', MTBF ' + rev.mtbf + ', Price $' + rev.price + ', Rev Date ' + rev.revisionDate + '\n';
            });
        });
    }

    if (appState.newProducts.length > 0) {
        p += '\nNEW PRODUCTS:\n';
        appState.newProducts.forEach(function(np) { p += '- ' + np.name + ' (' + getSegmentDisplayName(np.segment) + '): Pfmn ' + np.pfmn + ', Size ' + np.size + ', Release ' + np.releaseDate + '\n'; });
    }

    // Competitors
    p += '\nCOMPETITORS:\n';
    var companies = ['Baldwin', 'Chester', 'Digby', 'Erie', 'Ferris'];
    companies.forEach(function(co) {
        var prods = appState.products.filter(function(x) { return x.company === co && x.released; });
        if (!prods.length) return;
        p += co + ': ';
        prods.forEach(function(cp) { p += cp.name + '(' + (cp.segmentKey || '?').substring(0, 4) + ' P' + cp.pfmn + ' S' + cp.size + ' $' + cp.price + ' Age' + cp.ageDec31 + (cp.revisionDate ? ' Rev:' + cp.revisionDate : '') + ') '; });
        p += '\n';
    });

    p += '\nTASK: Produce a 200-300 word strategic analysis covering:\n1. The biggest threat Andrews faces this round\n2. The biggest opportunity\n3. The single most important R&D decision to make this round\n4. Any traps to avoid\n\nBe direct, specific to our numbers, and actionable.';
    return p;
}

function formatAiResponse(text) {
    // Basic markdown: bold, line breaks
    var html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return '<div class="ai-response-text">' + html + '</div>';
}

function showAiError(div, msg) {
    div.classList.remove('hidden');
    div.innerHTML = '<div class="ai-error">' + msg + '</div>';
}
