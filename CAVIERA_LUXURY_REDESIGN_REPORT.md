# CAVIERA JEWELS — Luxury Redesign Report

Branch: `caviera-luxury-redesign` · Working theme: **CAVIERA — Luxury Redesign — Working** (ID `187461075235`, unpublished) · Store: `v1b036-hc.myshopify.com`

**Read this first:** this report documents what was actually built and verified, not an idealized version of the full master-instruction scope. The master instruction requested a complete, autonomous rebuild across ~60 areas (homepage, Edition/Archive architecture, product/Creation template, collection, cart, search, account, every House content page, full responsive/accessibility re-audit). This session completed the homepage journey and the global systems beneath it — header, full-screen menu, loader, page transition, and the first eight homepage chapters — to a standard I could actually verify with `shopify theme check` and read-only inspection. It deliberately did **not** attempt to rebuild commerce-critical templates (product, cart, collection, account) unsupervised, because doing that safely requires individually testing each change against real Shopify checkout/cart/variant logic — attempting all of it in one unsupervised pass would contradict the brief's own top priority: *"if a decision could damage production, do not do it"* / *"reliability > spectacle."* Section P lists exactly what's deferred.

---

## A. Build summary

Across this session and the sessions before it on this branch, the following is now real and pushed to the working theme:

- **Global systems** (prior commits, re-verified this session): ceremonial loader (Obsidian field → Oryx → House Seal → Master Signature → curtain-sweep reveal), CAVIERA Curtain page-transition, restrained MENU/wordmark/SEARCH/BAG header, Cinnabar full-screen menu with Edition-based navigation and a reserved contextual-image field.
- **Homepage journey** (this session + prior): Hero (near-full-viewport cinematic opening) → House Statement (quiet, single-idea) → Edition I teaser (Edition-based, no catalogue) → Object Study → Craft & Material → **Maker's Mark / Provenance (new)** → Packaging Ritual → **Oryx editorial moment (new)** → Journal → **Private Notice (recopied)** → Footer (fixed to remove a real catalogue-fallback bug).
- **A real bug found and fixed**: the footer's unconfigured "Jewellery" column would have rendered Rings/Earrings/Necklaces/Bracelets/Shop All the moment those collections existed — directly contradicting the Edition-based architecture. Replaced with a safe, always-present "Edition I — Upcoming" link.
- **Edition I anchor wired**: `id="edition-i"` on the teaser section, and the approved menu's EDITION I item now links to `/#edition-i` (the one explicitly-instructed change to the otherwise-locked menu).

## B. Design system

| Token | Value | Role |
|---|---|---|
| `--caviera-cinnabar` | `#8F261F` | House signature — never replaced by generic black/beige/gold |
| `--caviera-bone` | `#F3EEE5` | Editorial relief, "silence" rooms |
| `--caviera-obsidian` | `#111012` | Depth, theatre |
| `--caviera-rhodium` | `#C4C1BB` | Fine dividers only, never a dominant fill |

Motion tokens: `--motion-fast` (180–300ms, micro), `--motion-base` (400–700ms, normal reveal), `--motion-slow`/`--motion-cinematic` (650–1100ms depending on setting, room/page transitions). All four collapse toward ~1ms under `prefers-reduced-motion`. No animation library — CSS transforms/opacity + one shared `IntersectionObserver` + `:has()` for the menu's image reveal.

## C. Inspiration translated into CAVIERA

| Reference | Principle taken | Where it landed |
|---|---|---|
| **Amber** | Cinematic, visual-first opening | Hero (near-full-viewport, image-dominant, restrained settle animation) |
| **Rumaya** | Atmospheric silence between moments | House Statement (single idea, Warm Bone, no cards) |
| **Toasted Buns** | Image choreography, *not* its playful energy | Edition I teaser's still, offset two-image composition (slower, fewer images, precise — never scroll-jacked) |
| **Drkst** | Typography as architecture | MENU trigger, full-screen menu's large primary navigation, Edition I heading |
| **Aerra** | Restrained index/archive logic, minimal metadata | Full-screen menu's numbered primary nav; Edition teaser's quiet "01 / Upcoming" metadata |
| **Nolan Barret** | Object-led storytelling | Object Study section's structure (reserved for future Creation-page work — not yet built, see P) |
| **Bureau Nine** | Spatial depth, project-as-edition thinking | Edition I teaser's offset-overlap composition; Maker's Mark section's identity/edition framing |

## D. Homepage architecture (current `templates/index.json` order)

```
hero → statement → edition-teaser → [category-reveal: disabled]
→ signature-products (self-hides, no products configured)
→ object-focus → craftsmanship → makers-mark (new) → packaging-ritual
→ featured-collection (self-hides, no collection configured)
→ bespoke-banner → services → oryx-moment (new)
→ journal → newsletter ("Private Notice") → [signature: disabled]
```
`category-reveal` and `signature` are `"disabled": true` — fully intact, not deleted, re-enable any time from the Theme Editor.

## E. Edition architecture

**Not built this session.** The homepage now correctly *frames* the Edition model (teaser, anchor, footer link), but the reusable Edition/Archive page templates called for in the master instruction (`caviera-edition-hero`, `caviera-edition-statement`, `caviera-edition-creations`, `caviera-edition-provenance`, `caviera-edition-notice`, a `templates/page.edition.json`, an Archive index) do not exist yet. This is the highest-value next phase — see Section P.

## F. Product/Creation architecture

**Not touched this session.** The existing product template and `main-product.liquid` remain exactly as they were (real Shopify variants/price/cart — nothing fabricated, nothing broken). The Creation-page redesign described in the master instruction (object storytelling before ACQUIRE, sticky acquisition panel, etc.) is deferred — see Section P.

## G. Mobile behaviour

Everything shipped this session was built mobile-first alongside desktop, not stacked afterward: hero keeps its landscape media crop; the menu's contextual-image field disappears entirely below 700px (no hover dependency); the Edition teaser's offset image switches from absolute overlap to a small vertical stack with no horizontal overflow; the new Maker's Mark/Oryx sections reuse `caviera-editorial-media`, whose grid already collapses to a single column on narrow viewports. Not independently re-tested this session on a real device — verified by reading the responsible CSS breakpoints, per the same honest limitation noted in earlier reports (no browser/screenshot tool in this environment).

## H. Accessibility

Unchanged from prior verified state (Escape/close/focus-trap/focus-restore/keyboard parity on the menu; skip-link hidden until focus; reduced-motion collapsing all new animations). The two new homepage sections reuse `caviera-editorial-media`, which already has semantic headings and decorative (`alt=""`) brand-mark rendering. No new interactive controls were introduced that required new accessibility wiring.

## I. Performance

No new JS this session. Both new homepage sections reuse the existing `caviera-editorial-media` section and its bundled official-artwork rendering path (no new images fetched beyond what that section already loads). `loading="lazy"` throughout for below-fold media; hero media remains eager/high-priority.

## J. Files created

- `sections/caviera-edition-teaser.liquid` (prior session)
- `CAVIERA_LUXURY_REDESIGN_REPORT.md` (this file)

## K. Major files modified (this session)

- `sections/caviera-edition-teaser.liquid` — added `id="edition-i"` anchor
- `sections/caviera-footer.liquid` — fixed the catalogue-fallback bug, added Our Diamonds link, removed dead code
- `sections/caviera-header.liquid` — wired EDITION I menu item to `/#edition-i`
- `templates/index.json` — added `makers-mark` and `oryx-moment` sections, recopied the newsletter section as "Private Notice"

(Full history of every file touched across the whole redesign branch is in `git log --stat` — see commit list below.)

## L. Git commits (this branch, chronological)

```
05bd793  Baseline pull: CAVIERA Grand Theme 2026 — RC1 (live theme), 10 Aug 2026
48725c7  Build CAVIERA global luxury interaction system
8268d08  Build CAVIERA arrival navigation and transition system
a7e2765  Fix transparent-header contrast bug hiding MENU/SEARCH/BAG
b7f0eeb  Fix invisible full-screen menu navigation (empty menu source, not a CSS bug)
2e848db  Refine full-screen menu into Edition-based navigation with reserved visual field
c619bdb  Final polish pass on the full-screen CAVIERA menu
6e996d3  Build CAVIERA cinematic homepage opening (Hero, House Statement, Edition I teaser)
84b8584  Add House-story chapters, fix footer catalogue fallback, wire Edition I anchor
```
`master` remains untouched at `05bd793` throughout.

## M. Theme Check final result

**0 errors, 0 warnings** — 82 files inspected, at every checkpoint in this session.

## N. Shopify working theme ID

`187461075235` — **CAVIERA — Luxury Redesign — Working**, confirmed `role: unpublished` after every push.

## O. Preview URL

```
https://v1b036-hc.myshopify.com?preview_theme_id=187461075235
```
Not published. Live theme `187398619427` confirmed `role: live` and unmodified after every push this session.

## P. Remaining merchant actions

None yet — no Shopify Admin data was touched. When ready to actually launch Edition I:

- Create the Edition I Shopify **collection** and add the final 10–12 products, assigned to it.
- Upload final Edition I campaign imagery (hero, teaser, object-study images) via the Theme Editor's image pickers — see Section Q.
- Decide and set the real Edition I launch date/status (`Upcoming` → `Current`) once Edition/Archive architecture (Section E) exists to hold that setting.
- Populate Journal with real articles when ready (currently correctly empty/hidden — no fake posts).
- Review and, if desired, populate the footer's `footer_jewellery_menu` (now "Editions menu") once an Edition page exists, to override the current safe anchor fallback.

## Q. Images/content still required before Edition I launch

- **Edition I hero/teaser imagery**: currently the bundled `15_oryx_necklace_on_model.png` is reused across the hero, the full-screen menu's Edition I preview, and the homepage teaser. This is flagged in three prior reports on this branch and remains the single most important asset gap — real Edition I campaign photography should replace it in all three places via their respective Theme Editor image settings.
- **A second Edition teaser image** (optional) — no bundled asset fits; the section already supports one via `edition_image_2` whenever available.
- **Journal articles** — none exist yet; the section correctly stays hidden until real ones are published.
- **Exact Edition I launch date and production quantities** — deliberately not fabricated anywhere (the Maker's Mark section uses a neutral `CAVIERA No. ___ / ___` placeholder format, never a real number).

---

## Recommended next phases (not started this session)

In priority order, matching the master instruction's own Phase E–H structure:

1. **Edition/Archive architecture** (Phase E) — reusable `caviera-edition-*` sections, a `templates/page.edition.json`, Edition status logic (upcoming/current/closed), Archive index (not linked from primary nav yet).
2. **Creation/commerce experience** (Phase F) — redesign the product template into the Creation-page sequence, with sticky acquisition panel; audit collection fallback, cart, search for the same Edition-first language pass applied to the homepage.
3. **House content pages** (Phase G) — The House, Craftsmanship, Our Diamonds, Bespoke, Client Care, Journal/article, 404, policies, account — each currently functional and on-brand from earlier sessions, but not re-audited against this specific instruction's language/structure requirements this session.
4. **Full responsive + accessibility + performance pass** (Phase H) — a dedicated audit across every template at 1440/1024/768/430/390/375, not just the homepage.

Each of these touches either commerce-critical logic or a large surface area of content pages, and deserves its own reviewed pass rather than being rushed into this one.
