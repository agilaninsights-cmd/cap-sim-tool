
# Capsim Strategist — Project Conventions

## Source of truth

`PRD.md` in the project root is the master specification. Always read it before starting a layer or making structural decisions. If you find a contradiction between the PRD and a prompt, flag it and ask before proceeding.

## Architecture rules

- **Vanilla HTML/CSS/JS only.** No frameworks (React, Vue, Svelte). No build tools (webpack, vite). The project must run by opening `index.html` in a browser, no compile step.

- **Keep `script.js` lean.** It's the orchestration layer. Heavy logic lives in dedicated files: `parser.js`, `simulation.js`, `simulator.js`, `products.js`, `competitors.js`, `insights.js`, `helpers.js`.

- **Pure functions in `simulation.js`.** Anything that computes state from time/data goes here. No DOM access. The render layer reads its output and updates the SVG.

- **Single global `appState` object** holds all parsed data, planned changes, and session state. Defined in `script.js`.

- **No localStorage.** Browser session only. Sensitive data (Gemini API key) must never be persisted, logged, or sent anywhere except the intended API.

## Data conventions

- Andrews is always the user's company. Never add a company picker.
- Segment keys: `traditional`, `lowEnd`, `highEnd`, `performance`, `size` (camelCase).
- Dates are stored as ISO format internally where possible. Display format follows Capsim convention ("April 30, 2029").
- Capsim coordinate convention: Y axis is flipped — Size 20 at top, Size 0 at bottom.

## UI conventions

- Clean, professional, white-dominant aesthetic.
- One restrained accent colour for active states.
- No emojis in headings or tab labels.
- Mobile-friendly: no value truncation, tappable targets.
- Empty states across all tabs: "Parse a Courier in the Setup tab first."

## Git workflow

- Commit at the end of each layer with the format: `Layer N: <one-line description>`.
- Always push after committing.
- The user reviews diffs before approving — don't auto-apply.