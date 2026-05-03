// ============================================
// Capsim Strategist — Simulator Tab (Static Map)
// ============================================

'use strict';

// --- Constants ---

var MAP_SIZE = 600;
var MAP_PAD = 40;
var MAP_AREA = MAP_SIZE - 2 * MAP_PAD; // 520

// Ideal spot offsets from PRD Section 10.3
var SEGMENT_OFFSETS = {
    traditional:  { pfmn: 0.0, size: 0.0 },
    lowEnd:       { pfmn: -0.8, size: 0.8 },
    highEnd:      { pfmn: 1.4, size: -1.4 },
    performance:  { pfmn: 1.4, size: -1.0 },
    size:         { pfmn: 1.0, size: -1.4 }
};

// Segment visual styling
var SEGMENT_COLORS = {
    traditional:  { stroke: '#d97706', greenTint: '#6ee7b7', midTint: '#fde68a', redTint: '#f87171' },
    lowEnd:       { stroke: '#059669', greenTint: '#6ee7b7', midTint: '#bef264', redTint: '#f87171' },
    highEnd:      { stroke: '#db2777', greenTint: '#a78bfa', midTint: '#f9a8d4', redTint: '#f87171' },
    performance:  { stroke: '#dc2626', greenTint: '#6ee7b7', midTint: '#fdba74', redTint: '#ef4444' },
    size:         { stroke: '#7c3aed', greenTint: '#a78bfa', midTint: '#c4b5fd', redTint: '#f87171' }
};

// --- Coordinate Helpers ---

function toSvgX(pfmn) {
    return MAP_PAD + (pfmn / 20) * MAP_AREA;
}

function toSvgY(size) {
    // Size 20 at top, Size 0 at bottom
    return MAP_PAD + ((20 - size) / 20) * MAP_AREA;
}

function unitsToPixels(units) {
    return (units / 20) * MAP_AREA;
}

// --- SVG Namespace Helper ---

var SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, text) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
        Object.keys(attrs).forEach(function(k) {
            el.setAttribute(k, attrs[k]);
        });
    }
    if (text !== undefined) el.textContent = text;
    return el;
}

// --- Main Render ---

function renderSimulatorTab() {
    var emptyEl = document.getElementById('simulator-empty');
    var contentEl = document.getElementById('simulator-content');
    var subtitleEl = document.getElementById('sim-subtitle');

    if (!appState.products || appState.products.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    // Update subtitle
    subtitleEl.textContent = 'Round ' + appState.round + ' \u2022 ' + (appState.endDate || '') + ' (frozen view)';

    // Clear and rebuild SVG
    var svg = document.getElementById('perceptual-map');
    svg.innerHTML = '';

    var defs = buildSvgDefs();
    svg.appendChild(defs);
    svg.appendChild(buildGrid());
    svg.appendChild(buildSegments());
    svg.appendChild(buildProducts());
    svg.appendChild(buildIdealMarkers());
    svg.appendChild(buildTooltipLayer());

    initHideCompetitorsToggle();
}

// --- Defs (Gradients) ---

function buildSvgDefs() {
    var defs = svgEl('defs');

    var segKeys = Object.keys(SEGMENT_COLORS);
    segKeys.forEach(function(key) {
        var colors = SEGMENT_COLORS[key];
        var grad = svgEl('radialGradient', { id: 'grad-' + key, cx: '50%', cy: '50%', r: '50%' });
        // Centre to fine-cut edge (62.5%): green tint
        grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': colors.greenTint, 'stop-opacity': '1' }));
        grad.appendChild(svgEl('stop', { offset: '62.5%', 'stop-color': colors.greenTint, 'stop-opacity': '0.9' }));
        // Transition band (fine cut to rough cut): green -> mid -> red
        grad.appendChild(svgEl('stop', { offset: '78%', 'stop-color': colors.midTint, 'stop-opacity': '0.7' }));
        grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': colors.redTint, 'stop-opacity': '0.6' }));
        defs.appendChild(grad);
    });

    return defs;
}

// --- Grid & Axes ---

function buildGrid() {
    var g = svgEl('g', { 'class': 'map-grid' });

    // Background rect
    g.appendChild(svgEl('rect', { x: MAP_PAD, y: MAP_PAD, width: MAP_AREA, height: MAP_AREA, fill: '#fafafa', stroke: '#e5e7eb', 'stroke-width': '1' }));

    // Gridlines at 5-unit intervals
    for (var i = 0; i <= 20; i += 5) {
        var x = toSvgX(i);
        var y = toSvgY(i);
        // Vertical line (performance axis)
        if (i > 0 && i < 20) {
            g.appendChild(svgEl('line', { x1: x, y1: MAP_PAD, x2: x, y2: MAP_PAD + MAP_AREA, stroke: '#e5e7eb', 'stroke-width': '0.5' }));
        }
        // Horizontal line (size axis)
        var yLine = toSvgY(i);
        if (i > 0 && i < 20) {
            g.appendChild(svgEl('line', { x1: MAP_PAD, y1: yLine, x2: MAP_PAD + MAP_AREA, y2: yLine, stroke: '#e5e7eb', 'stroke-width': '0.5' }));
        }

        // X-axis tick labels (Performance)
        var tickLabel = svgEl('text', { x: x, y: MAP_PAD + MAP_AREA + 16, 'text-anchor': 'middle', 'font-size': '9', fill: '#6b7280' }, i.toString());
        g.appendChild(tickLabel);

        // Y-axis tick labels (Size) — note: Y is inverted
        var yTickLabel = svgEl('text', { x: MAP_PAD - 8, y: toSvgY(i) + 3, 'text-anchor': 'end', 'font-size': '9', fill: '#6b7280' }, i.toString());
        g.appendChild(yTickLabel);
    }

    // Axis labels
    g.appendChild(svgEl('text', { x: MAP_PAD + MAP_AREA / 2, y: MAP_SIZE - 4, 'text-anchor': 'middle', 'font-size': '11', fill: '#374151', 'font-weight': '600' }, 'Performance \u2192'));
    g.appendChild(svgEl('text', { x: 12, y: MAP_PAD + MAP_AREA / 2, 'text-anchor': 'middle', 'font-size': '11', fill: '#374151', 'font-weight': '600', transform: 'rotate(-90, 12, ' + (MAP_PAD + MAP_AREA / 2) + ')' }, '\u2190 Size'));

    return g;
}

// --- Segment Circles ---

function buildSegments() {
    var g = svgEl('g', { 'class': 'map-segments' });
    var segKeys = Object.keys(SEGMENT_OFFSETS);

    segKeys.forEach(function(key) {
        var seg = appState.segments[key];
        if (!seg) return;

        var idealPos = getIdealPosition(seg);
        if (!idealPos) return;

        var offset = SEGMENT_OFFSETS[key];
        var centre = { pfmn: idealPos.pfmn - offset.pfmn, size: idealPos.size - offset.size };
        var cx = toSvgX(centre.pfmn);
        var cy = toSvgY(centre.size);
        var roughR = unitsToPixels(4.0);
        var fineR = unitsToPixels(2.5);
        var colors = SEGMENT_COLORS[key];

        // Gradient fill circle (rough cut radius, semi-transparent)
        g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: roughR, fill: 'url(#grad-' + key + ')', opacity: '0.45' }));

        // Fine-cut boundary (solid stroke)
        g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: fineR, fill: 'none', stroke: colors.stroke, 'stroke-width': '1.5' }));

        // Rough-cut boundary (dashed stroke)
        g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: roughR, fill: 'none', stroke: colors.stroke, 'stroke-width': '1', 'stroke-dasharray': '6 3' }));

        // Segment label at centre
        g.appendChild(svgEl('text', { x: cx, y: cy + 3, 'text-anchor': 'middle', 'font-size': '10', fill: colors.stroke, 'font-weight': '600', opacity: '0.8' }, seg.name));
    });

    return g;
}

// --- Ideal Spot Markers ---

function buildIdealMarkers() {
    var g = svgEl('g', { 'class': 'map-ideals' });
    var segKeys = Object.keys(SEGMENT_OFFSETS);

    segKeys.forEach(function(key) {
        var seg = appState.segments[key];
        if (!seg) return;

        var idealPos = getIdealPosition(seg);
        if (!idealPos) return;

        var x = toSvgX(idealPos.pfmn);
        var y = toSvgY(idealPos.size);
        // Small upward triangle — universal red
        var s = 6; // half-size
        var points = (x) + ',' + (y - s) + ' ' + (x - s) + ',' + (y + s) + ' ' + (x + s) + ',' + (y + s);
        var tri = svgEl('polygon', { points: points, fill: '#dc2626', stroke: '#ffffff', 'stroke-width': '1', 'class': 'ideal-marker' });
        g.appendChild(tri);

        // Tooltip title on hover
        var title = svgEl('title', {}, seg.name + ' ideal: (' + idealPos.pfmn.toFixed(1) + ', ' + idealPos.size.toFixed(1) + ')');
        tri.appendChild(title);
    });

    return g;
}

// --- Product Dots ---

function buildProducts() {
    var g = svgEl('g', { 'class': 'map-products' });

    // Competitors first (behind Andrews)
    var competitors = appState.products.filter(function(p) {
        return p.company !== appState.myCompany && p.released;
    });
    competitors.forEach(function(p) {
        var cx = toSvgX(p.pfmn);
        var cy = toSvgY(p.size);
        var dot = svgEl('circle', { cx: cx, cy: cy, r: '5', fill: '#9ca3af', stroke: '#ffffff', 'stroke-width': '1', 'class': 'product-dot competitor-dot' });
        var tooltip = buildProductTooltipTitle(p);
        dot.appendChild(tooltip);
        g.appendChild(dot);
    });

    // Andrews products (on top)
    var myProducts = appState.products.filter(function(p) {
        return p.company === appState.myCompany && p.released;
    });
    myProducts.forEach(function(p) {
        var cx = toSvgX(p.pfmn);
        var cy = toSvgY(p.size);

        // White halo + blue fill
        var dot = svgEl('circle', { cx: cx, cy: cy, r: '8', fill: '#2563eb', stroke: '#ffffff', 'stroke-width': '2', 'class': 'product-dot andrews-dot' });
        var tooltip = buildProductTooltipTitle(p);
        dot.appendChild(tooltip);
        g.appendChild(dot);

        // Name label
        var label = svgEl('text', { x: cx, y: cy - 12, 'text-anchor': 'middle', 'font-size': '9', fill: '#1e40af', 'font-weight': '600' }, p.name);
        g.appendChild(label);
    });

    return g;
}

// --- Tooltip (SVG title element for native browser tooltip) ---

function buildProductTooltipTitle(p) {
    var text = p.name + ' (' + p.company + ')';
    text += '\nSegment: ' + (p.segment || 'N/A');
    text += '\nPfmn: ' + p.pfmn + ' | Size: ' + p.size;
    text += '\nPrice: $' + p.price.toFixed(2) + ' | Age: ' + p.ageDec31;
    text += '\nMTBF: ' + p.mtbf;
    return svgEl('title', {}, text);
}

function buildTooltipLayer() {
    // Placeholder for future custom tooltip (Layer 5)
    return svgEl('g', { 'class': 'map-tooltip-layer' });
}

// --- Helpers ---

function getIdealPosition(seg) {
    if (!seg || !seg.buyingCriteria) return null;
    for (var i = 0; i < seg.buyingCriteria.length; i++) {
        if (seg.buyingCriteria[i].idealPosition) {
            return seg.buyingCriteria[i].idealPosition;
        }
    }
    return null;
}

// --- Hide Competitors Toggle ---

function initHideCompetitorsToggle() {
    var toggle = document.getElementById('hide-competitors-toggle');
    if (!toggle) return;
    // Clone to remove old listeners
    var newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    newToggle.addEventListener('change', function() {
        var svg = document.getElementById('perceptual-map');
        var dots = svg.querySelectorAll('.competitor-dot');
        dots.forEach(function(dot) {
            dot.style.display = newToggle.checked ? 'none' : '';
        });
    });
}
