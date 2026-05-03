// Test multi-year simulation engine
const fs = require('fs');

// Minimal DOM mock
global.document = { createElementNS: function() { return { setAttribute: function(){}, appendChild: function(){}, textContent: '' }; }, getElementById: function() { return { classList: { add: function(){}, remove: function(){} }, innerHTML: '', appendChild: function(){}, querySelectorAll: function(){ return []; } }; } };

// Global state
global.appState = { round: null, upcomingRound: null, endDate: null, myCompany: 'Andrews', segments: {}, products: [], plannedRevisions: {}, newProducts: [], geminiKey: '', lastAiResponse: '' };

// Load files
eval(fs.readFileSync('helpers.js', 'utf8').replace("'use strict';", ''));
eval(fs.readFileSync('parser.js', 'utf8').replace("'use strict';", ''));

// Need SEGMENT_OFFSETS and getIdealPosition from simulator.js
global.SEGMENT_OFFSETS = { traditional:{pfmn:0,size:0}, lowEnd:{pfmn:-0.8,size:0.8}, highEnd:{pfmn:1.4,size:-1.4}, performance:{pfmn:1.4,size:-1.0}, size:{pfmn:1.0,size:-1.4} };
global.getIdealPosition = function(seg) { if (!seg || !seg.buyingCriteria) return null; for (var i = 0; i < seg.buyingCriteria.length; i++) { if (seg.buyingCriteria[i].idealPosition) return seg.buyingCriteria[i].idealPosition; } return null; };

eval(fs.readFileSync('simulation.js', 'utf8').replace("'use strict';", ''));

// Parse
var w = [];
parseCourier(fs.readFileSync('sample_courier.html', 'utf8'), w);

// Add multi-year planned revisions for Able
appState.plannedRevisions['Able'] = [
    { pfmn: 6.5, size: 13.7, mtbf: 17500, price: 27.00, revisionDate: '2029-06-15' },
    { pfmn: 7.2, size: 13.0, mtbf: 18000, price: 26.50, revisionDate: '2030-08-20' }
];

console.log('=== Multi-Year Engine Test ===');
console.log('Parsed Round:', appState.round, '| Base Year:', getBaseYear());
console.log('Total months:', (8 - appState.round) * 12);
console.log('');

// Test month 0 (Jan 2029, no revisions applied yet)
var s0 = computeStateAtMonth(0);
var able0 = s0.products.find(function(p) { return p.name === 'Able'; });
console.log('Month 0:', s0.dateLabel);
console.log('  Able: pfmn=' + able0.pfmn + ' size=' + able0.size + ' age=' + able0.age.toFixed(2));
console.log('  Trad ideal:', JSON.stringify(s0.segments.traditional.idealSpot));

// Test month 6 (Jun 2029, first revision applied)
var s6 = computeStateAtMonth(6);
var able6 = s6.products.find(function(p) { return p.name === 'Able'; });
console.log('\nMonth 6:', s6.dateLabel);
console.log('  Able: pfmn=' + able6.pfmn + ' size=' + able6.size + ' age=' + able6.age.toFixed(2) + ' (should be halved)');
console.log('  Repositioned this month:', able6.repositionedThisMonth);

// Test month 12 (Dec 2029 / end of first year)
var s12 = computeStateAtMonth(12);
var able12 = s12.products.find(function(p) { return p.name === 'Able'; });
console.log('\nMonth 12:', s12.dateLabel);
console.log('  Able: pfmn=' + able12.pfmn + ' size=' + able12.size + ' age=' + able12.age.toFixed(2));
console.log('  Trad ideal:', JSON.stringify(s12.segments.traditional.idealSpot));

// Test month 20 (Aug 2030, second revision applied)
var s20 = computeStateAtMonth(20);
var able20 = s20.products.find(function(p) { return p.name === 'Able'; });
console.log('\nMonth 20:', s20.dateLabel);
console.log('  Able: pfmn=' + able20.pfmn + ' size=' + able20.size + ' age=' + able20.age.toFixed(2) + ' (should be halved again)');
console.log('  Repositioned this month:', able20.repositionedThisMonth);

// Test month 72 (Dec 2034, end of simulation for round 2)
var s72 = computeStateAtMonth(72);
var able72 = s72.products.find(function(p) { return p.name === 'Able'; });
console.log('\nMonth 72:', s72.dateLabel);
console.log('  Able: pfmn=' + able72.pfmn + ' size=' + able72.size + ' age=' + able72.age.toFixed(2));
console.log('  Trad ideal:', JSON.stringify(s72.segments.traditional.idealSpot));
console.log('  CSS:', able72.css.total);

// Test price range drop
console.log('\nPrice range at month 0 vs 72:');
console.log('  Traditional: $19-29 at month 0 → $' + (19 - 0.5 * 6).toFixed(1) + '-' + (29 - 0.5 * 6).toFixed(1) + ' at month 72 (6 years)');