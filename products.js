// ============================================
// Capsim Strategist — Your Products Tab
// ============================================

'use strict';

var MAX_PRODUCTS = 8;

function renderProductsTab() {
    var emptyEl = document.getElementById('products-empty');
    var contentEl = document.getElementById('products-content');

    if (!appState.products || appState.products.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    initPlannedChanges();
    renderProductCards();
    renderNewProductsList();
    updateProductCounter();
    initAddProductButton();
}

function initPlannedChanges() {
    var myProducts = appState.products.filter(function(p) {
        return p.company === appState.myCompany;
    });
    myProducts.forEach(function(p) {
        if (!appState.plannedChanges[p.name]) {
            appState.plannedChanges[p.name] = {
                reposition: false,
                pfmn: p.pfmn,
                size: p.size,
                mtbf: p.mtbf,
                price: p.price,
                revisionDate: ''
            };
        }
    });
}

function renderProductCards() {
    var container = document.getElementById('products-list');
    var myProducts = appState.products.filter(function(p) {
        return p.company === appState.myCompany;
    });
    var html = '';
    myProducts.forEach(function(p) {
        var plan = appState.plannedChanges[p.name];
        var disabledClass = plan.reposition ? '' : ' disabled';
        var checkedAttr = plan.reposition ? ' checked' : '';
        html += buildProductCard(p, plan, disabledClass, checkedAttr);
    });
    container.innerHTML = html;
    attachProductCardListeners();
}

function buildProductCard(p, plan, disabledClass, checkedAttr) {
    var h = '';
    h += '<div class="product-card" data-product="' + p.name + '">';
    h += '<div class="product-card-header">';
    h += '<span class="product-card-title">' + p.name + '</span>';
    h += '<span class="product-card-segment">' + (p.segment || 'Unreleased') + '</span>';
    h += '</div>';
    h += '<div class="current-specs">';
    h += '<div class="spec-item"><span class="spec-label">Pfmn</span><span class="spec-value">' + p.pfmn + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">Size</span><span class="spec-value">' + p.size + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">MTBF</span><span class="spec-value">' + p.mtbf + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">Price</span><span class="spec-value">$' + p.price.toFixed(2) + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">Age</span><span class="spec-value">' + p.ageDec31 + '</span></div>';
    h += '<div class="spec-item"><span class="spec-label">Rev Date</span><span class="spec-value">' + (p.revisionDate || '\u2014') + '</span></div>';
    h += '</div>';
    var inFlightDate = getInFlightRevisionDate(p);
    var toggleDisabled = inFlightDate ? ' disabled' : '';
    var toggleTitle = inFlightDate ? ' title="R&D project already in progress (completes ' + inFlightDate + '). A product can only have one revision running at a time."' : '';
    h += '<div class="toggle-row">';
    h += '<input type="checkbox" id="toggle-' + p.name + '" class="reposition-toggle"' + checkedAttr + toggleDisabled + toggleTitle + '>';
    h += '<label for="toggle-' + p.name + '">Reposition this product this round</label>';
    if (inFlightDate) h += '<span class="revision-note">R&D in progress \u2014 completes ' + inFlightDate + '</span>';
    h += '</div>';
    h += '<div class="planned-fields' + disabledClass + '" data-product="' + p.name + '">';
    h += '<div><label>Pfmn</label><input type="number" step="0.1" class="plan-pfmn" value="' + plan.pfmn + '"></div>';
    h += '<div><label>Size</label><input type="number" step="0.1" class="plan-size" value="' + plan.size + '"></div>';
    h += '<div><label>MTBF</label><input type="number" step="500" class="plan-mtbf" value="' + plan.mtbf + '"></div>';
    h += '<div><label>Price</label><input type="number" step="0.50" class="plan-price" value="' + plan.price + '"></div>';
    h += '<div><label>Rev Date</label><input type="date" class="plan-revdate" value="' + plan.revisionDate + '"></div>';
    h += '</div>';
    h += '<button class="btn-reset" data-product="' + p.name + '">Reset to current</button>';
    if (plan.reposition && plan.revisionDate) {
        var baseYr = getBaseYear();
        var revM = dateToMonth(plan.revisionDate, baseYr);
        if (revM === null || revM > 12) {
            h += '<p class="revision-note">This revision completes ' + plan.revisionDate + ' \u2014 outside this year\u2019s simulation.</p>';
        }
    }
    h += '</div>';
    return h;
}

function getInFlightRevisionDate(p) {
    if (!p.revisionDate) return null;
    var baseYear = getBaseYear();
    // Check if revision date is in the simulation year (upcoming round)
    var revMonth = dateToMonth(p.revisionDate, baseYear);
    if (revMonth !== null && revMonth >= 1) return p.revisionDate;
    // Check if date is in a future year beyond the simulation
    var parts = p.revisionDate.split('/');
    if (parts.length >= 3) {
        var yr = parseInt(parts[2], 10);
        if (yr < 100) yr += 2000;
        if (yr >= baseYear) return p.revisionDate;
    }
    // ISO format check
    if (p.revisionDate.indexOf('-') !== -1) {
        var iParts = p.revisionDate.split('-');
        var iYr = parseInt(iParts[0], 10);
        if (iYr >= baseYear) return p.revisionDate;
    }
    return null;
}

function attachProductCardListeners() {
    var toggles = document.querySelectorAll('.reposition-toggle');
    toggles.forEach(function(toggle) {
        toggle.addEventListener('change', function() {
            var card = toggle.closest('.product-card');
            var name = card.getAttribute('data-product');
            var fields = card.querySelector('.planned-fields');
            appState.plannedChanges[name].reposition = toggle.checked;
            if (toggle.checked) {
                fields.classList.remove('disabled');
            } else {
                fields.classList.add('disabled');
            }
        });
    });

    var inputs = document.querySelectorAll('.planned-fields input');
    inputs.forEach(function(input) {
        input.addEventListener('change', function() {
            var fields = input.closest('.planned-fields');
            var name = fields.getAttribute('data-product');
            var plan = appState.plannedChanges[name];
            if (input.classList.contains('plan-pfmn')) plan.pfmn = parseFloat(input.value) || 0;
            else if (input.classList.contains('plan-size')) plan.size = parseFloat(input.value) || 0;
            else if (input.classList.contains('plan-mtbf')) plan.mtbf = parseInt(input.value) || 0;
            else if (input.classList.contains('plan-price')) plan.price = parseFloat(input.value) || 0;
            else if (input.classList.contains('plan-revdate')) plan.revisionDate = input.value;
        });
    });

    var resetBtns = document.querySelectorAll('.btn-reset');
    resetBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var name = btn.getAttribute('data-product');
            var product = findProduct(name);
            if (!product) return;
            appState.plannedChanges[name] = {
                reposition: false,
                pfmn: product.pfmn,
                size: product.size,
                mtbf: product.mtbf,
                price: product.price,
                revisionDate: ''
            };
            renderProductCards();
        });
    });
}

function renderNewProductsList() {
    var container = document.getElementById('new-products-list');
    if (appState.newProducts.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding:0.5rem 0">No new products added yet.</p>';
        return;
    }
    var h = '';
    appState.newProducts.forEach(function(np, idx) {
        h += '<div class="new-product-card">';
        h += '<div class="npc-info">';
        h += '<span class="npc-name">' + np.name + '</span>';
        h += ' \u2014 ' + getSegmentDisplayName(np.segment);
        h += ' | Pfmn ' + np.pfmn + ' | Size ' + np.size;
        h += ' | MTBF ' + np.mtbf + ' | $' + np.price.toFixed(2);
        h += ' | Release ' + np.releaseDate;
        h += '</div>';
        h += '<button class="btn-danger" data-idx="' + idx + '">Remove</button>';
        h += '</div>';
    });
    container.innerHTML = h;

    var removeBtns = container.querySelectorAll('.btn-danger');
    removeBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = parseInt(btn.getAttribute('data-idx'));
            appState.newProducts.splice(idx, 1);
            renderNewProductsList();
            updateProductCounter();
        });
    });
}

function updateProductCounter() {
    var el = document.getElementById('product-counter');
    var existing = appState.products.filter(function(p) {
        return p.company === appState.myCompany;
    }).length;
    var newCount = appState.newProducts.length;
    var total = existing + newCount;
    el.textContent = existing + ' existing + ' + newCount + ' new = ' + total + ' of ' + MAX_PRODUCTS + ' max';

    var addBtn = document.getElementById('add-product-btn');
    if (addBtn) addBtn.disabled = (total >= MAX_PRODUCTS);
}

function initAddProductButton() {
    var addBtn = document.getElementById('add-product-btn');
    var formDiv = document.getElementById('new-product-form');

    // Remove old listener by replacing element
    var newBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newBtn, addBtn);

    newBtn.addEventListener('click', function() {
        showNewProductForm(formDiv);
    });
}

function showNewProductForm(formDiv) {
    formDiv.classList.remove('hidden');
    var h = '';
    h += '<div class="form-grid">';
    h += '<div><label>Name (must start with A)</label><input type="text" id="np-name" placeholder="A..." maxlength="10"></div>';
    h += '<div><label>Target Segment</label><select id="np-segment">';
    h += '<option value="traditional">Traditional</option>';
    h += '<option value="lowEnd">Low End</option>';
    h += '<option value="highEnd">High End</option>';
    h += '<option value="performance">Performance</option>';
    h += '<option value="size">Size</option>';
    h += '</select></div>';
    h += '<div><label>Pfmn</label><input type="number" id="np-pfmn" step="0.1" value="5.0"></div>';
    h += '<div><label>Size</label><input type="number" id="np-size" step="0.1" value="15.0"></div>';
    h += '<div><label>MTBF</label><input type="number" id="np-mtbf" step="500" value="17000"></div>';
    h += '<div><label>Price</label><input type="number" id="np-price" step="0.50" value="25.00"></div>';
    h += '<div><label>Release Date</label><input type="date" id="np-release"></div>';
    h += '</div>';
    h += '<div class="form-actions">';
    h += '<button class="btn-primary" id="np-submit">Add Product</button>';
    h += '<button class="btn-secondary" id="np-cancel">Cancel</button>';
    h += '</div>';
    formDiv.innerHTML = h;

    document.getElementById('np-cancel').addEventListener('click', function() {
        formDiv.classList.add('hidden');
        formDiv.innerHTML = '';
    });

    document.getElementById('np-submit').addEventListener('click', function() {
        var name = document.getElementById('np-name').value.trim();
        var segment = document.getElementById('np-segment').value;
        var pfmn = parseFloat(document.getElementById('np-pfmn').value) || 0;
        var size = parseFloat(document.getElementById('np-size').value) || 0;
        var mtbf = parseInt(document.getElementById('np-mtbf').value) || 0;
        var price = parseFloat(document.getElementById('np-price').value) || 0;
        var releaseDate = document.getElementById('np-release').value;

        // Validation
        if (!name || name.charAt(0).toUpperCase() !== 'A') {
            alert('Product name must start with "A" (Andrews naming convention).');
            return;
        }
        if (!releaseDate) {
            alert('Please set a release date.');
            return;
        }

        var existing = appState.products.filter(function(p) {
            return p.company === appState.myCompany;
        }).length;
        if (existing + appState.newProducts.length >= MAX_PRODUCTS) {
            alert('Maximum ' + MAX_PRODUCTS + ' products reached.');
            return;
        }

        appState.newProducts.push({
            name: name,
            segment: segment,
            pfmn: pfmn,
            size: size,
            mtbf: mtbf,
            price: price,
            releaseDate: releaseDate
        });

        formDiv.classList.add('hidden');
        formDiv.innerHTML = '';
        renderNewProductsList();
        updateProductCounter();
    });
}