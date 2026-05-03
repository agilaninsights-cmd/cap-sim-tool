// ============================================
// Capsim Strategist — Layer 1 Tab Navigation
// ============================================

(function () {
    'use strict';

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(targetTab) {
        // Deactivate all buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));

        // Hide all panels
        tabPanels.forEach(panel => panel.classList.remove('active'));

        // Activate the clicked button
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Show the corresponding panel
        const activePanel = document.getElementById(`tab-${targetTab}`);
        if (activePanel) activePanel.classList.add('active');
    }

    // Attach click listeners
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
        });
    });
})();