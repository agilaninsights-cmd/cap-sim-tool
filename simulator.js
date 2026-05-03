// ============================================
// Capsim Strategist — Simulator Renderer
// ============================================
'use strict';

var MAP_SIZE = 600, MAP_PAD = 40, MAP_AREA = 520;
var SVG_NS = 'http://www.w3.org/2000/svg';
var SEGMENT_OFFSETS = { traditional:{pfmn:0,size:0}, lowEnd:{pfmn:-0.8,size:0.8}, highEnd:{pfmn:1.4,size:-1.4}, performance:{pfmn:1.4,size:-1.0}, size:{pfmn:1.0,size:-1.4} };
var SEGMENT_COLORS = { traditional:{stroke:'#d97706',greenTint:'#6ee7b7',midTint:'#fde68a',redTint:'#f87171'}, lowEnd:{stroke:'#059669',greenTint:'#6ee7b7',midTint:'#bef264',redTint:'#f87171'}, highEnd:{stroke:'#db2777',greenTint:'#a78bfa',midTint:'#f9a8d4',redTint:'#f87171'}, performance:{stroke:'#dc2626',greenTint:'#6ee7b7',midTint:'#fdba74',redTint:'#ef4444'}, size:{stroke:'#7c3aed',greenTint:'#a78bfa',midTint:'#c4b5fd',redTint:'#f87171'} };
var playState = { playing:false, currentMonth:0, intervalId:null };
var mapEls = { seg:{}, ideal:{} };

function toSvgX(p){return MAP_PAD+(p/20)*MAP_AREA;}
function toSvgY(s){return MAP_PAD+((20-s)/20)*MAP_AREA;}
function unitsToPixels(u){return(u/20)*MAP_AREA;}
function svgEl(tag,attrs,txt){var e=document.createElementNS(SVG_NS,tag);if(attrs)Object.keys(attrs).forEach(function(k){e.setAttribute(k,attrs[k]);});if(txt!==undefined)e.textContent=txt;return e;}

function renderSimulatorTab(){
    var empty=document.getElementById('simulator-empty'),content=document.getElementById('simulator-content');
    if(!appState.products||!appState.products.length){empty.classList.remove('hidden');content.classList.add('hidden');return;}
    empty.classList.add('hidden');content.classList.remove('hidden');

    // Calculate total simulation months (capped by Round 8)
    var totalMonths = (8 - appState.round) * 12;
    playState.currentMonth=0;playState.playing=false;
    if(playState.intervalId){clearInterval(playState.intervalId);playState.intervalId=null;}

    // Edge case: Round 8 parsed — no future rounds to simulate
    if(totalMonths<=0){
        document.getElementById('month-scrubber').disabled=true;
        document.getElementById('play-btn').disabled=true;
        document.getElementById('month-label').textContent='This is the final round \u2014 no future rounds to simulate.';
        document.getElementById('year-markers').innerHTML='';
        buildMap();populateFocusDropdown();initHideCompetitorsToggle();
        return;
    }

    // Set scrubber max dynamically
    document.getElementById('month-scrubber').max=totalMonths;
    document.getElementById('month-scrubber').disabled=false;
    document.getElementById('play-btn').disabled=false;

    buildMap();populateFocusDropdown();initTimeControls();initHideCompetitorsToggle();
    buildYearMarkers(totalMonths);
    scrubToMonth(0);
}

function buildMap(){
    var svg=document.getElementById('perceptual-map');svg.innerHTML='';svg.classList.remove('animating');
    mapEls={seg:{},ideal:{}};
    svg.appendChild(buildDefs());svg.appendChild(buildGrid());
    var sL=svgEl('g',{'class':'map-segments'});
    Object.keys(SEGMENT_OFFSETS).forEach(function(k){
        var g=svgEl('g',{'class':'segment-group','data-seg':k}),c=SEGMENT_COLORS[k],rR=unitsToPixels(4),fR=unitsToPixels(2.5);
        g.appendChild(svgEl('circle',{r:rR,fill:'url(#grad-'+k+')',opacity:'0.45'}));
        g.appendChild(svgEl('circle',{r:fR,fill:'none',stroke:c.stroke,'stroke-width':'1.5'}));
        g.appendChild(svgEl('circle',{r:rR,fill:'none',stroke:c.stroke,'stroke-width':'1','stroke-dasharray':'6 3'}));
        g.appendChild(svgEl('text',{'text-anchor':'middle','font-size':'10',fill:c.stroke,'font-weight':'600',opacity:'0.8',dy:'3'},getSegmentDisplayName(k)));
        sL.appendChild(g);mapEls.seg[k]=g;
    });
    svg.appendChild(sL);svg.appendChild(svgEl('g',{'class':'map-products'}));
    var iL=svgEl('g',{'class':'map-ideals'});
    Object.keys(SEGMENT_OFFSETS).forEach(function(k){
        var g=svgEl('g',{'class':'ideal-group','data-seg':k}),s=6;
        g.appendChild(svgEl('polygon',{points:'0,-'+s+' -'+s+','+s+' '+s+','+s,fill:'#dc2626',stroke:'#ffffff','stroke-width':'1','class':'ideal-marker'}));
        iL.appendChild(g);mapEls.ideal[k]=g;
    });
    svg.appendChild(iL);
}

function buildDefs(){
    var d=svgEl('defs');
    Object.keys(SEGMENT_COLORS).forEach(function(k){var c=SEGMENT_COLORS[k],g=svgEl('radialGradient',{id:'grad-'+k,cx:'50%',cy:'50%',r:'50%'});
        g.appendChild(svgEl('stop',{offset:'0%','stop-color':c.greenTint,'stop-opacity':'1'}));
        g.appendChild(svgEl('stop',{offset:'62.5%','stop-color':c.greenTint,'stop-opacity':'0.9'}));
        g.appendChild(svgEl('stop',{offset:'78%','stop-color':c.midTint,'stop-opacity':'0.7'}));
        g.appendChild(svgEl('stop',{offset:'100%','stop-color':c.redTint,'stop-opacity':'0.6'}));
        d.appendChild(g);});return d;
}

function buildGrid(){
    var g=svgEl('g',{'class':'map-grid'});
    g.appendChild(svgEl('rect',{x:MAP_PAD,y:MAP_PAD,width:MAP_AREA,height:MAP_AREA,fill:'#fafafa',stroke:'#e5e7eb','stroke-width':'1'}));
    for(var i=0;i<=20;i+=5){var x=toSvgX(i),yl=toSvgY(i);
        if(i>0&&i<20){g.appendChild(svgEl('line',{x1:x,y1:MAP_PAD,x2:x,y2:MAP_PAD+MAP_AREA,stroke:'#e5e7eb','stroke-width':'0.5'}));g.appendChild(svgEl('line',{x1:MAP_PAD,y1:yl,x2:MAP_PAD+MAP_AREA,y2:yl,stroke:'#e5e7eb','stroke-width':'0.5'}));}
        g.appendChild(svgEl('text',{x:x,y:MAP_PAD+MAP_AREA+16,'text-anchor':'middle','font-size':'9',fill:'#6b7280'},i+''));
        g.appendChild(svgEl('text',{x:MAP_PAD-8,y:toSvgY(i)+3,'text-anchor':'end','font-size':'9',fill:'#6b7280'},i+''));
    }
    g.appendChild(svgEl('text',{x:MAP_PAD+MAP_AREA/2,y:MAP_SIZE-4,'text-anchor':'middle','font-size':'11',fill:'#374151','font-weight':'600'},'Performance \u2192'));
    g.appendChild(svgEl('text',{x:12,y:MAP_PAD+MAP_AREA/2,'text-anchor':'middle','font-size':'11',fill:'#374151','font-weight':'600',transform:'rotate(-90,12,'+(MAP_PAD+MAP_AREA/2)+')'},'\u2190 Size'));
    return g;
}

function updateMapFromSnapshot(snap,anim){
    var svg=document.getElementById('perceptual-map');
    if(anim)svg.classList.add('animating');else svg.classList.remove('animating');
    Object.keys(snap.segments).forEach(function(k){var s=snap.segments[k];if(mapEls.seg[k])mapEls.seg[k].setAttribute('transform','translate('+toSvgX(s.centre.pfmn)+','+toSvgY(s.centre.size)+')');if(mapEls.ideal[k])mapEls.ideal[k].setAttribute('transform','translate('+toSvgX(s.idealSpot.pfmn)+','+toSvgY(s.idealSpot.size)+')');});
    rebuildDots(snap.products);
}

function rebuildDots(products){
    var layer=document.getElementById('perceptual-map').querySelector('.map-products');layer.innerHTML='';
    var hide=document.getElementById('hide-competitors-toggle');var hc=hide&&hide.checked;
    products.forEach(function(p){if(p.company===appState.myCompany||!p.released)return;if(hc)return;
        var x=toSvgX(p.pfmn),y=toSvgY(p.size),g=svgEl('g',{'class':'product-group competitor-dot',transform:'translate('+x+','+y+')'});
        g.appendChild(svgEl('circle',{r:'5',fill:'#9ca3af',stroke:'#ffffff','stroke-width':'1'}));
        if(p.hasFutureRevision)g.appendChild(svgEl('circle',{r:'9',fill:'none',stroke:'#9ca3af','stroke-width':'1','stroke-dasharray':'3 2'}));
        g.appendChild(svgEl('title',{},p.name+' ('+p.company+')\n'+p.segment+' | Pfmn:'+p.pfmn.toFixed(1)+' Size:'+p.size.toFixed(1)));
        layer.appendChild(g);
    });
    products.forEach(function(p){if(p.company!==appState.myCompany||!p.released)return;
        var x=toSvgX(p.pfmn),y=toSvgY(p.size),cls='product-group andrews-dot';
        if(p.repositionedThisMonth)cls+=' just-repositioned';
        var g=svgEl('g',{'class':cls,transform:'translate('+x+','+y+')'});
        g.appendChild(svgEl('circle',{r:'8',fill:'#2563eb',stroke:'#ffffff','stroke-width':'2'}));
        g.appendChild(svgEl('text',{y:'-12','text-anchor':'middle','font-size':'9',fill:'#1e40af','font-weight':'600'},p.name));
        g.appendChild(svgEl('title',{},p.name+'\nCSS:'+((p.css&&p.css.total)||0)+' | Share:'+(p.demandShare*100).toFixed(0)+'%\nPfmn:'+p.pfmn.toFixed(1)+' Size:'+p.size.toFixed(1)+' Age:'+p.age.toFixed(1)));
        layer.appendChild(g);
    });
}

// --- Time Controls ---
function initTimeControls(){
    var playBtn=document.getElementById('play-btn');
    var scrubber=document.getElementById('month-scrubber');
    var nb=playBtn.cloneNode(true);playBtn.parentNode.replaceChild(nb,playBtn);
    nb.addEventListener('click',function(){if(playState.playing)stopPlay();else startPlay();});
    var ns=scrubber.cloneNode(true);scrubber.parentNode.replaceChild(ns,scrubber);
    ns.addEventListener('input',function(){scrubToMonth(parseInt(ns.value));});
}

function startPlay(){
    // totalMonths is the max value of the scrubber (set dynamically at render)
    var totalMonths=parseInt(document.getElementById('month-scrubber').max)||12;
    if(playState.currentMonth>=totalMonths)playState.currentMonth=0;
    playState.playing=true;
    document.getElementById('play-btn').innerHTML='&#9646;&#9646; Pause';
    playState.intervalId=setInterval(function(){
        playState.currentMonth++;
        var snap=computeStateAtMonth(playState.currentMonth);
        updateMapFromSnapshot(snap,true);updateCssPanel(snap);updateHeader(snap);
        document.getElementById('month-scrubber').value=playState.currentMonth;
        highlightActiveMarker(playState.currentMonth);
        if(playState.currentMonth>=totalMonths)stopPlay();
    },1000);
}

function stopPlay(){
    playState.playing=false;
    if(playState.intervalId){clearInterval(playState.intervalId);playState.intervalId=null;}
    document.getElementById('play-btn').innerHTML='&#9654; Play';
    document.getElementById('perceptual-map').classList.remove('animating');
}

function scrubToMonth(M){
    if(playState.playing)stopPlay();
    playState.currentMonth=M;
    var snap=computeStateAtMonth(M);
    updateMapFromSnapshot(snap,false);updateCssPanel(snap);updateHeader(snap);
    document.getElementById('month-scrubber').value=M;
    highlightActiveMarker(M);
}

// --- Header & Labels ---
function updateHeader(snap){
    // snap.dateLabel already includes round number + date (e.g. "Round 4 — March 31, 2030")
    document.getElementById('sim-subtitle').textContent=snap.dateLabel;
    document.getElementById('month-label').textContent=snap.dateLabel;
}

// --- CSS Panel ---
function populateFocusDropdown(){
    var sel=document.getElementById('focus-product');sel.innerHTML='';
    appState.products.filter(function(p){return p.company===appState.myCompany&&p.released;}).forEach(function(p){
        var opt=document.createElement('option');opt.value=p.name;opt.textContent=p.name+' ('+( p.segment||'?')+')';sel.appendChild(opt);
    });
    var ns=sel.cloneNode(true);sel.parentNode.replaceChild(ns,sel);
    ns.addEventListener('change',function(){scrubToMonth(playState.currentMonth);});
}

function updateCssPanel(snap){
    var sel=document.getElementById('focus-product');
    var name=sel?sel.value:'';
    var p=snap.products.find(function(x){return x.name===name;});
    if(!p||!p.css){document.getElementById('css-total').textContent='- / 100';document.getElementById('css-demand').textContent='-';document.getElementById('css-breakdown').innerHTML='';return;}
    document.getElementById('css-total').textContent=p.css.total.toFixed(1)+' / 100';
    document.getElementById('css-demand').textContent=(p.demandShare*100).toFixed(1)+'%';
    var seg=snap.segments[p.segmentKey];var criteria=seg?seg.buyingCriteria:[];
    var html='';
    criteria.forEach(function(c){
        var score=0,weight=c.importance,raw=0;
        if(c.criterion==='Position'){score=p.css.position;raw=p.css.positionRaw;}
        else if(c.criterion==='Age'){score=p.css.age;raw=p.css.ageRaw;}
        else if(c.criterion==='Price'){score=p.css.price;raw=p.css.priceRaw;}
        else if(c.criterion==='Reliability'){score=p.css.mtbf;raw=p.css.mtbfRaw;}
        var pct=weight>0?(score/weight)*100:0;
        html+='<div class="css-bar-row"><span class="css-bar-label">'+c.criterion+' ('+weight+'%)</span>';
        html+='<div class="css-bar"><div class="css-bar-fill" style="width:'+Math.round(pct)+'%"></div></div>';
        html+='<span class="css-bar-score">'+score.toFixed(1)+' / '+weight+'</span></div>';
    });
    document.getElementById('css-breakdown').innerHTML=html;
}

// --- Hide Competitors Toggle ---
function initHideCompetitorsToggle(){
    var t=document.getElementById('hide-competitors-toggle');if(!t)return;
    var nt=t.cloneNode(true);t.parentNode.replaceChild(nt,t);
    nt.addEventListener('change',function(){scrubToMonth(playState.currentMonth);});
}

// --- Year Markers ---
// These are clickable labels below the scrubber showing which round/year each section represents.

function buildYearMarkers(totalMonths){
    var container=document.getElementById('year-markers');
    container.innerHTML='';
    if(totalMonths<=0)return;
    var numRounds=Math.ceil(totalMonths/12);
    var baseYear=getBaseYear();

    for(var i=0;i<numRounds;i++){
        var round=appState.round+1+i;
        if(round>8)break; // cap at Round 8
        var year=baseYear+i;
        var pct=(i*12/totalMonths)*100;
        var marker=document.createElement('span');
        marker.className='year-marker';
        marker.style.left=pct+'%';
        marker.textContent='R'+round;
        marker.title=year.toString();
        marker.setAttribute('data-month',i*12);
        marker.addEventListener('click',function(){scrubToMonth(parseInt(this.getAttribute('data-month')));});
        container.appendChild(marker);
    }
    highlightActiveMarker(0);
}

function highlightActiveMarker(M){
    // Highlights the marker for the round currently containing the scrubber position.
    var activeIdx=Math.floor(M/12);
    document.querySelectorAll('.year-marker').forEach(function(m,idx){
        m.classList.toggle('active',idx===activeIdx);
    });
}

// --- Helper (used by simulation.js) ---
function getIdealPosition(seg){
    if(!seg||!seg.buyingCriteria)return null;
    for(var i=0;i<seg.buyingCriteria.length;i++){if(seg.buyingCriteria[i].idealPosition)return seg.buyingCriteria[i].idealPosition;}
    return null;
}
