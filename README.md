# Amanuel Teferi — Portfolio

A bold, motion-heavy personal site for a software engineer. Hand-written HTML, CSS and
JavaScript: **no framework, no build step, no dependencies**. Open `index.html` and it runs.

**Live:** https://mannyioi.github.io/portfolio/ · mirrored on [Vercel](https://portfolio-amanuels-projects-5fe1beae.vercel.app/)

---

## What's in it

**Design**
- Huge display typography (Bricolage Grotesque) against acid-lime, electric-violet and cyan on near-black
- Outlined/stroked headline type, gradient text fills, film grain overlay, dotted grid
- Fully responsive down to 360px, with a full-screen circular-reveal mobile menu

**Motion**
- Animated hero canvas: flow-field particles with proximity links and drifting light blobs, reactive to the pointer
- Sub-second preloader with a masked name reveal (skipped on repeat visits in a session)
- Scroll-triggered reveals (line masks, staggered fades) via `IntersectionObserver`
- Word-by-word light-up on the about statement as you scroll through it
- Scroll-velocity-reactive marquee, animated stat counters, hero parallax and letter-spacing drift
- Magnetic buttons, 3D tilt cards with a cursor-tracking shine, custom blend-mode cursor with hover/"VIEW" states
- Hide-on-scroll nav, top scroll-progress bar, live Addis Ababa clock

**Content**
- Hero, about + education/current cards, stack (core vs. secondary), impact metrics band,
  five-role experience section with company logos and links, side-projects grid with demo/repo
  links, a "Let's have fun" game teaser, contact section with a working form, footer wordmark
- One-page résumé PDF (`assets/Amanuel-Teferi-Resume.pdf`) linked from the nav, hero, menu and contact

**Pipeline Runner (`play.html`)**
- A 3D endless runner in Three.js (r170, vendored in `assets/vendor/`): switch lanes, jump
  firewalls, chain records for up to ×5, level-ups as it speeds up
- Keyboard, swipe and on-screen controls; synthesised WebAudio sound with mute; best score in
  `localStorage`; Web Share / clipboard score sharing; pauses when the tab is hidden

**Engineering**
- No runtime dependencies on the main page; two small deferred scripts
- Works without JavaScript: `<noscript>` styles reveal everything, and a head failsafe switches to a
  static layout if `app.js` hasn't finished within 4s
- Canvas pauses when off-screen or when the tab is hidden; all scroll work is rAF-throttled
- Full `prefers-reduced-motion` path — animation, grain and canvas all stand down
- Semantic landmarks, skip link, keyboard-operable accordion with `aria-expanded`, visible focus rings
- SEO: meta + Open Graph + Twitter cards, JSON-LD `Person` schema, sitemap, robots, web manifest

---

## Run it

No tooling required:

```bash
open index.html            # macOS
```

Or serve it (nicer for testing relative paths and the manifest):

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

---

## Customise

Everything personal lives in two places.

**1. `assets/js/app.js` — the `CONFIG` block at the top**

```js
var CONFIG = {
  FORM_ENDPOINT: '',                     // see below
  EMAIL: 'aman.teferi.80@gmail.com',
  TIMEZONE: 'Africa/Addis_Ababa'
};
```

**2. `index.html`** — copy, links and meta tags.

### Résumé

`assets/Amanuel-Teferi-Resume.pdf` is generated from `tools/resume.html`. Edit the HTML, then
rebuild it with Playwright:

```bash
npm i -g playwright   # once
NODE_PATH=$(npm root -g) node tools/build-resume.js
```

Or drop in your own PDF under the same file name.

Colours and type are CSS custom properties at the top of `assets/css/styles.css`:

```css
--acid: #d7ff3e;  --violet: #6e4bff;  --coral: #ff5a3c;  --cyan: #35e7ff;
```

### Contact form

Out of the box the form validates input (plus a honeypot for bots) and hands the message to the
visitor's mail client, pre-filled — it works on a static host with zero setup.

To have submissions land in your inbox instead, create a form on
[Formspree](https://formspree.io), [Web3Forms](https://web3forms.com) or
[Basin](https://usebasin.com) and paste the endpoint into `CONFIG.FORM_ENDPOINT`. The form then
POSTs JSON (`name`, `email`, `message`) and falls back to a "mail me directly" message if the
request fails.

---

## Deploy

**GitHub Pages** — `.github/workflows/deploy.yml` publishes `main` automatically.
Enable it once under *Settings → Pages → Build and deployment → Source: GitHub Actions*.

**Vercel** — already linked to this repo; every push to `main` ships to production. `vercel.json` carries the cache and security headers (no build step, output directory `.`).

**Netlify / Cloudflare Pages** — import the repo, no build command, output directory `.`.

Using a custom domain? Update the absolute URLs in `index.html` (`og:url`, `canonical`,
`og:image`), `sitemap.xml` and `robots.txt`.

---

## Structure

```
index.html              markup + meta + JSON-LD
assets/css/styles.css   design tokens, layout, all animation states
assets/js/hero.js       hero canvas (particles + light blobs)
assets/js/app.js        loader, cursor, reveals, counters, marquee, tilt,
                        accordion, menu, clock, contact form
assets/js/game.js       Pipeline Runner (play.html)
assets/vendor/          three.module.min.js (r170)
assets/img/             favicon + app icons, Open Graph images, company logos, game preview
play.html               the game page
market-floor.html       Market Floor case study
404.html                not-found page (works under /portfolio/ and at the root)
tools/                  résumé source + PDF build script
```

## License

MIT — see [LICENSE](LICENSE). The design and written content are mine; the code is yours to learn from.
