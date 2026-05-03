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
    products: []
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
            switchTab(btn.getAttribute('data-tab'));
        });
    });
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

        var warnings = [];
        try {
            parseCourier(text, warnings);
            displaySuccessSummary(summaryDiv, warnings);
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