// ============================================
// Capsim Strategist — Main Application Script
// ============================================

'use strict';

// Global application state
var appState = {
    round: null,
    upcomingRound: null,
    endDate: null,
    myCompany: 'Andrews',
    segments: {},
    products: [],
    financials: {},        // Financials from the latest parse (per company)
    history: [],           // Array of round snapshots for Performance Review [{round, endDate, products, segments, financials}]
    compareRounds: [],     // Which round numbers are currently checked in Performance Review filter
    plannedRevisions: {},  // { "Able": [{pfmn, size, mtbf, price, revisionDate}, ...], ... }
    newProducts: [],
    geminiKey: '',
    lastAiResponse: ''
};

// ============================================
// Tab Navigation
// ============================================

(function initTabs() {
    var tabButtons = document.querySelectorAll('.tab-btn');
    var tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(targetTab) {
        tabButtons.forEach(function(btn) { btn.classList.remove('active'); });
        tabPanels.forEach(function(panel) { panel.classList.remove('active'); });
        var activeBtn = document.querySelector('.tab-btn[data-tab="' + targetTab + '"]');
        if (activeBtn) activeBtn.classList.add('active');
        var activePanel = document.getElementById('tab-' + targetTab);
        if (activePanel) activePanel.classList.add('active');
    }

    tabButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tab = btn.getAttribute('data-tab');
            switchTab(tab);
            // Render Performance Review tab on-demand when clicked
            if (tab === 'performance' && typeof renderPerformanceTab === 'function') {
                renderPerformanceTab();
            }
        });
    });
})();

// ============================================
// Round History — Save/Remove for Performance Review
// ============================================

function saveToHistory(text) {
    // Parses a Courier into a temporary appState, extracts a snapshot, saves to history.
    // We swap appState temporarily so parseCourier writes to a fresh object.
    var origState = appState;
    var tempState = { round: null, upcomingRound: null, endDate: null, myCompany: 'Andrews', segments: {}, products: [], financials: {}, plannedRevisions: {}, newProducts: [], history: [], geminiKey: '', lastAiResponse: '' };
    appState = tempState;
    var warnings = [];
    try {
        parseCourier(text, warnings);
        var snapshot = {
            round: tempState.round,
            endDate: tempState.endDate,
            products: JSON.parse(JSON.stringify(tempState.products)),
            segments: JSON.parse(JSON.stringify(tempState.segments)),
            financials: JSON.parse(JSON.stringify(tempState.financials))
        };
        appState = origState; // restore original state
        if (snapshot.round === null) return { success: false, error: 'Could not determine round number.' };
        // Replace existing entry for same round, or add new
        var existingIdx = appState.history.findIndex(function(h) { return h.round === snapshot.round; });
        if (existingIdx !== -1) appState.history[existingIdx] = snapshot;
        else appState.history.push(snapshot);
        // Keep sorted by round number ascending
        appState.history.sort(function(a, b) { return a.round - b.round; });
        // Auto-add new round to compareRounds so it's checked by default
        if (appState.compareRounds.indexOf(snapshot.round) === -1) {
            appState.compareRounds.push(snapshot.round);
            appState.compareRounds.sort(function(a, b) { return a - b; });
        }
        return { success: true, round: snapshot.round, warnings: warnings };
    } catch (e) {
        appState = origState;
        return { success: false, error: e.message };
    }
}

function removeFromHistory(round) {
    appState.history = appState.history.filter(function(h) { return h.round !== round; });
    // Also remove from compareRounds so the filter stays in sync
    appState.compareRounds = appState.compareRounds.filter(function(r) { return r !== round; });
}

// ============================================
// Setup Tab — History Section UI
// ============================================

(function initHistorySection() {
    var saveBtn = document.getElementById('history-save-btn');
    var textarea = document.getElementById('history-input');
    var statusDiv = document.getElementById('history-status');
    var listDiv = document.getElementById('history-list');

    if (!saveBtn) return; // guard if element doesn't exist yet

    saveBtn.addEventListener('click', function() {
        var text = textarea.value.trim();
        if (!text) { showSummary(statusDiv, 'error', 'Paste a Courier first.'); return; }
        if (text.indexOf('CAPSTONE') === -1 || text.indexOf('Round:') === -1) {
            showSummary(statusDiv, 'error', 'This doesn\u2019t look like a Capsim Courier.');
            return;
        }
        var result = saveToHistory(text);
        if (result.success) {
            showSummary(statusDiv, 'success', 'Round ' + result.round + ' saved to history.');
            textarea.value = '';
            renderHistoryList();
            // Re-render Performance Review tab if it has enough data
            if (typeof renderPerformanceTab === 'function') renderPerformanceTab();
        } else {
            showSummary(statusDiv, 'error', 'Failed: ' + result.error);
        }
    });

    renderHistoryList();

    function renderHistoryList() {
        if (!listDiv) return;
        if (appState.history.length === 0) {
            listDiv.innerHTML = '<p class="empty-state" style="padding:0.5rem 0;font-size:0.85rem">No rounds saved yet.</p>';
            return;
        }
        var h = '';
        appState.history.forEach(function(snap) {
            h += '<div class="history-item">';
            h += '<span>R' + snap.round + ' \u2014 ' + (snap.endDate || '?') + '</span>';
            h += '<button class="btn-danger history-remove-btn" data-round="' + snap.round + '">Remove</button>';
            h += '</div>';
        });
        listDiv.innerHTML = h;
        listDiv.querySelectorAll('.history-remove-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                removeFromHistory(parseInt(btn.getAttribute('data-round')));
                renderHistoryList();
            });
        });
    }
})();

// ============================================
// Setup Tab — Parse Button
// ============================================

(function initSetup() {
    var parseBtn = document.getElementById('parse-btn');
    var textarea = document.getElementById('courier-input');
    var summaryDiv = document.getElementById('parse-summary');

    parseBtn.addEventListener('click', function() {
        var text = textarea.value.trim();
        if (!text) {
            showSummary(summaryDiv, 'error', 'No text pasted. Please paste your Capsim Courier content first.');
            return;
        }

        // Confirm if planned changes exist
        var hasPlannedData = Object.keys(appState.plannedRevisions).some(function(k) { return appState.plannedRevisions[k].length > 0; }) || appState.newProducts.length > 0;
        if (hasPlannedData) {
            if (!confirm('Re-parsing will reset your planned changes. Continue?')) return;
        }

        // Pre-check: does this look like a Capsim Courier?
        // We look for two markers that appear in every real Courier.
        if (text.indexOf('CAPSTONE') === -1 || text.indexOf('Round:') === -1) {
            showSummary(summaryDiv, 'error',
                'This doesn\u2019t look like a Capsim Courier. Please paste the full text from your Courier page.<br><br>' +
                '<em>Tip: open the HTML Courier in your Capsim browser tab, press Ctrl+A then Ctrl+C, then paste here.</em>');
            return;
        }

        var warnings = [];
        try {
            appState.plannedRevisions = {};
            appState.newProducts = [];
            appState.lastAiResponse = '';  // clear stale AI analysis from previous Courier
            parseCourier(text, warnings);
            displaySuccessSummary(summaryDiv, warnings);
            renderProductsTab();
            renderCompetitorsTab();
            renderSimulatorTab();
            renderInsightsTab();
            // Verification log
            console.log('Parse complete. Total products:', appState.products.length);
            var companyCounts = {};
            appState.products.forEach(function(p) {
                companyCounts[p.company] = (companyCounts[p.company] || 0) + 1;
            });
            console.log('Products per company:', companyCounts);
            console.log('appState:', JSON.parse(JSON.stringify(appState)));
        } catch (e) {
            showSummary(summaryDiv, 'error', 'Parsing failed: ' + e.message);
            console.error(e);
        }
    });
})();