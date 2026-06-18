# Crystal Spell Caverns — Engagement, Retention & Pedagogy Research

Research brief (2026-06-18) on modern, successful kids' literacy/spelling apps and the
learning science behind them, used to drive the improvements in HANDOFF §15. Audience:
ages 5–13, primary persona a bright 9-yo weak speller. Constraints honored throughout:
vanilla HTML/CSS/JS, **no build step, no backend (localStorage only)**, offline PWA, no new
art assets where possible. Status tags: **[DONE]** shipped this session · **[LATER]** deferred.

Apps surveyed: Duolingo / Duolingo ABC, Khan Academy Kids, Teach Your Monster to Read,
Reading Eggs, Prodigy, Squeebles, Endless Alphabet, Osmo.

---

## The one finding that shaped the design

**Seeing plausible misspellings imprints them** (Brown 1988; Roediger & Marsh 2005, the
"negative suggestion effect" — multiple-choice lures intrude more as options increase, even
with a net testing benefit; Jacoby & Hollingshead 1990). Our learner is a *weak* speller — the
group most at risk. Implications, all acted on:
- Keep wrong options on screen as briefly as possible and **end every card on the correct
  spelling**. **[DONE — anti-imprinting: rhythm fades the wrong tiles, spotlights the correct one.]**
- Make **production** (build-the-word from memory) the spine of *mastery*; recognition (MC) is the
  fast warm-up/assessment layer. Retrieval practice + the generation effect favor producing.
  **[DONE — "cracked crystals" repairs missed words in production form.]**
- Transfer to real, unaided spelling is achievable when the active ingredients are present:
  **production + corrective feedback + spacing + pattern discrimination** (Prosodiya RCT showed
  gains on trained AND untrained words). The game wrapper isn't the active ingredient.

High-utility techniques (Dunlosky 2013): **distributed practice** and **practice testing** —
both shipped via the cracked-crystals review + the existing session mixing. Interleaving
confusable patterns is a *desirable difficulty* (Klimovich & Richter 2025) — already in `session.js`.

---

## Prioritized feature list (impact × low cost), with status

**Tier 1 — highest value, low cost**
1. **Spaced production review of misses** (Dunlosky; Duolingo Mistakes Review). **[DONE]** —
   "cracked crystals": missed words resurface as build-the-word until re-mastered.
2. **Stop misspelling-imprinting in rhythm** (Roediger & Marsh). **[DONE]** — fade wrong tiles,
   spotlight the correct spelling.
3. **Guilt-free streak + tiny daily goal** (Duolingo). **[DONE]** — `engine/streak.js`; free
   lantern freezes, lapse resets to 1, momentum framing, no guilt notifications, no monetization.
4. **3 daily quests** (Duolingo Daily Quests). **[DONE]** — `engine/quests.js`, date-seeded,
   bonus-not-gate; completing all opens a geode.
5. **Parent transparency** (Squeebles "what's hard"; Prodigy monthly cadence). **[DONE — partial]** —
   the Progress screen is the SAME shared kid+parent view (§4, no separate console); now shows the
   actual tricky words + accuracy + streak. Export/import already moves data off-device.

**Tier 2 — strong, moderate cost**
6. **Crystal Catalog collection** (Squeebles/Prodigy; endowed-progress, Nunes & Drèze). **[LATER]**
7. **Cavern-map progress PATH** with "you are here" + endowed progress (Duolingo path;
   goal-gradient, Hull/Kivetz). **[DONE]** — compact depth strip on Progress (current level
   glows, next level is the visible goal, "master N more to reach Depth X").
8. **Variable geode reward** (Duolingo chests; variable-ratio reinforcement). **[DONE]** — always
   positive, free, never real-money / FOMO-timer.
9. **Mascot guide + name/colour personalization on first run** (Khan's Kodi; SDT autonomy,
   Kim 2015). **[LATER]** — note: changes the boot flow, update the smoke test too.
10. **Personal records ("beat your best")** — safe single-player competence. **[DONE]** — best
    combo + best haul on Progress.

**Tier 3 — polish / correctness**
11. **`prefers-reduced-motion` + redundant (visual+audio) + mutable audio.** **[DONE]** —
    reduced-motion media query already zeroes animations; audio is settings-gated; feedback is redundant.
12. **`navigator.vibrate()` haptics.** **[DONE]** — paired with SFX; no-op on iPad Safari (no
    Vibration API), adds feel on Android/Chromebook.
13. **Re-tune idle thresholds for a thinking weak speller; nudge before any blocking overlay.**
    **[DONE]** — see HANDOFF §15 I4.
14. **Light narrative spine + a "Geode Boss" milestone wave.** **[LATER]**
15. **Process/effort praise** ("you worked it out", growth mindset; Khan model). **[DONE]** —
    effort phrases mixed into the `praise.js` good/great tier pools (spoken aloud).

---

## Cross-cutting guardrails (applied)
- Rewards are **informational, not controlling**; celebrate effort/process (over-justification
  effect — Deci/Koestner/Ryan 1999). **No real-money pressure, no FOMO timers, no guilt, no
  peer-shaming** (the documented Prodigy/Duolingo dark patterns to avoid). Streaks/goals are
  optional and non-punitive. The app's existing "unlock-not-force" philosophy is extended everywhere.
- Bite-size sessions with clean stopping points; AAP (2026) warns against designs meant to keep
  kids scrolling — autonomy ("one more?") over forced continuation.

## Key primary sources
Duolingo blog: [home path redesign](https://blog.duolingo.com/new-duolingo-home-screen-design/),
[achievements](https://blog.duolingo.com/achievement-badges/),
[Friends Quests](https://blog.duolingo.com/friends-quests/) ·
[Dunlosky 2013 (high-utility techniques)](https://www.aft.org/ae/fall2013/dunlosky) ·
[Roediger & Marsh 2005 (negative suggestion effect)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4094137/) ·
[Klimovich & Richter 2025 (interleaving spelling)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12511507/) ·
[Prosodiya RCT (transfer)](https://www.sciencedirect.com/science/article/abs/pii/S0959475223000403) ·
[Fairplay/Prodigy (dark patterns)](https://fairplayforkids.org/pf/prodigy/) ·
[NN/g kids cognition](https://www.nngroup.com/articles/kids-cognition/) ·
AAP 2026 screen-time update · Nunes & Drèze (endowed progress) · Deci/Ryan (SDT).
