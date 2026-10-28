# Portfolio Website · Project Document

**What this is:** Randhir's personal portfolio.
**Live site:** https://randhirsingh77.github.io/portfolio/
**Code:** https://github.com/randhirsingh77/portfolio (working copies in `~/workspace/github-prep/portfolio/`)
**Tech:** Plain HTML, CSS, JavaScript — no framework, no build step. Hosted on GitHub Pages. Contact form runs on FormSubmit (free).

This document explains **what was done and how it was done**, in the order it happened.

---

## 1. Version 1 — built and published (22 Oct 2026)

A standard static portfolio was created in a new GitHub repo and published with GitHub Pages (repo Settings → Pages → deploy from the `main` branch; every later push rebuilds the site automatically in about a minute).

His verdict on v1: it **"looked AI-made."** He was right, and the tells were specific: purple-cyan gradients, glowing orbs, a typewriter hero animation, numbered "01." section headings, emoji bullet lists, skill-chip clouds and gradient project cards. Those are the fingerprints of every AI portfolio template — recruiters recognise them instantly.

## 2. Version 2 — the redesign (22 Oct 2026)

**How:** instead of inventing a design, I took the most-referenced real developer portfolio — Brittany Chiang's (brittanychiang.com) — and rebuilt his site in that language:

- **Layout:** a flex two-column page. The left sidebar is `position: sticky; top: 0` so the name, role, nav and socials stay on screen while the right column scrolls. Below 900px the columns stack.
- **One accent colour** (a soft green, `#6fd3a7`) on a dark slate background, one font (Inter), no gradients, no glow, no animations-for-show.
- **Copy rewritten in plain first person** with concrete details instead of buzzwords — what the Pehlwan app actually does (WhatsApp OTP login, Hindi interface for staff, multi-branch subscriptions), the QSpiders LMS internship, and an honest line that Pehlwan's code is private because it's a commercial product.
- **Skills as a simple two-column list inside About**, and experience/projects as quiet rows that only highlight on hover.

Each of the three files was pushed as its own commit through the GitHub Contents API.

## 3. The contact form — how it works without a backend

A static site can't send email by itself. The form uses **FormSubmit's AJAX endpoint**: JavaScript `fetch()` posts the form fields to FormSubmit, which forwards them as an email to `rs6201849307@gmail.com`, and the page shows a thank-you message without reloading. His email is also printed as a normal `mailto:` link for anyone who prefers their own mail app.

One caveat recorded at the time: FormSubmit requires a **one-time activation click** — the first submission triggers an email containing an activation link; until that link is clicked once, messages don't flow. That click is still his to do.

## 4. Fixes and gentle animation (23 Oct 2026)

- **Removed the "Naukri profile" sidebar link.** How I caught it: the link pointed to `naukri.com/mnjuser/profile` — that's the *logged-in* profile page. Anyone clicking it from his portfolio hits a Naukri login wall, so the link was useless to the exact people it was for. (It later returned as a logo — see section 6.)
- **Social meta tags added** (Open Graph + Twitter card + theme-color), so pasting the site link into WhatsApp or LinkedIn produces a proper preview card instead of a bare URL.
- **Animation, in the reference site's own style** — tasteful, not template-y:
  - *Cursor spotlight:* a fixed, pointer-events-none layer whose background is a radial gradient centred on CSS variables `--mx/--my`. A `mousemove` listener updates those variables, throttled by `requestAnimationFrame` so it stays at 60fps and doesn't fire layout work per pixel.
  - *Section reveal:* sections carry a `reveal` class and an `IntersectionObserver` adds `in` when they enter the screen (fade + 14px rise). Crucially, the hidden starting state only applies when an `html.js` class is present — a one-line inline script adds it — so if JavaScript ever fails, **the content is never stuck invisible**. Insurance like this is the difference between an animation and a liability.
  - *Link underlines* that grow on hover via an animated `background-size` gradient.
  - All of it is switched off under `@media (prefers-reduced-motion: reduce)` for users who ask their system for less motion.

## 5. Cleaning the commit messages (23 Oct 2026)

He set a rule: commit messages must read like a developer wrote them — short and plain ("add animation styles") — never long, and never mentioning what he told me. The evening's three commits had long messages, so they were rewritten:

**How:** GitHub's API can't edit a commit message directly, so the commits were *rebuilt*: for each commit (oldest first) I read its tree (the exact snapshot of files) and its parent, then created a **new commit object with the same tree, same parent chain and the same author dates — only the message changed**, and force-updated the `main` branch to the new tip. Verification: the new head's tree hash was byte-identical to the old one, proving **zero file changes** — only the words changed. This is safe here because the repo has one author and no collaborators; rewriting shared history would be a different story.

## 6. The GitHub icon and the Naukri logo (23 Oct 2026)

He reported the GitHub icon "is not correct" — and he was right: the SVG path data for the GitHub mark in the code was garbled (a corrupted stretch of numbers), so the shape rendered wrong. **How icons work:** an inline `<svg>` draws from a `path` — a list of drawing instructions. One wrong segment deforms the whole logo. The broken path was replaced with the **canonical GitHub mark path** (the standard 24×24 octocat path used by simple-icons).

The Naukri link returned — at his request — as a **logo instead of text**: an inline SVG wordmark ("naukri" in bold blue with the orange dot), linking to his Naukri profile, sized to sit naturally beside the GitHub and email icons.

## 7. Case studies, demo buttons and activity snapshot (26 Oct 2026)

Three features were added, one commit each, all verified live afterwards.

**Case-study pages (commit `1661906` "add project case studies").** Each featured project now has its own long page — `case-study-foodie.html`, `case-study-lms.html`, `case-study-sarthi.html` — following one fixed template: the problem → constraints → architecture → the trade-offs made → what broke → the result → demo/repo links at top and bottom. The writing was drafted from these project documents, using only numbers that can be verified from the live products or the records in them (Foodie's 41-check smoke suite and ₹650 promo regression; the LMS access-control suite going 43/67 → 67/67 and its 208/208 responsive checks) — no invented metrics. Sarthi has no code yet, so its page is honestly labelled a **design case study**: it documents the scope, the planned architecture, the differentiators in scope and the written cut list, and says plainly that nothing is built. A Sarthi entry was also added to the Projects section of the home page so the page has somewhere to link from. Two small safety fixes rode along in the same commit: `script.js` now null-guards the footer year and the contact-form handler — before this, the script assumed `#contactForm` exists, so loading it on a page without the form (like a case study) would have thrown an error and killed the rest of the script. The case-study pages reuse `style.css` (a new `.cs` section) so they look like the same site, not a bolt-on.

**One-click demo buttons (commit `038ca4c` "add live demo buttons").** The Foodie entry gained a "Try the live demo" button linking to the live app with the demo deep link (`https://foodie-tvna.onrender.com/?demo=customer` — the Foodie app build implements the demo-login end of that link), and the LMS entry gained a "Live demo" button to `https://lms-seven-gold.vercel.app/` (before this, the LMS entry linked only to its GitHub repo — there was no live link at all). Under each button sits the honesty line: *"Hosted on a free tier — the first load can take ~50 seconds while the server wakes up."* That line matters: without it, a sleeping free server reads exactly like a broken demo.

**GitHub activity snapshot (commit `929cbf1` "add github activity snapshot").** A new "Recent activity" section on the home page shows his latest GitHub work. It does **not** call the GitHub API from the visitor's browser (that would burn the visitor's own 60-requests/hour unauthenticated limit and break on shared IPs, and embedding a token in page JavaScript would leak a credential). Instead, a snapshot file `github-activity.json` sits in the repo and the page simply fetches and renders it: event text, link, and a relative time ("3h ago"). The snapshot was generated once by hand for launch: the public events API was queried, Push/Create events kept, and — because the API's push payloads no longer include commit messages — each push's head commit was looked up to get its real message. The fallback, if the snapshot file ever fails to load, is a plain link to his GitHub profile, never a blank section.

**The one leftover — the daily refresh workflow.** A GitHub Action (`.github/workflows/github-activity.yml`) was written to regenerate the snapshot daily (fetch events → rebuild the JSON → commit only if it changed; YAML validated, logic mirrors the manual generation). It could **not be pushed**: GitHub rejected the tree containing the workflow path with a 404, which is its known behaviour when the token lacks the **`workflow`** scope — the same scope already pending for his profile name/bio. The blob itself was accepted; only the workflow path is blocked. The file is saved in the build clone at `~/workspace/differentiator-build/portfolio-clone/.github/workflows/github-activity.yml`. Once he adds the `workflow` scope to his token (GitHub → Settings → Developer settings), it pushes in one commit; until then the snapshot simply stays as of 26 Oct 2026 instead of refreshing daily. Everything else — all three case-study pages, both demo buttons, the activity section and its snapshot — is live and was verified by fetching the live GitHub Pages URLs (all 200, new sections and links present).

## Pending

- GitHub profile **name** ("RandhirSingh" → "Randhir Singh") and bio: the API token lacks the `user` scope, so this needs him to add the scope or edit it in GitHub Settings.
- **Profile pins** (which repos appear on his profile) can only be set in GitHub's UI, not by API.
- FormSubmit activation click (section 3).
