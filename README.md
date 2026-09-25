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
- Preloader with a real progress counter and a masked name reveal
- Scroll-triggered reveals (line masks, staggered fades) via `IntersectionObserver`
- Word-by-word light-up on the about statement as you scroll through it
- Scroll-velocity-reactive marquee, animated stat counters, hero parallax and letter-spacing drift
- Magnetic buttons, 3D tilt cards with a cursor-tracking shine, custom blend-mode cursor with hover/"VIEW" states
- Hide-on-scroll nav, top scroll-progress bar, live Addis Ababa clock

**Content**
- Hero, about + education/current cards, stack (core vs. secondary), impact metrics band,
  five-role experience accordion, side-projects grid, contact section with a working form, footer wordmark

**Engineering**
- ~0 JS dependencies; two small deferred scripts
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

> **Set your LinkedIn URL.** The site currently ships
> `https://www.linkedin.com/in/mannyioi` as a placeholder in three spots
> (JSON-LD, mobile menu, contact socials). Search and replace it with your real profile URL.

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
assets/img/             favicon, Open Graph image
```

## License

MIT — see [LICENSE](LICENSE). The design and written content are mine; the code is yours to learn from.
