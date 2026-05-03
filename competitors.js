// ============================================
// Capsim Strategist — Competitors Tab
// ============================================

'use strict';

var COMP_COLUMNS = [
    { key: 'company', label: 'Company', editable: false },
    { key: 'name', label: 'Product', editable: false },
    { key: 'segment', label: 'Segment', editable: true },
    { key: 'pfmn', label: 'Pfmn', editable: true, type: 'number' },
    { key: 'size', label: 'Size', editable: true, type: 'number' },
    { key: 'mtbf', label: 'MTBF', editable: true, type: 'number' },
    { key: 'price', label: 'Price', editable: true, type: 'number' },
    { key: 'ageDec31', label: 'Age', editable: true, type: 'number' },
    { key: 'revisionDate', label: 'Rev Date', editable: true },
    { key: '_awareness', label: 'Awareness', editable: false },
    { key: '_accessibility', label: 'Access.', editable: false },
    { key: 'released', label: 'Released?', editable: false }
];

function renderCompetitorsTab() {
    var emptyEl = document.getElementById('competitors-empty');
    var contentEl = document.getElementById('competitors-content');

    if (!appState.products || appState.products.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    populateFilters();
    renderCompetitorsTable();
    attachFilterListeners();
}

function getCompetitorProducts() {
    return appState.products.filter(function(p) {
        return p.company !== appState.myCompany;
    });
}

function getFilteredCompetitors() {
    var compFilter = document.getElementById('filter-company').value;
    var segFilter = document.getElementById('filter-segment').value;

    return getCompetitorProducts().filter(function(p) {
        if (compFilter !== 'all' && p.company !== compFilter) return false;
        if (segFilter !== 'all') {
            var pSeg = p.segmentKey || '';
            if (pSeg !== segFilter) return false;
        }
        return true;
    });
}

function populateFilters() {
    var compSelect = document.getElementById('filter-company');
    var segSelect = document.getElementById('filter-segment');

    // Company filter
    var companies = [];
    getCompetitorProducts().forEach(function(p) {
        if (companies.indexOf(p.company) === -1) companies.push(p.company);
    });
    var compHtml = '<option value="all">All Companies</option>';
    companies.forEach(function(c) {
        compHtml += '<option value="' + c + '">' + c + '</option>';
    });
    compSelect.innerHTML = compHtml;

    // Segment filter
    var segHtml = '<option value="all">All Segments</option>';
    segHtml += '<option value="traditional">Traditional</option>';
    segHtml += '<option value="lowEnd">Low End</option>';
    segHtml += '<option value="highEnd">High End</option>';
    segHtml += '<option value="performance">Performance</option>';
    segHtml += '<option value="size">Size</option>';
    segSelect.innerHTML = segHtml;
}

function attachFilterListeners() {
    var compSelect = document.getElementById('filter-company');
    var segSelect = document.getElementById('filter-segment');

    // Clone to remove old listeners
    var newComp = compSelect.cloneNode(true);
    compSelect.parentNode.replaceChild(newComp, compSelect);
    var newSeg = segSelect.cloneNode(true);
    segSelect.parentNode.replaceChild(newSeg, segSelect);

    newComp.addEventListener('change', function() { renderCompetitorsTable(); });
    newSeg.addEventListener('change', function() { renderCompetitorsTable(); });
}

function renderCompetitorsTable() {
    var table = document.getElementById('competitors-table');
    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');

    // Header
    var headerHtml = '<tr>';
    COMP_COLUMNS.forEach(function(col) {
        headerHtml += '<th>' + col.label + '</th>';
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // Body
    var products = getFilteredCompetitors();
    var bodyHtml = '';
    products.forEach(function(p, idx) {
        var modClass = p._modified ? ' modified' : '';
        bodyHtml += '<tr class="comp-row' + modClass + '" data-product-name="' + p.name + '">';
        COMP_COLUMNS.forEach(function(col) {
            var val = getCellValue(p, col);
            var editAttr = col.editable ? ' class="editable" data-key="' + col.key + '"' : '';
            bodyHtml += '<td' + editAttr + '>' + val + '</td>';
        });
        bodyHtml += '</tr>';
    });
    tbody.innerHTML = bodyHtml;

    // Attach inline edit listeners
    attachInlineEditListeners(tbody);
}

function getCellValue(product, col) {
    if (col.key === '_awareness') {
        return getPrimaryAwareness(product);
    }
    if (col.key === '_accessibility') {
        return getPrimaryAccessibility(product);
    }
    if (col.key === 'released') {
        return product.released ? 'Yes' : 'No';
    }
    if (col.key === 'segment') {
        return product.segment || '\u2014';
    }
    if (col.key === 'price') {
        return product.price ? '$' + product.price.toFixed(2) : '$0.00';
    }
    var val = product[col.key];
    if (val === null || val === undefined) return '\u2014';
    return val;
}

function getPrimaryAwareness(product) {
    var segKey = product.segmentKey;
    if (!segKey || !product.segmentData || !product.segmentData[segKey]) return '\u2014';
    var val = product.segmentData[segKey].awareness;
    return val ? val + '%' : '\u2014';
}

function getPrimaryAccessibility(product) {
    var segKey = product.segmentKey;
    if (!segKey || !product.segmentData || !product.segmentData[segKey]) return '\u2014';
    var val = product.segmentData[segKey].accessibility;
    return val ? val + '%' : '\u2014';
}

function attachInlineEditListeners(tbody) {
    var editableCells = tbody.querySelectorAll('td.editable');
    editableCells.forEach(function(td) {
        td.addEventListener('click', function() {
            if (td.classList.contains('editing')) return;
            startInlineEdit(td);
        });
    });
}

function startInlineEdit(td) {
    var row = td.closest('tr');
    var productName = row.getAttribute('data-product-name');
    var key = td.getAttribute('data-key');
    var product = findProduct(productName);
    if (!product) return;

    var currentVal = product[key];
    if (currentVal === null || currentVal === undefined) currentVal = '';

    td.classList.add('editing');
    var input = document.createElement('input');
    input.type = 'text';
    input.value = currentVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function commit() {
        td.classList.remove('editing');
        var newVal = input.value.trim();

        // Type coercion
        var col = COMP_COLUMNS.find(function(c) { return c.key === key; });
        if (col && col.type === 'number') {
            newVal = parseFloat(newVal) || 0;
        }

        // Save to appState
        product[key] = newVal;
        product._modified = true;

        // Update display
        td.textContent = getCellValue(product, col || { key: key });
        row.classList.add('modified');
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { input.blur(); }
        if (e.key === 'Escape') {
            td.classList.remove('editing');
            var col = COMP_COLUMNS.find(function(c) { return c.key === key; });
            td.textContent = getCellValue(product, col || { key: key });
        }
    });
}