# Capsim Strategist

A web-based sandbox that lets Capsim players test their R&D strategy on an interactive perceptual map *before* committing decisions in the live simulation.

> TODO: add screenshots after deploy

## What it does

- **Parses your Capsim Courier** — paste the text and instantly extract all product data, segment criteria, and competitor positions
- **Plans R&D changes** — enter planned repositioning specs, prices, and revision dates for your products
- **Simulates the year** — watch segments drift month-by-month on an animated perceptual map with live CSS scoring
- **Scores your strategy** — see Customer Survey Scores, demand share, and criterion-by-criterion breakdowns update in real time
- **AI Strategy Coach** — optional Gemini-powered analysis that identifies threats, opportunities, and the single most important R&D decision

## How to use

1. **Setup** — Open your Capsim Courier in the browser, Ctrl+A → Ctrl+C, then paste into the Setup tab and click Parse
2. **Plan** — Go to Your Products tab, toggle "Reposition" on products you want to move, enter new specs and revision dates
3. **Simulate** — Click the Simulator tab, press Play, and watch your products vs. drifting segment ideals over 12 months
4. **Insights** — Check the Insights tab for health cards, ideal positioning analysis, and optional AI strategy recommendations

## Tech stack

- Vanilla HTML, CSS, JavaScript — no frameworks, no build step
- Raw SVG for the perceptual map (full control, no dependencies)
- Gemini API for optional AI analysis (user provides their own free key)
- Hosted on GitHub Pages / Netlify (zero backend, everything runs in the browser)

## Credits

Built by **Agilan R** and team, MBA at IIM Bangalore, May 2026.

## Disclaimer

Not affiliated with Capsim Management Simulations, Inc. This is an educational tool built for MBA study groups to better understand R&D positioning dynamics.

The AI Strategy Coach is informational only — Capsim's actual scoring includes proprietary adjustments not modelled here. Use insights as one input among many.

The CSS scoring formulas are approximations based on publicly available Capsim documentation. Exact match with Capsim's internal calculations is not guaranteed.