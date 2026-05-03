// ============================================
// Capsim Strategist — Simulation Engine (Pure)
// No DOM access. Pure state computation.
// Now supports multi-year timeline (globalMonth 0 to (8-parsedRound)*12).
// ============================================

'use strict';

// Drift rates per year (from PRD Section 10.1)
var DRIFT_RATES = {
    traditional:  { pfmn: 0.7, size: -0.7 },
    lowEnd:       { pfmn: 0.5, size: -0.5 },
    highEnd:      { pfmn: 0.9, size: -0.9 },
    performance:  { pfmn: 1.0, size: -0.7 },
    size:         { pfmn: 0.7, size: -1.0 }
};

// ============================================
// Main entry: computeStateAtMonth(globalMonth)
// globalMonth 0 = Jan of first simulated year
// globalMonth can go up to (8 - parsedRound) * 12
// ============================================

function computeStateAtMonth(M) {
    // Use globalMonthToInfo (from helpers.js) to get date label
    var info = globalMonthToInfo(M, appState.round);
    var dateLabel = info.label;

    var segments = computeSegments(M);
    var products = computeProducts(M, segments);
    computeCssScores(products, segments, M);
    computeDemandShares(products);

    return { month: M, dateLabel: dateLabel, segments: segments, products: products };
}

// ============================================
// Segment drift (accumulates across years)
// ============================================

function computeSegments(M) {
    var result = {};
    var segKeys = Object.keys(SEGMENT_OFFSETS);

    segKeys.forEach(function(key) {
        var seg = appState.segments[key];
        if (!seg) return;

        var idealPos = getIdealPosition(seg);
        if (!idealPos) return;

        var offset = SEGMENT_OFFSETS[key];
        // Round-start centre = parsed ideal position minus offset
        var startCentre = {
            pfmn: idealPos.pfmn - offset.pfmn,
            size: idealPos.size - offset.size
        };

        // Monthly drift = annual drift / 12
        // Accumulates linearly: at globalMonth M, total drift = M * monthly
        var drift = DRIFT_RATES[key];
        var centre = {
            pfmn: startCentre.pfmn + M * (drift.pfmn / 12),
            size: startCentre.size + M * (drift.size / 12)
        };

        var ideal = {
            pfmn: centre.pfmn + offset.pfmn,
            size: centre.size + offset.size
        };

        result[key] = { centre: centre, idealSpot: ideal, buyingCriteria: seg.buyingCriteria };
    });

    return result;
}

// ============================================
// Product positions and ages (multi-revision)
// ============================================

function computeProducts(M, segments) {
    var results = [];

    appState.products.forEach(function(p) {
        var isAndrews = (p.company === appState.myCompany);
        var prod = computeOneProduct(p, M, isAndrews);
        if (prod) results.push(prod);
    });

    appState.newProducts.forEach(function(np) {
        var prod = computeNewProduct(np, M);
        if (prod) results.push(prod);
    });

    return results;
}

function computeOneProduct(p, M, isAndrews) {
    var pfmn = p.pfmn;
    var size = p.size;
    var mtbf = p.mtbf;
    var price = p.price;
    var released = p.released;
    var hasFutureRevision = false;
    var repositionedThisMonth = false;

    if (isAndrews) {
        // Walk the plannedRevisions array — find the latest revision applied by month M
        var revisions = appState.plannedRevisions[p.name] || [];
        var appliedRevision = null;
        revisions.forEach(function(rev) {
            var gm = dateToGlobalMonth(rev.revisionDate, appState.round);
            if (gm !== null && gm <= M) {
                appliedRevision = rev;
            }
            if (gm === M) repositionedThisMonth = true;
        });
        if (appliedRevision) {
            pfmn = appliedRevision.pfmn;
            size = appliedRevision.size;
            mtbf = appliedRevision.mtbf;
            price = appliedRevision.price;
            released = true; // revision makes unreleased products appear
        }
    } else {
        // Competitor: check if revision date is in the simulation window
        if (p.revisionDate) {
            var compGm = dateToGlobalMonth(p.revisionDate, appState.round);
            if (compGm !== null && compGm >= 0) {
                hasFutureRevision = true;
            }
        }
    }

    // Skip unreleased products that haven't been activated by a revision
    if (!released && !isAndrews) return null;
    if (!released && isAndrews) {
        // Check if any revision has activated this product
        var revs = appState.plannedRevisions[p.name] || [];
        var activated = false;
        revs.forEach(function(rev) {
            var gm = dateToGlobalMonth(rev.revisionDate, appState.round);
            if (gm !== null && gm <= M) activated = true;
        });
        if (!activated) return null;
        released = true;
    }

    // Age calculation: walks all applied revisions, halving at each
    var age = computeAge(p.ageDec31, M, p.name);

    return {
        name: p.name,
        company: p.company,
        segmentKey: p.segmentKey,
        segment: p.segment,
        pfmn: pfmn,
        size: size,
        mtbf: mtbf,
        price: price,
        age: age,
        released: released,
        repositionedThisMonth: repositionedThisMonth,
        hasFutureRevision: hasFutureRevision,
        css: null,
        demandShare: 0
    };
}

function computeNewProduct(np, M) {
    var releaseMonth = dateToGlobalMonth(np.releaseDate, appState.round);
    if (releaseMonth === null || releaseMonth > M) return null;

    var age = (M - releaseMonth) / 12;

    return {
        name: np.name,
        company: appState.myCompany,
        segmentKey: np.segment,
        segment: getSegmentDisplayName(np.segment),
        pfmn: np.pfmn,
        size: np.size,
        mtbf: np.mtbf,
        price: np.price,
        age: age,
        released: true,
        repositionedThisMonth: (releaseMonth === M),
        hasFutureRevision: false,
        css: null,
        demandShare: 0
    };
}

function computeAge(ageDec31, M, productName) {
    // Walk ALL revisions applied up to month M.
    // Each revision halves the age at the moment it applies.
    var revisions = appState.plannedRevisions[productName] || [];
    var age = ageDec31;
    var lastMonth = 0;

    revisions.forEach(function(rev) {
        var gm = dateToGlobalMonth(rev.revisionDate, appState.round);
        if (gm !== null && gm <= M) {
            age = age + (gm - lastMonth) / 12;  // age up to this revision
            age = age / 2;                        // halve on revision
            lastMonth = gm;
        }
    });

    // Age from last event to current month
    age = age + (M - lastMonth) / 12;
    return age;
}

// ============================================
// CSS Scoring (with price range adjustment per year)
// ============================================

function computeCssScores(products, segments, M) {
    // M is globalMonth — used to calculate how many years of price drop
    var yearsElapsed = Math.floor(M / 12);

    products.forEach(function(p) {
        if (!p.released || !p.segmentKey) {
            p.css = { total: 0, position: 0, age: 0, price: 0, mtbf: 0, positionRaw: 0, ageRaw: 0, priceRaw: 0, mtbfRaw: 0 };
            return;
        }

        var seg = segments[p.segmentKey];
        if (!seg || !seg.buyingCriteria) {
            p.css = { total: 0, position: 0, age: 0, price: 0, mtbf: 0, positionRaw: 0, ageRaw: 0, priceRaw: 0, mtbfRaw: 0 };
            return;
        }

        var criteria = seg.buyingCriteria;
        var ideal = seg.idealSpot;

        var posRaw = scorePosition(p.pfmn, p.size, ideal.pfmn, ideal.size);
        var ageRaw = 0, priceRaw = 0, mtbfRaw = 0;
        var posWeight = 0, ageWeight = 0, priceWeight = 0, mtbfWeight = 0;
        var idealAge = 2.0;
        var priceRange = null, mtbfRange = null;

        criteria.forEach(function(c) {
            if (c.criterion === 'Position') { posWeight = c.importance; }
            else if (c.criterion === 'Age') { ageWeight = c.importance; idealAge = c.idealAge !== undefined ? c.idealAge : 2.0; }
            else if (c.criterion === 'Price') { priceWeight = c.importance; priceRange = c.priceRange; }
            else if (c.criterion === 'Reliability') { mtbfWeight = c.importance; mtbfRange = c.mtbfRange; }
        });

        // PRD 10.4: price ranges drop $0.50 per year
        if (priceRange) {
            priceRange = [priceRange[0] - 0.5 * yearsElapsed, priceRange[1] - 0.5 * yearsElapsed];
        }

        ageRaw = scoreAge(p.age, idealAge);
        priceRaw = priceRange ? scorePrice(p.price, priceRange[0], priceRange[1]) : 0;
        mtbfRaw = mtbfRange ? scoreMtbf(p.mtbf, mtbfRange[0], mtbfRange[1]) : 0;

        var total = posRaw * posWeight + ageRaw * ageWeight + priceRaw * priceWeight + mtbfRaw * mtbfWeight;
        total = Math.min(100, Math.max(0, total));

        p.css = {
            total: Math.round(total * 10) / 10,
            position: Math.round(posRaw * posWeight * 10) / 10,
            age: Math.round(ageRaw * ageWeight * 10) / 10,
            price: Math.round(priceRaw * priceWeight * 10) / 10,
            mtbf: Math.round(mtbfRaw * mtbfWeight * 10) / 10,
            positionRaw: posRaw,
            ageRaw: ageRaw,
            priceRaw: priceRaw,
            mtbfRaw: mtbfRaw
        };
    });
}

// --- Position Score ---
function scorePosition(pfmn, size, idealPfmn, idealSize) {
    var dx = pfmn - idealPfmn;
    var dy = size - idealSize;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 2.5) return 1.0 - (dist / 2.5) * 0.01;
    else if (dist <= 4.0) { var t = (dist - 2.5) / 1.5; return 0.99 * Math.pow(1 - t, 2); }
    return 0;
}

// --- Age Score ---
function scoreAge(age, idealAge) {
    var diff = Math.abs(age - idealAge);
    return Math.exp(-(diff * diff) / (2 * 2.0 * 2.0));
}

// --- Price Score ---
function scorePrice(price, low, high) {
    if (price >= low && price <= high) return 1.0 - (price - low) / (high - low);
    else if (price < low) return Math.min(1.0, 1.0 + (low - price) * 0.01);
    else return Math.max(0, 1.0 - (price - high) * 0.20);
}

// --- MTBF Score ---
function scoreMtbf(mtbf, low, high) {
    if (mtbf >= low && mtbf <= high) return (mtbf - low) / (high - low);
    else if (mtbf > high) return 1.0;
    else return Math.max(0, 1.0 - ((low - mtbf) / 1000) * 0.20);
}

// ============================================
// Demand Share
// ============================================

function computeDemandShares(products) {
    var segGroups = {};
    products.forEach(function(p) {
        if (!p.released || !p.segmentKey || !p.css) return;
        if (!segGroups[p.segmentKey]) segGroups[p.segmentKey] = [];
        segGroups[p.segmentKey].push(p);
    });
    Object.keys(segGroups).forEach(function(key) {
        var group = segGroups[key];
        var totalCss = 0;
        group.forEach(function(p) { totalCss += p.css.total; });
        group.forEach(function(p) { p.demandShare = totalCss > 0 ? p.css.total / totalCss : 0; });
    });
}
