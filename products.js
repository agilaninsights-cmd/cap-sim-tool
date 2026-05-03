// ============================================
// Capsim Strategist — Your Products Tab
// Multi-revision timeline UI.
// Reads from appState.plannedRevisions (array per product).
// ============================================
'use strict';

var MAX_PRODUCTS = 8;

// --- Main entry ---
function renderProductsTab() {
    var empty = document.getElementById('products-empty');
    var content = document.getElementById('products-content');
    if (!appState.products || !appState.products.length) {
        empty.classList.remove('hidden'); content.classList.add('hidden'); return;
    }
    empty.classList.add('hidden'); content.classList.remove('hidden');
    initPlannedRevisions();
    renderProductCards();
    renderNewProductsList();
    updateProductCounter();
    initAddProductButton();
}

// --- Ensure every Andrews product has an entry in plannedRevisions ---
function initPlannedRevisions() {
    appState.products.filter(function(p) { return p.company === appState.myCompany; }).forEach(function(p) {
        if (!appState.plannedRevisions[p.name]) {
            appState.plannedRevisions[p.name] = [];
        }
    });
}

// --- Render all product cards ---
function renderProductCards() {
    var container = document.getElementById('products-list');
    var myProducts = appState.products.filter(function(p) { return p.company === appState.myCompany; });
    var html = '';
    myProducts.forEach(function(p) { html += buildProductCard(p); });
    container.innerHTML = html;
    attachProductListeners();
}

// --- Build one product card ---
function buildProductCard(p) {
    var h = '';
    var revisions = appState.plannedRevisions[p.name] || [];
    var inFlightDate = getInFlightRevisionDate(p);

    h += '<div class="product-card" data-product="' + p.name + '">';

    // Header
    h += '<div class="product-card-header">';
    h += '<span class="product-card-title">' + p.name + '</span>';
    h += '<span class="product-card-segment">' + (p.segment || 'Unreleased') + '</span>';
    h += '</div>';

    // Current specs (read-only)
    h += '<div class="current-specs">';
    h += '<div class="spec-item"><span class="spec-label">Pfmn</span><span class="spec-value">' + p.pfmn + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">Size</span><span class="spec-value">' + p.size + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">MTBF</span><span class="spec-value">' + p.mtbf + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">Price</span><span class="spec-value">$' + p.price.toFixed(2) + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">Age</span><span class="spec-value">' + p.ageDec31 + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">Rev Date</span><span class="spec-value">' + (p.revisionDate || '\u2014') + '</span></div>';
    h += '</div>';

    // In-flight warning
    if (inFlightDate) {
        h += '<p class="revision-note">R&D in progress \u2014 completes ' + inFlightDate + '</p>';
    }

    // Revision timeline
    h += '<div class="revision-timeline">';
    if (revisions.length === 0) {
        h += '<p class="empty-state" style="padding:0.3rem 0;font-size:0.8rem">No revisions planned.</p>';
    } else {
        revisions.forEach(function(rev, idx) {
            h += '<div class="revision-mini-card" data-product="' + p.name + '" data-idx="' + idx + '">';
            h += '<div class="rev-info">';
            h += '<span class="rev-date">' + rev.revisionDate + '</span>';
            h += ' \u2014 Pfmn ' + rev.pfmn + ' | Size ' + rev.size + ' | MTBF ' + rev.mtbf + ' | $' + rev.price.toFixed(2);
            h += '</div>';
            h += '<div class="rev-actions">';
            h += '<button class="btn-reset rev-edit-btn" data-product="' + p.name + '" data-idx="' + idx + '">Edit</button>';
            h += '<button class="btn-danger rev-remove-btn" data-product="' + p.name + '" data-idx="' + idx + '">Remove</button>';
            h += '</div>';
            h += '</div>';
        });
    }
    h += '</div>';

    // Add Revision button
    var canAdd = canAddRevision(p.name, inFlightDate);
    h += '<button class="btn-secondary add-rev-btn" data-product="' + p.name + '"' + (canAdd.allowed ? '' : ' disabled title="' + canAdd.reason + '"') + '>+ Add Revision</button>';

    // Form placeholder (populated dynamically)
    h += '<div class="rev-form-container" data-product="' + p.name + '"></div>';

    h += '</div>';
    return h;
}

// --- Check if adding another revision is allowed ---
function canAddRevision(productName, inFlightDate) {
    var revisions = appState.plannedRevisions[productName] || [];
    // Find the constraint year (latest year among in-flight + existing revisions)
    var constraintYear = null;
    if (inFlightDate) {
        var ify = getYearFromDate(inFlightDate);
        if (ify && ify >= getBaseYear()) constraintYear = ify;
    }
    if (revisions.length > 0) {
        var lastRevYear = getYearFromDate(revisions[revisions.length - 1].revisionDate);
        if (lastRevYear && (!constraintYear || lastRevYear > constraintYear)) constraintYear = lastRevYear;
    }
    // Check if there's room: constraint year must be < final sim year (baseYear + remaining rounds - 1)
    var finalYear = getBaseYear() + (8 - appState.round) - 1;
    if (constraintYear && constraintYear >= finalYear) {
        return { allowed: false, reason: 'No remaining years in the simulation for another revision.' };
    }
    return { allowed: true, reason: '' };
}

// --- Validate a proposed revision date (calendar-year rule) ---
function validateRevisionDate(productName, proposedDate, editIndex) {
    var proposedYear = getYearFromDate(proposedDate);
    if (!proposedYear) return { valid: false, message: 'Please enter a valid date.' };
    if (proposedYear < getBaseYear()) return { valid: false, message: 'Revision date must be in the future (simulation starts ' + getBaseYear() + ').' };

    // Find constraint year: max of in-flight year and previous revisions' years
    var constraintYear = null;
    var product = findProduct(productName);
    if (product && product.revisionDate) {
        var ify = getYearFromDate(product.revisionDate);
        if (ify && ify >= getBaseYear()) constraintYear = ify;
    }
    var revisions = appState.plannedRevisions[productName] || [];
    // Look at revisions before editIndex (or all if adding new)
    var checkUpTo = (editIndex !== undefined && editIndex !== null) ? editIndex : revisions.length;
    for (var i = 0; i < checkUpTo; i++) {
        var ry = getYearFromDate(revisions[i].revisionDate);
        if (ry && (!constraintYear || ry > constraintYear)) constraintYear = ry;
    }

    if (constraintYear && proposedYear <= constraintYear) {
        return {
            valid: false,
            message: 'In Capsim, R&D projects start on January 1 each year, and a product can have only one project running at a time. Your previous revision completes in ' + constraintYear + ' \u2014 your next revision must complete in ' + (constraintYear + 1) + ' or later.'
        };
    }
    return { valid: true, message: '' };
}

// --- Get in-flight revision date from parsed Courier ---
function getInFlightRevisionDate(p) {
    if (!p.revisionDate) return null;
    var baseYear = getBaseYear();
    var ry = getYearFromDate(p.revisionDate);
    if (ry && ry >= baseYear) return p.revisionDate;
    return null;
}

// --- Attach event listeners ---
function attachProductListeners() {
    // Add Revision buttons
    document.querySelectorAll('.add-rev-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var name = btn.getAttribute('data-product');
            showRevisionForm(name, null);
        });
    });
    // Edit buttons
    document.querySelectorAll('.rev-edit-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var name = btn.getAttribute('data-product');
            var idx = parseInt(btn.getAttribute('data-idx'));
            showRevisionForm(name, idx);
        });
    });
    // Remove buttons
    document.querySelectorAll('.rev-remove-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var name = btn.getAttribute('data-product');
            var idx = parseInt(btn.getAttribute('data-idx'));
            removeRevision(name, idx);
        });
    });
}

// --- Show Add/Edit revision form ---
function showRevisionForm(productName, editIndex) {
    var container = document.querySelector('.rev-form-container[data-product="' + productName + '"]');
    var revisions = appState.plannedRevisions[productName] || [];
    var isEdit = (editIndex !== null && editIndex !== undefined);
    var existing = isEdit ? revisions[editIndex] : null;

    // Pre-fill: use last revision's specs, or product's current specs
    var prefill = existing || (revisions.length > 0 ? revisions[revisions.length - 1] : findProduct(productName)) || {};

    var h = '<div class="new-product-form" style="margin-top:0.75rem">';
    h += '<div class="form-grid">';
    h += '<div><label>Pfmn</label><input type="number" step="0.1" class="rf-pfmn" value="' + (prefill.pfmn || 0) + '"></div>';
    h += '<div><label>Size</label><input type="number" step="0.1" class="rf-size" value="' + (prefill.size || 0) + '"></div>';
    h += '<div><label>MTBF</label><input type="number" step="500" class="rf-mtbf" value="' + (prefill.mtbf || 0) + '"></div>';
    h += '<div><label>Price</label><input type="number" step="0.50" class="rf-price" value="' + (prefill.price || 0) + '"></div>';
    h += '<div><label>Revision Date</label><input type="date" class="rf-date" value="' + (existing ? existing.revisionDate : '') + '"></div>';
    h += '</div>';
    h += '<div class="rf-error" style="color:#dc2626;font-size:0.8rem;margin-top:0.5rem"></div>';
    h += '<div class="form-actions">';
    h += '<button class="btn-primary rf-save">' + (isEdit ? 'Save' : 'Add Revision') + '</button>';
    h += '<button class="btn-secondary rf-cancel">Cancel</button>';
    h += '</div></div>';

    container.innerHTML = h;

    // Cancel
    container.querySelector('.rf-cancel').addEventListener('click', function() { container.innerHTML = ''; });

    // Save
    container.querySelector('.rf-save').addEventListener('click', function() {
        var dateVal = container.querySelector('.rf-date').value;
        var validation = validateRevisionDate(productName, dateVal, isEdit ? editIndex : null);
        if (!validation.valid) {
            container.querySelector('.rf-error').textContent = validation.message;
            return;
        }
        var rev = {
            pfmn: parseFloat(container.querySelector('.rf-pfmn').value) || 0,
            size: parseFloat(container.querySelector('.rf-size').value) || 0,
            mtbf: parseInt(container.querySelector('.rf-mtbf').value) || 0,
            price: parseFloat(container.querySelector('.rf-price').value) || 0,
            revisionDate: dateVal
        };
        if (isEdit) {
            appState.plannedRevisions[productName][editIndex] = rev;
        } else {
            appState.plannedRevisions[productName].push(rev);
        }
        // Keep array sorted by date
        appState.plannedRevisions[productName].sort(function(a, b) {
            return a.revisionDate.localeCompare(b.revisionDate);
        });
        container.innerHTML = '';
        renderProductCards();
    });
}

// --- Remove a revision (with soft warning if later revisions exist) ---
function removeRevision(productName, idx) {
    var revisions = appState.plannedRevisions[productName];
    if (!revisions || idx >= revisions.length) return;

    // If there are later revisions, warn the user about the consequence
    if (idx < revisions.length - 1) {
        var nextRev = revisions[idx + 1];
        var msg = 'Removing this revision will leave the next revision (' + nextRev.revisionDate + ') without a predecessor. ';
        msg += 'It will now apply directly from the product\u2019s current specs, which may represent a much larger move than originally planned.\n\nContinue?';
        if (!confirm(msg)) return;
    }

    // Remove only the selected revision (leave later ones intact)
    appState.plannedRevisions[productName].splice(idx, 1);
    renderProductCards();
}

// ============================================
// New Products section (unchanged from before)
// ============================================

function renderNewProductsList() {
    var container = document.getElementById('new-products-list');
    if (appState.newProducts.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding:0.5rem 0">No new products added yet.</p>';
        return;
    }
    var h = '';
    appState.newProducts.forEach(function(np, idx) {
        h += '<div class="new-product-card">';
        h += '<div class="npc-info"><span class="npc-name">' + np.name + '</span>';
        h += ' \u2014 ' + getSegmentDisplayName(np.segment);
        h += ' | Pfmn ' + np.pfmn + ' | Size ' + np.size;
        h += ' | MTBF ' + np.mtbf + ' | $' + np.price.toFixed(2);
        h += ' | Release ' + np.releaseDate + '</div>';
        h += '<button class="btn-danger np-remove-btn" data-idx="' + idx + '">Remove</button>';
        h += '</div>';
    });
    container.innerHTML = h;
    container.querySelectorAll('.np-remove-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            appState.newProducts.splice(parseInt(btn.getAttribute('data-idx')), 1);
            renderNewProductsList();
            updateProductCounter();
        });
    });
}

function updateProductCounter() {
    var el = document.getElementById('product-counter');
    var existing = appState.products.filter(function(p) { return p.company === appState.myCompany; }).length;
    var newCount = appState.newProducts.length;
    el.textContent = existing + ' existing + ' + newCount + ' new = ' + (existing + newCount) + ' of ' + MAX_PRODUCTS + ' max';
    var addBtn = document.getElementById('add-product-btn');
    if (addBtn) addBtn.disabled = (existing + newCount >= MAX_PRODUCTS);
}

function initAddProductButton() {
    var addBtn = document.getElementById('add-product-btn');
    var formDiv = document.getElementById('new-product-form');
    var nb = addBtn.cloneNode(true); addBtn.parentNode.replaceChild(nb, addBtn);
    nb.addEventListener('click', function() { showNewProductForm(formDiv); });
}

function showNewProductForm(formDiv) {
    formDiv.classList.remove('hidden');
    var h = '<div class="form-grid">';
    h += '<div><label>Name (starts with A)</label><input type="text" id="np-name" placeholder="A..." maxlength="10"></div>';
    h += '<div><label>Segment</label><select id="np-segment"><option value="traditional">Traditional</option><option value="lowEnd">Low End</option><option value="highEnd">High End</option><option value="performance">Performance</option><option value="size">Size</option></select></div>';
    h += '<div><label>Pfmn</label><input type="number" id="np-pfmn" step="0.1" value="5.0"></div>';
    h += '<div><label>Size</label><input type="number" id="np-size" step="0.1" value="15.0"></div>';
    h += '<div><label>MTBF</label><input type="number" id="np-mtbf" step="500" value="17000"></div>';
    h += '<div><label>Price</label><input type="number" id="np-price" step="0.50" value="25.00"></div>';
    h += '<div><label>Release Date</label><input type="date" id="np-release"></div>';
    h += '</div><div class="form-actions">';
    h += '<button class="btn-primary" id="np-submit">Add Product</button>';
    h += '<button class="btn-secondary" id="np-cancel">Cancel</button></div>';
    formDiv.innerHTML = h;
    document.getElementById('np-cancel').addEventListener('click', function() { formDiv.classList.add('hidden'); formDiv.innerHTML = ''; });
    document.getElementById('np-submit').addEventListener('click', function() {
        var name = document.getElementById('np-name').value.trim();
        if (!name || name.charAt(0).toUpperCase() !== 'A') { alert('Name must start with A.'); return; }
        if (!document.getElementById('np-release').value) { alert('Set a release date.'); return; }
        var existing = appState.products.filter(function(p) { return p.company === appState.myCompany; }).length;
        if (existing + appState.newProducts.length >= MAX_PRODUCTS) { alert('Max ' + MAX_PRODUCTS + ' products.'); return; }
        appState.newProducts.push({
            name: name, segment: document.getElementById('np-segment').value,
            pfmn: parseFloat(document.getElementById('np-pfmn').value) || 0,
            size: parseFloat(document.getElementById('np-size').value) || 0,
            mtbf: parseInt(document.getElementById('np-mtbf').value) || 0,
            price: parseFloat(document.getElementById('np-price').value) || 0,
            releaseDate: document.getElementById('np-release').value
        });
        formDiv.classList.add('hidden'); formDiv.innerHTML = '';
        renderNewProductsList(); updateProductCounter();
    });
}
