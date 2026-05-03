# Capsim Strategist — Product Requirements Document (PRD)

**Version:** 1.0 (v1 scope)
**Author:** Agilan R.
**Last updated:** 3 May 2026
**Status:** Ready for build

---

## 1. What is this?

Capsim Strategist is a web-based sandbox that lets Capsim players test their R&D strategy on an interactive perceptual map *before* committing decisions in the live simulation.

Players paste their Capsim Courier HTML into the tool, enter their planned product specs (with revision/release dates), and watch the year unfold month-by-month — segment drift, product ageing, customer survey scores, and demand share — all visualised in real time. They can play, pause, and scrub through the 12 months to see how their product fares against competitors before locking decisions in.

In short: it removes the blindness from R&D decision-making in Capsim.

---

## 2. Who is it for?

The primary audience is a known small group: an MBA study group at IIM Bangalore.

Because the audience is known and Capsim-literate, the tool can:

- Skip onboarding, tutorials, and basic explanations
- Assume understanding of segments, MTBF, drift, and the customer survey score
- Prioritise speed, density, and power over hand-holding
- Be shipped imperfectly and iterated based on direct feedback

This narrow scope is deliberate. We are building for a known audience first; we will expand later.

---

## 3. The problem we are solving

Capsim is a high-stakes business simulation. Each round, R&D positioning, repositioning timing, and pricing decisions can wreck or save a team's score. But the official Capsim interface is unforgiving — once decisions are committed, players cannot easily see what would have happened if they had chosen differently.

Players are flying blind. They make strategic R&D choices without being able to visualise consequences month-by-month or stress-test their plan against competitors.

Capsim Strategist removes this blindness specifically for the R&D module — letting players see how their product will be positioned through the year, how it will fare against competitors, and where they should position to maximise sales (and therefore profit).

Financials, marketing, capacity, and automation modules are out of scope for v1.

---

## 4. Layout — five top tabs

The tool is organised as a single-page web application with five top horizontal tabs (browser-style). The user moves left-to-right naturally: paste → plan → review competitors → simulate → learn.

| Tab | Purpose |
|---|---|
| **1. Setup** | Paste Courier HTML, confirm round, see extraction summary |
| **2. Your Products** | Enter planned specs and revision dates for the user's 5 products |
| **3. Competitors** | View and edit extracted competitor product data |
| **4. Simulator** | Perceptual map + time scrubber + CSS/demand panel — the main visual experience |
| **5. Insights** | Auto-suggested ideal positioning per segment + (stretch) CSS history chart |

---

## 5. Features — detailed

### 5.1 Setup tab

- **Courier paste box.** A large, prominent textarea labelled clearly ("Paste your Capsim Courier HTML here"). The user opens the Courier in their Capsim browser tab, selects all (Ctrl+A), copies (Ctrl+C), and pastes (Ctrl+V) into this box.
- **Parse button.** When clicked, the tool extracts data from the pasted HTML.
- **Round selector.** A dropdown or input field where the user confirms or selects the current round (0–8). Pre-filled if extractable from the Courier.
- **Extraction summary.** After parsing, show a clear summary: "Extracted 5 segments, 30 products across 6 companies, awareness/accessibility data for all segments." Include warnings if any field could not be parsed.
- **Manual fallback.** If extraction fails for any field, allow manual entry on the relevant tabs.

### 5.2 Your Products tab

- A list/grid of the user's 5 products (or however many they have).
- For each product, editable fields:
  - Current Performance (pre-filled from Courier)
  - Current Size (pre-filled)
  - Current MTBF (pre-filled)
  - **Planned new Performance** (for repositioning)
  - **Planned new Size** (for repositioning)
  - **Planned new MTBF** (for repositioning)
  - **Planned price for the year**
  - **Revision date** (date picker, or "no revision this year")
- A clear visual indicator of which products are being repositioned this round.
- Quick switch between products (tab/list/cards).

### 5.3 Competitors tab

- A table view of all competitor products extracted from the Courier.
- Columns: Company, Product Name, Segment, Performance, Size, MTBF, Price, Age, Awareness, Accessibility, Revision Date.
- Cells are editable — so the user can correct any parsing errors.
- Read-only by default; click a cell to edit.

### 5.4 Simulator tab — the main experience

This is the heart of the application. The screen contains three coordinated regions:

#### 5.4.1 Perceptual map (top, prominent)

- 2D map with X-axis = Performance (0–20) and Y-axis = Size (0–20).
- All 5 segment circles drawn with rough-cut boundary (radius 4.0, dashed) and fine-cut boundary (radius 2.5, solid).
- Ideal spot for each segment plotted as a labelled marker (the offset from segment centre per the Industry Report).
- Every product in the market plotted as a labelled dot:
  - User's products: bright, prominent colour, larger size, optional glow
  - Competitors: muted/greyed
- Tooltips on hover/tap showing product details.

#### 5.4.2 Time scrubber (below the map)

- Play/pause button.
- Draggable timeline bar from January to December.
- Current month label.
- Speed: **1 second per month** when playing (12 seconds for a full year).
- When playing or scrubbing, every element updates simultaneously each month:
  - Segment circles drift down-and-right based on the segment-specific drift rates from the Industry Report
  - Ideal spots drift with their segments
  - User's products stay still until their revision date — then jump to new specs
  - Competitor products stay still unless their revision date is set
  - Product ages tick up by 1/12 per month, or reset to half on revision
  - CSS scores recalculate using current month positions, ages, and segment criteria
  - Demand share recalculates relative to all competitors

#### 5.4.3 CSS / demand panel (right side or below scrubber)

- Focused on the user's currently selected product.
- Shows for the current month:
  - Total CSS (0–100)
  - Breakdown by criterion (Positioning, Age, Price, MTBF) with the segment's importance weights
  - Distance from ideal spot
  - Demand share (% of segment demand) calculated as: this product's CSS ÷ sum of all CSS in the segment
- Updates live as months tick.

### 5.5 Insights tab

- For each segment, show the **ideal performance and size** the user should be aiming for, given drift trends through the round.
- A short text recommendation per product: *"Your Traditional product (Able) is at (5.0, 15.0). The ideal spot in 6 months will be (5.7, 14.3). Consider repositioning to (6.2, 13.8) to stay ahead of drift."*
- **Stretch goal:** CSS history chart — a line graph showing the user's CSS for each of their products over the 12 months. Cut if time runs short.

---

## 6. Visual style

Playful, colourful, friendly, slightly fun — a student-project vibe rather than a corporate tool.

- Bright, confident accent colours (not corporate blue)
- Distinct colours per segment (e.g. Traditional = warm yellow, Low End = green, High End = pink, Performance = red, Size = purple)
- Clear typography — sans-serif, generous sizing
- Mobile-friendly layout — inputs must not truncate values, controls must be tappable
- Responsive across desktop, tablet, and phone

---

## 7. Out of scope (v1)

The following are explicitly **not** in v1. They are noted here so we do not feature-creep during the build.

- Financial module (cash flow, balance sheet, income statement, capacity, automation, debt)
- Marketing module (promotion budget, sales budget impacts on awareness/accessibility — we read these as static numbers from the Courier but do not let the user edit them)
- HR module
- TQM/Sustainability module
- Plug-ins (Ethics, etc.)
- PDF parsing
- Auto-modelling of competitor repositioning (competitors stay where they are unless the user manually sets a revision date)
- User authentication, save-and-resume, multi-user collaboration
- Cloud storage of user data — everything stays in the browser session

---

## 8. Success criteria

We will know v1 is successful if:

1. The user can paste a Courier and see the perceptual map populated within 10 seconds
2. The play/pause/scrub experience genuinely shows segment drift through the year
3. CSS scores and demand shares calculate in line with Capsim's actual numbers (within reasonable tolerance — exact match is not required since Capsim has unpublished tweaks)
4. The user's MBA study group uses it during the next round before committing decisions
5. The tool runs cleanly on both desktop and mobile

---

## 9. Tech stack

- **Frontend:** HTML, CSS, JavaScript — no framework required for v1 (keep it simple)
- **Visualisation:** raw SVG for the perceptual map (full control, no dependency)
- **Hosting:** Netlify or GitHub Pages (free, custom subdomain)
- **No backend.** Everything runs in the browser. No data leaves the user's machine.

---

## 10. Reference data — to be embedded in code

The following data is taken from the Industry Conditions Report and must be hard-coded into the tool. These values drive the simulation engine.

### 10.1 Segment drift rates (per round, units per year)

| Segment | Pfmn | Size |
|---|---|---|
| Traditional | +0.7 | -0.7 |
| Low End | +0.5 | -0.5 |
| High End | +0.9 | -0.9 |
| Performance | +1.0 | -0.7 |
| Size | +0.7 | -1.0 |

### 10.2 Segment centres at the end of each round

| Round | Trad Pfmn | Trad Size | Low Pfmn | Low Size | High Pfmn | High Size | Perf Pfmn | Perf Size | Size Pfmn | Size Size |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 5.0 | 15.0 | 2.5 | 17.5 | 7.5 | 12.5 | 8.0 | 17.0 | 3.0 | 12.0 |
| 1 | 5.7 | 14.3 | 3.0 | 17.0 | 8.4 | 11.6 | 9.0 | 16.3 | 3.7 | 11.0 |
| 2 | 6.4 | 13.6 | 3.5 | 16.5 | 9.3 | 10.7 | 10.0 | 15.6 | 4.4 | 10.0 |
| 3 | 7.1 | 12.9 | 4.0 | 16.0 | 10.2 | 9.8 | 11.0 | 14.9 | 5.1 | 9.0 |
| 4 | 7.8 | 12.2 | 4.5 | 15.5 | 11.1 | 8.9 | 12.0 | 14.2 | 5.8 | 8.0 |
| 5 | 8.5 | 11.5 | 5.0 | 15.0 | 12.0 | 8.0 | 13.0 | 13.5 | 6.5 | 7.0 |
| 6 | 9.2 | 10.8 | 5.5 | 14.5 | 12.9 | 7.1 | 14.0 | 12.8 | 7.2 | 6.0 |
| 7 | 9.9 | 10.1 | 6.0 | 14.0 | 13.8 | 6.2 | 15.0 | 12.1 | 7.9 | 5.0 |
| 8 | 10.6 | 9.4 | 6.5 | 13.5 | 14.7 | 5.3 | 16.0 | 11.4 | 8.6 | 4.0 |

Each month, each segment moves 1/12th of the way from its starting position to its ending position.

### 10.3 Ideal spot offsets from segment centre

| Segment | Pfmn offset | Size offset |
|---|---|---|
| Traditional | 0.0 | 0.0 |
| Low End | -0.8 | +0.8 |
| High End | +1.4 | -1.4 |
| Performance | +1.4 | -1.0 |
| Size | +1.0 | -1.4 |

### 10.4 Buying criteria (Round 0) per segment

(Importance weights, ideal values. Price ranges drop $0.50/year. Age and MTBF criteria stay constant year-on-year.)

**Traditional:** Age 47% (ideal 2.0 yrs), Price 23% ($20–30), Position 21%, MTBF 9% (14k–19k)
**Low End:** Price 53% ($15–25), Age 24% (ideal 7.0 yrs), Position 16%, MTBF 7% (12k–17k)
**High End:** Position 43%, Age 29% (ideal 0.0 yrs), MTBF 19% (20k–25k), Price 9% ($30–40)
**Performance:** MTBF 43% (22k–27k), Position 29%, Price 19% ($25–35), Age 9% (ideal 1.0 yr)
**Size:** Position 43%, Age 29% (ideal 1.5 yrs), MTBF 19% (16k–21k), Price 9% ($25–35)

### 10.5 Scoring formulas

- **Positioning score:** within fine cut (≤2.5 units from ideal spot) → high. Between 2.5 and 4.0 → drops from ~99% down to 1%. Beyond 4.0 → score = 0 for that criterion.
- **Price score:** within range → classic demand curve, score rises as price drops. ±$1 outside range = -20% per dollar. ±$5 outside = score = 0.
- **MTBF score:** within range → score rises as MTBF rises, plateau at top. Below range → drops 20% per 1,000 hours, score = 0 at 5,000 hrs below.
- **Age score:** segment-specific curve (peaks at the segment's ideal age). No rough cut.
- **Total CSS:** weighted sum of the four criterion scores, scaled to 0–100.
- **Demand share:** product's CSS ÷ sum of all CSS in that segment.

---

## 11. Build approach

The build will be vibe-coded using Cline + Claude in VS Code. The PRD itself is the master prompt.

We will build in this order, ensuring each layer works before moving to the next:

1. **Skeleton** — five tabs with placeholder content, navigation working
2. **Setup tab** — paste box, parser, extraction summary
3. **Your Products + Competitors tabs** — data entry forms
4. **Simulator tab — static state** — map renders correctly, products plotted, no animation yet
5. **Simulator tab — animation** — month-by-month drift, scrubber, CSS panel
6. **Insights tab** — recommendations
7. **Polish** — colours, mobile responsiveness, edge cases
8. **Stretch** — CSS history chart
9. **Deploy** — push to GitHub, host on Netlify

---

*End of PRD v1.0*
