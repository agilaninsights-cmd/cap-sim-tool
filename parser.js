// ============================================
// Capsim Strategist — Courier Parser
// ============================================

'use strict';

// Company order as it always appears in the Capsim Courier
var COMPANIES = ['Andrews', 'Baldwin', 'Chester', 'Digby', 'Erie', 'Ferris'];

// Segment key mapping
var SEGMENT_KEYS = {
    'Traditional': 'traditional',
    'Trad': 'traditional',
    'Low End': 'lowEnd',
    'Low': 'lowEnd',
    'High End': 'highEnd',
    'High': 'highEnd',
    'Performance': 'performance',
    'Pfmn': 'performance',
    'Size': 'size'
};

function parseCourier(text, warnings) {
    var lines = text.split('\n');

    appState.round = null;
    appState.upcomingRound = null;
    appState.endDate = null;
    appState.segments = {};
    appState.products = [];

    parseRoundAndDate(lines, warnings);
    parseProductionAnalysis(lines, warnings);
    parseSegmentPages(lines, warnings);
    parsePerceptualMap(lines, warnings);
    appState.financials = parseFinancials(lines, warnings);
}

// --- Round and Date ---

function parseRoundAndDate(lines, warnings) {
    var foundRound = false;
    var foundDate = false;

    for (var i = 0; i < Math.min(lines.length, 30); i++) {
        var line = lines[i];

        if (!foundRound) {
            var rm = line.match(/Round:\s*(\d+)/);
            if (rm) {
                appState.round = parseInt(rm[1], 10);
                appState.upcomingRound = appState.round + 1;
                foundRound = true;
            }
        }

        if (!foundDate) {
            var dm = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s*\d{1,2}\s*,?\s*\d{4})/i);
            if (dm) {
                appState.endDate = dm[1].replace(/\s+/g, ' ').trim();
                foundDate = true;
            }
        }

        if (foundRound && foundDate) break;
    }

    if (!foundRound) warnings.push('Could not extract round number.');
    if (!foundDate) warnings.push('Could not extract end date.');
}

// --- Production Analysis ---

function parseProductionAnalysis(lines, warnings) {
    var startIdx = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('Name') !== -1 && lines[i].indexOf('Primary Segment') !== -1 && lines[i].indexOf('Units Sold') !== -1) {
            startIdx = i + 1;
            break;
        }
    }

    if (startIdx === -1) {
        warnings.push('Could not find Production Analysis table.');
        return;
    }

    var endIdx = lines.length;
    for (var i = startIdx; i < lines.length; i++) {
        if (lines[i].indexOf('CAPSTONE') !== -1 && lines[i].indexOf('Page') !== -1) {
            endIdx = i;
            break;
        }
    }

    var companyIdx = 0;
    var hasProductInGroup = false;

    for (var i = startIdx; i < endIdx; i++) {
        var cols = lines[i].split('\t');

        var isBlank = cols.every(function(c) { return c.trim() === ''; });
        if (isBlank) {
            if (hasProductInGroup) {
                companyIdx++;
                hasProductInGroup = false;
            }
            continue;
        }

        var name = cols[0] ? cols[0].trim() : '';
        if (!name || name === ' ') continue;
        // Skip multi-line header fragments (e.g. "Over-", "time")
        if (name.length <= 5 && cols.length < 5) continue;
        if (/^(Over-|time|Auto|Capacity|Plant)/.test(name)) continue;

        var company = COMPANIES[companyIdx] || 'Unknown';
        var segRaw = cols[1] ? cols[1].trim() : '';
        var segKey = segRaw ? (SEGMENT_KEYS[segRaw] || null) : null;

        var product = {
            name: name,
            company: company,
            segment: segKey ? getSegmentDisplayName(segKey) : null,
            segmentKey: segKey,
            released: (segKey !== null),
            unitsSold: parseIntSafe(cols[2]),
            inventory: parseIntSafe(cols[3]),
            revisionDate: cols[4] ? cols[4].trim() : null,
            ageDec31: parseFloatSafe(cols[5]),
            mtbf: parseIntSafe(cols[6]),
            pfmn: parseFloatSafe(cols[7]),
            size: parseFloatSafe(cols[8]),
            price: parseDollar(cols[9]),
            materialCost: parseDollar(cols[10]),
            laborCost: parseDollar(cols[11]),
            contribMargin: parsePercentInt(cols[12]),
            secondShift: parsePercentInt(cols[13]),
            automationNext: parseFloatSafe(cols[14]),
            capacityNext: parseIntSafe(cols[15]),
            plantUtil: parsePercentInt(cols[16]),
            segmentData: {}
        };

        appState.products.push(product);
        hasProductInGroup = true;
    }

    if (appState.products.length === 0) {
        warnings.push('No products found in Production Analysis.');
    }
}

// --- Segment Pages (Buying Criteria + Top Products) ---

function parseSegmentPages(lines, warnings) {
    var defs = [
        { key: 'traditional', title: 'Traditional Market Segment Analysis', top: 'Top Products in Traditional Segment' },
        { key: 'lowEnd', title: 'Low End Market Segment Analysis', top: 'Top Products in Low End Segment' },
        { key: 'highEnd', title: 'High End Market Segment Analysis', top: 'Top Products in High End Segment' },
        { key: 'performance', title: 'Performance Market Segment Analysis', top: 'Top Products in Performance Segment' },
        { key: 'size', title: 'Size Market Segment Analysis', top: 'Top Products in Size Segment' }
    ];

    for (var s = 0; s < defs.length; s++) {
        try {
            parseOneSegment(lines, defs[s], warnings);
        } catch (e) {
            warnings.push('Failed to parse ' + defs[s].key + ': ' + e.message);
        }
    }
}

function parseOneSegment(lines, def, warnings) {
    var pageStart = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(def.title) !== -1) { pageStart = i; break; }
    }
    if (pageStart === -1) {
        warnings.push('Could not find ' + def.key + ' segment page.');
        return;
    }

    var seg = { name: getSegmentDisplayName(def.key), totalDemand: null, growthRate: null, buyingCriteria: [] };

    // Statistics
    for (var i = pageStart; i < Math.min(pageStart + 15, lines.length); i++) {
        if (lines[i].indexOf('Total Industry Unit Demand') !== -1) {
            var p = lines[i].split('\t');
            seg.totalDemand = parseIntSafe(p[p.length - 1] || p[1]);
        }
        if (lines[i].indexOf('Segment Growth Rate') !== -1) {
            var p2 = lines[i].split('\t');
            seg.growthRate = parseFloatSafe((p2[p2.length - 1] || p2[1]).replace('%', ''));
        }
    }

    // Buying Criteria
    var cStart = -1;
    for (var i = pageStart; i < Math.min(pageStart + 30, lines.length); i++) {
        if (lines[i].indexOf('Customer Buying Criteria') !== -1) { cStart = i + 1; break; }
    }

    if (cStart > 0) {
        for (var i = cStart; i < Math.min(cStart + 10, lines.length); i++) {
            if (!/^\d+\./.test(lines[i])) continue;
            var parts = lines[i].split('\t').map(function(s) { return s.trim(); }).filter(function(s) { return s !== ''; });
            if (parts.length < 4) continue;

            var crit = parts[1];
            var exp = parts[2];
            var imp = parseIntSafe(parts[3].replace('%', ''));
            var obj = { criterion: crit, importance: imp };

            if (crit === 'Age') {
                var m = exp.match(/Ideal Age\s*=\s*([\d.]+)/);
                if (m) obj.idealAge = parseFloat(m[1]);
            } else if (crit === 'Price') {
                var m2 = exp.match(/\$([\d.]+)\s*-\s*\$?([\d.]+)/);
                if (m2) obj.priceRange = [parseFloat(m2[1]), parseFloat(m2[2])];
            } else if (crit === 'Ideal Position') {
                var m3 = exp.match(/Pfmn\s*([\d.]+)\s*Size\s*([\d.]+)/);
                if (m3) obj.idealPosition = { pfmn: parseFloat(m3[1]), size: parseFloat(m3[2]) };
                obj.criterion = 'Position';
            } else if (crit === 'Reliability') {
                var m4 = exp.match(/MTBF\s*(\d+)\s*-\s*(\d+)/);
                if (m4) obj.mtbfRange = [parseInt(m4[1], 10), parseInt(m4[2], 10)];
            }

            seg.buyingCriteria.push(obj);
        }
    }

    if (seg.buyingCriteria.length === 0) {
        warnings.push('No buying criteria for ' + def.key + '.');
    }

    appState.segments[def.key] = seg;
    parseTopProducts(lines, pageStart, def, warnings);
}

function parseTopProducts(lines, pageStart, def, warnings) {
    var tStart = -1;
    for (var i = pageStart; i < Math.min(pageStart + 50, lines.length); i++) {
        if (lines[i].indexOf(def.top) !== -1) { tStart = i + 1; break; }
    }
    if (tStart === -1) {
        warnings.push('No Top Products table for ' + def.key + '.');
        return;
    }

    // Find first data row
    var dStart = tStart;
    for (var i = tStart; i < Math.min(tStart + 10, lines.length); i++) {
        var fc = lines[i].split('\t')[0].trim();
        if (fc && /^[A-Z][a-z]/.test(fc) && fc.indexOf('Name') === -1 && fc.indexOf('Market') === -1) {
            dStart = i;
            break;
        }
    }

    // Find end
    var dEnd = lines.length;
    for (var i = dStart; i < lines.length; i++) {
        if (lines[i].indexOf('CAPSTONE') !== -1 && lines[i].indexOf('Page') !== -1) { dEnd = i; break; }
    }

    for (var i = dStart; i < dEnd; i++) {
        var cols = lines[i].split('\t');
        var nm = cols[0] ? cols[0].trim() : '';
        if (!nm || !/^[A-Z]/.test(nm)) continue;

        var awareness = parsePercentInt(cols[11]);
        var accessibility = parsePercentInt(cols[13]);
        var decCustSurvey = parseIntSafe(cols[14]);
        var mktShare = parsePercentInt(cols[1]);
        var unitsSoldToSeg = parseIntSafe(cols[2]);
        var stockOut = (cols[4] && cols[4].trim().toUpperCase() === 'YES');

        // Find the product in appState and attach segment data
        var prod = findProduct(nm);
        if (prod) {
            prod.segmentData[def.key] = {
                awareness: awareness,
                accessibility: accessibility,
                decCustSurvey: decCustSurvey,
                marketShare: mktShare,
                unitsSoldToSeg: unitsSoldToSeg,
                stockOut: stockOut
            };
        }
    }
}

// --- Perceptual Map ---

function parsePerceptualMap(lines, warnings) {
    var mapStart = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('Perceptual Map') !== -1 && lines[i].indexOf('All Segments') !== -1) {
            mapStart = i + 1;
            break;
        }
    }
    if (mapStart === -1) {
        warnings.push('Could not find Perceptual Map section.');
        return;
    }

    var mapEnd = lines.length;
    for (var i = mapStart; i < lines.length; i++) {
        if (lines[i].indexOf('CAPSTONE') !== -1 && lines[i].indexOf('Page') !== -1) { mapEnd = i; break; }
    }

    var currentCompany = null;
    for (var i = mapStart; i < mapEnd; i++) {
        var line = lines[i].trim();
        if (!line) continue;

        // Check if line is a company name
        if (COMPANIES.indexOf(line) !== -1) {
            currentCompany = line;
            continue;
        }

        // Skip header lines
        if (line.indexOf('Name') !== -1 && line.indexOf('Pfmn') !== -1) continue;

        // Product data line
        if (currentCompany) {
            var cols = lines[i].split('\t');
            var nm = cols[0] ? cols[0].trim() : '';
            if (!nm || !/^[A-Z]/.test(nm)) continue;

            var pfmn = parseFloatSafe(cols[1]);
            var size = parseFloatSafe(cols[2]);
            var revised = cols[3] ? cols[3].trim() : null;

            // Cross-check / supplement existing product data
            var prod = findProduct(nm);
            if (prod) {
                // Use perceptual map data if production data shows 0
                if (prod.pfmn === 0 && pfmn > 0) prod.pfmn = pfmn;
                if (prod.size === 0 && size > 0) prod.size = size;
                if (!prod.revisionDate && revised) prod.revisionDate = revised;
            }
        }
    }
}

// --- Financials (Page 1 & 2) ---
// Extracts financial metrics for all 6 companies from "Selected Financial Statistics"
// and stock prices from "Stock Market Summary".

function parseFinancials(lines, warnings) {
    var financials = {};
    COMPANIES.forEach(function(c) { financials[c] = {}; });

    // --- Selected Financial Statistics (Page 1) ---
    var fsStart = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('Selected Financial Statistics') !== -1) { fsStart = i + 1; break; }
    }
    if (fsStart === -1) { warnings.push('Could not find Financial Statistics.'); return financials; }

    // Map metric names to our object keys
    var metricMap = {
        'ROS': 'ros', 'Asset Turnover': 'assetTurnover', 'ROA': 'roa', 'ROE': 'roe',
        'Emergency Loan': 'emergencyLoan', 'Sales': 'sales', 'EBIT': 'ebit',
        'Profits': 'profit', 'Cumulative Profit': 'cumulativeProfit'
    };

    for (var i = fsStart; i < Math.min(fsStart + 20, lines.length); i++) {
        var line = lines[i];
        if (line.indexOf('CAPSTONE') !== -1) break;
        var cols = line.split('\t');
        var label = cols[0] ? cols[0].trim() : '';
        var matchedKey = null;
        Object.keys(metricMap).forEach(function(mk) {
            if (label.indexOf(mk) === 0) matchedKey = metricMap[mk];
        });
        if (!matchedKey) continue;
        for (var c = 0; c < COMPANIES.length; c++) {
            var val = cols[c + 1] ? cols[c + 1].trim() : '0';
            // Percentage metrics vs dollar metrics
            if (matchedKey === 'ros' || matchedKey === 'roa' || matchedKey === 'roe' || matchedKey === 'assetTurnover') {
                financials[COMPANIES[c]][matchedKey] = parseFloatSafe(val.replace('%', ''));
            } else {
                // Handle parentheses for negative: ($2,225,417) -> -2225417
                var cleaned = val.replace(/\(([^)]+)\)/, '-$1');
                financials[COMPANIES[c]][matchedKey] = parseDollar(cleaned);
            }
        }
    }

    // --- Stock Prices (Page 2 — Stock Market Summary) ---
    var smStart = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('Stock Market Summary') !== -1) { smStart = i + 1; break; }
    }
    if (smStart !== -1) {
        for (var i = smStart; i < Math.min(smStart + 15, lines.length); i++) {
            var cols = lines[i].split('\t');
            var company = cols[0] ? cols[0].trim() : '';
            if (COMPANIES.indexOf(company) !== -1) {
                financials[company].stockPrice = parseDollar(cols[1]);
            }
        }
    }

    return financials;
}
