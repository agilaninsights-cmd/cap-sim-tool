// ============================================
// Capsim Strategist — Simulation Engine (Pure)
// No DOM access. Pure state computation.
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

// Month names for date labels
var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

// ============================================
// Main entry: computeStateAtMonth(M)
// M: 0 = start of year (Jan 1), 12 = end of year (Dec 31)
// ============================================

function computeStateAtMonth(M) {
    var baseYear = getBaseYear();
    var dateLabel = getDateLabel(M, baseYear);

    // Compute segment positions
    var segments = computeSegments(M);

    // Compute product states
    var products = computeProducts(M, segments);

    // Compute CSS and demand share
    computeCssScores(products, segments);
    computeDemandShares(products);

    return {
        month: M,
        dateLabel: dateLabel,
        segments: segments,
        products: products
    };
}

// ============================================
// Date helpers
// ============================================

function getBaseYear() {
    // If round 2 ended Dec 31, 2028 -> upcoming round 3 covers 2029
    if (!appState.endDate) return 2027 + (appState.upcomingRound || 1);
    var yearMatch = appState.endDate.match(/(\d{4})/);
    if (yearMatch) return parseInt(yearMatch[1], 10) + 1;
    return 2029;
}

function getDateLabel(M, baseYear) {
    if (M <= 0) return 'January 1, ' + baseYear;
    if (M >= 12) return 'December 31, ' + baseYear;
    // End of month M (month M is 1-indexed here)
    var monthIdx = Math.min(M, 12) - 1;
    var daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return MONTH_NAMES[monthIdx] + ' ' + daysInMonth[monthIdx] + ', ' + baseYear;
}

// ============================================
// Segment drift
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
        // Round-start centre = parsed ideal position - offset
        var startCentre = {
            pfmn: idealPos.pfmn - offset.pfmn,
            size: idealPos.size - offset.size
        };

        // Monthly drift
        var drift = DRIFT_RATES[key];
        var monthlyDriftPfmn = drift.pfmn / 12;
        var monthlyDriftSize = drift.size / 12;

        // Centre at month M
        var centre = {
            pfmn: startCentre.pfmn + M * monthlyDriftPfmn,
            size: startCentre.size + M * monthlyDriftSize
        };

        // Ideal spot at month M
        var ideal = {
            pfmn: centre.pfmn + offset.pfmn,
            size: centre.size + offset.size
        };

        result[key] = {
            centre: centre,
            idealSpot: ideal,
            buyingCriteria: seg.buyingCriteria
        };
    });

    return result;
}

// ============================================
// Product positions and ages
// ============================================

function computeProducts(M, segments) {
    var results = [];

    // Process all parsed products
    appState.products.forEach(function(p) {
        var isAndrews = (p.company === appState.myCompany);
        var prod = computeOneProduct(p, M, isAndrews);
        if (prod) results.push(prod);
    });

    // Process new Andrews products
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
    var repositionMonth = null;
    var hasFutureRevision = false;

    if (isAndrews) {
        var plan = appState.plannedChanges[p.name];
        if (plan && plan.reposition && plan.revisionDate) {
            repositionMonth = dateToMonth(plan.revisionDate, getBaseYear());
            if (repositionMonth !== null && repositionMonth <= M) {
                pfmn = plan.pfmn;
                size = plan.size;
                mtbf = plan.mtbf;
                price = plan.price;
            }
        }
    } else {
        // Competitor: check if revision date is in simulation year
        if (p.revisionDate) {
            var compRevMonth = dateToMonth(p.revisionDate, getBaseYear());
            if (compRevMonth !== null && compRevMonth >= 0 && compRevMonth <= 12) {
                hasFutureRevision = true;
                // Don't change specs — we don't know target
            }
        }
    }

    // Skip unreleased products (unless they become released during the year)
    if (!released && !isAndrews) return null;
    if (!released && isAndrews) {
        // Check if this was an existing unreleased product that gets repositioned
        if (repositionMonth === null || repositionMonth > M) return null;
        released = true;
    }

    // Age calculation
    var age = computeAge(p.ageDec31, M, repositionMonth);

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
        repositionedThisMonth: (repositionMonth === M),
        hasFutureRevision: hasFutureRevision,
        css: null,
        demandShare: 0
    };
}

function computeNewProduct(np, M) {
    var releaseMonth = dateToMonth(np.releaseDate, getBaseYear());
    if (releaseMonth === null || releaseMonth > M) return null;

    // Age starts at 0 on release, increments monthly
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

function computeAge(ageDec31, M, repositionMonth) {
    if (repositionMonth !== null && M >= repositionMonth) {
        // Age at reposition moment
        var ageAtRepos = ageDec31 + repositionMonth / 12;
        var halvedAge = ageAtRepos / 2;
        // Continue from halved age
        return halvedAge + (M - repositionMonth) / 12;
    }
    return ageDec31 + M / 12;
}

function dateToMonth(dateStr, baseYear) {
    if (!dateStr) return null;
    // Handle ISO format (2029-06-15) or M/D/YYYY format
    var parts;
    if (dateStr.indexOf('-') !== -1) {
        parts = dateStr.split('-');
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10);
        if (year !== baseYear) return null;
        return month; // 1-12
    }
    // M/D/YYYY format
    parts = dateStr.split('/');
    if (parts.length >= 3) {
        var yr = parseInt(parts[2], 10);
        if (yr < 100) yr += 2000;
        if (yr !== baseYear) return null;
        return parseInt(parts[0], 10); // month 1-12
    }
    return null;
}

// ============================================
// CSS Scoring
// ============================================

function computeCssScores(products, segments) {
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
            if (c.criterion === 'Position') {
                posWeight = c.importance;
            } else if (c.criterion === 'Age') {
                ageWeight = c.importance;
                idealAge = c.idealAge !== undefined ? c.idealAge : 2.0;
            } else if (c.criterion === 'Price') {
                priceWeight = c.importance;
                priceRange = c.priceRange;
            } else if (c.criterion === 'Reliability') {
                mtbfWeight = c.importance;
                mtbfRange = c.mtbfRange;
            }
        });

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

    if (dist <= 2.5) {
        // Inside fine cut: near-perfect
        return 1.0 - (dist / 2.5) * 0.01;
    } else if (dist <= 4.0) {
        // Rough cut band: quadratic drop
        var t = (dist - 2.5) / 1.5;
        return 0.99 * Math.pow(1 - t, 2);
    }
    return 0;
}

// --- Age Score ---
function scoreAge(age, idealAge) {
    var diff = Math.abs(age - idealAge);
    var sigma = 2.0;
    return Math.exp(-(diff * diff) / (2 * sigma * sigma));
}

// --- Price Score ---
function scorePrice(price, low, high) {
    if (price >= low && price <= high) {
        return 1.0 - (price - low) / (high - low);
    } else if (price < low) {
        return Math.min(1.0, 1.0 + (low - price) * 0.01);
    } else {
        var gap = price - high;
        return Math.max(0, 1.0 - gap * 0.20);
    }
}

// --- MTBF Score ---
function scoreMtbf(mtbf, low, high) {
    if (mtbf >= low && mtbf <= high) {
        return (mtbf - low) / (high - low);
    } else if (mtbf > high) {
        return 1.0;
    } else {
        var gap = low - mtbf;
        return Math.max(0, 1.0 - (gap / 1000) * 0.20);
    }
}

// ============================================
// Demand Share
// ============================================

function computeDemandShares(products) {
    // Group by segment
    var segGroups = {};
    products.forEach(function(p) {
        if (!p.released || !p.segmentKey || !p.css) return;
        if (!segGroups[p.segmentKey]) segGroups[p.segmentKey] = [];
        segGroups[p.segmentKey].push(p);
    });

    // Compute shares
    Object.keys(segGroups).forEach(function(key) {
        var group = segGroups[key];
        var totalCss = 0;
        group.forEach(function(p) { totalCss += p.css.total; });

        group.forEach(function(p) {
            p.demandShare = totalCss > 0 ? p.css.total / totalCss : 0;
        });
    });
}
