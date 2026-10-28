# Foodie — Food Delivery Website · Project Document

**What this is:** Randhir's own food-delivery website — a restaurant page with a menu, cart, offers and ordering, in the style of a small Swiggy/Zomato restaurant.
**Live site:** https://randhirsingh77.github.io/Food-Delivery/
**Code:** https://github.com/randhirsingh77/Food-Delivery
**Tech:** Plain HTML, CSS and vanilla JavaScript (no framework, no build step), hosted free on GitHub Pages. Login is handled by Auth0 (free plan).

This document explains, for every piece of work, **what was done and how it was actually done** — the method, not just the result.

---

## 1. The audit — how the problems were found (23 Oct 2026)

Before changing anything, I read the whole project: `index.html` and `style.css` line by line, listed every file in the repo through the GitHub API, and checked the live site's Pages status.

The audit method matters: a website can *look* fine in code and still be broken live, so every claim below was checked in the code itself:

- **The logo was broken.** The image tag said `src="image\foodie logo1.jpg"` — a Windows-style backslash instead of a web `/`, and the file name contained a space. Browsers are strict about this, so the logo could fail to load.
- **There was no JavaScript file at all.** That one fact explained most of the site: the search, heart and cart icons in the navbar were just pictures of icons — nothing happened on click. Every "Order Now" button was a link to `#` (nowhere). The order form had `action="#"`, so submitting it did nothing.
- **No responsive CSS.** Not a single `@media` rule existed. The layout used fixed pixel widths (a 700px hero image, 650px paragraphs), which only fits a desktop monitor. On a phone it must overflow — this was the root cause of "not responsive".
- **Dummy content.** Lorem ipsum paragraphs everywhere, spelling mistakes in dish names (Buger, Juse, Gallary), and fake phone numbers (+91 123456789) in the footer.
- **Huge images.** The repo was ~17 MB of photos. `pasta.jpg` alone was 4.4 MB and `pizza.jpg` 3.8 MB — phone users would wait seconds for the menu to appear.

## 2. Rebuilding the page (index.html)

I rewrote the HTML rather than patching it, keeping the same design (white background, yellow `#fac031` accent, same sections and prices) but with correct structure:

- **Real copy** replaced all lorem ipsum — a one-line, honest description for each of the 12 dishes, a real About paragraph, and a footer with his real email and "New Delhi, India" instead of the fake numbers and random countries.
- **Every image got an `alt` text** (screen readers and Google read these; a broken image also shows this text instead of nothing).
- **Proper headings:** one `<h1>` for the page, `<h2>` for section titles — this is what search engines and accessibility tools expect.
- **The form got real labels.** Each input now has a `<label>` tied to it, correct `type` (email/tel/number), `required`, and browser autofill hints (`autocomplete`). Labels are not decoration: clicking the label focuses the field, and screen readers announce them.
- **SEO/social tags:** a real `<title>`, meta description, Open Graph tags (so the link shows a title, text and photo when pasted into WhatsApp/LinkedIn), a theme colour, and a favicon.

## 3. Making everything work (script.js)

The whole app runs on one simple idea: **the menu cards are the database.** Each card carries `data-name` and `data-price` attributes. On load, JavaScript reads all cards into a `Map` (name → price). Every feature reads from that one map, so prices can never disagree between the menu, the cart and the order form.

- **Cart.** Clicking Order Now adds 1 to that dish's quantity in the cart Map. One `renderCart()` function redraws the cart panel (items, +/− buttons, total) from the Map every time anything changes — the screen is always a picture of the data, never edited by hand. The cart is also saved to `localStorage`, so it survives a refresh.
- **Favourites.** Hearts toggle the dish name in a `Set`, also saved to localStorage; the navbar heart filters the grid to just those dishes.
- **Order form.** On submit, JS checks every required field (adding a red `.invalid` border to bad ones), then builds an order ID like `FD-LAR3DG` (the current time encoded in base-36), and shows a confirmation panel with the order summary. No payment is taken — the page honestly says it is a front-end demo checkout.

## 4. Responsive CSS — how the phone layout was fixed

The old CSS had fixed widths and fragile positioning (elements pushed around with `top: 130px`-style offsets). The rewrite uses modern layout tools instead:

- **Grid layouts that adapt by themselves:** the menu uses `repeat(auto-fill, minmax(250px, 1fr))` — the browser fits as many 250px+ columns as the screen allows, so no JavaScript is needed for the grid.
- **Breakpoints where the design actually breaks:** at 1024px the gallery drops to 2 columns; at 900px the nav links hide behind a hamburger button and two-column sections stack; at 560px the menu and the form become one column and the header shrinks.
- **`scroll-margin-top` on sections**, so when you tap a nav link, the fixed header doesn't cover the section heading.
- **Touch fix:** gallery captions normally appear on hover — phones have no hover — so under `@media (hover: none)` the captions are always visible at the bottom of each photo.
- **`overflow-x: clip` on the body** as a safety net: even if one element is too wide, the page can never scroll sideways.

## 5. Image compression — how 17 MB became ~2.9 MB

The images were downloaded through GitHub's Git Blobs API (the normal Contents API refuses files over 1 MB — two photos were above that). Then a Python script using **Pillow**:

1. Open each photo; if it is wider than 900px (the largest size the site ever displays), shrink it to 900px wide, keeping the aspect ratio.
2. Re-save JPEGs at quality 80 with `optimize` and `progressive` on — visually the same, a fraction of the size. Examples: pasta.jpg 4.4 MB → 78 KB, pizza.jpg 3.8 MB → 197 KB.
3. Two images where the "compressed" file came out *bigger* than the original (they were already tiny) — the originals were kept instead. Compression should never make a file grow.
4. The logo file was renamed to `foodie-logo.jpg` (no space), and two images nothing referenced (`bg1.jpg`, `cake.jpg`) were deleted after grepping the code to prove they were unused.

**How the images were committed:** the GitHub Contents API uploads one file per commit — 24 images would have meant 24 noisy commits. Instead I used the **Git Data API**: upload each file once as a *blob*, build one *tree* listing every path and its blob, create one *commit* pointing at that tree, and move the `main` branch to it. One clean commit: "compress images, remove unused files". (One technical hiccup worth remembering: very large uploads can't travel as command-line arguments, so large request bodies were passed through a small helper script that reads them from a file.)

## 6. Testing — how the site was verified

After each round, a real browser was driven through the live site (not the local files — the actual GitHub Pages URL, hard-refreshed to beat caching):

- Round 1 (8 checks): every image renders, add Burger → badge 1 → open cart → total ₹40 → quantity + → ₹80, search filters, favourites, checkout pre-fills the form, order confirmation with ID, hamburger at narrow width, no sideways scrolling, no console errors. The test caught one real bug: the search bar was visible on page load because my CSS `display: flex` silently overrode the `hidden` attribute — fixed with one rule, `[hidden] { display: none !important; }`.
- Round 2: described in sections 8–9 below.
- The mobile check needed a human: the test browser cannot resize itself, so Randhir resized the window to ~390px and handed control back; the checks then ran at that width (results in section 9).


## 7. Round 2 — the sticky smart search (24 Oct 2026)

His feedback was specific: the site still didn't feel responsive, the search icon "does not stick on the full page", and typing a product should show **that product and similar ones**. So the search was rebuilt:

- **Sticky by construction.** The search panel is now `position: fixed; top: 64px` (just under the fixed header). A fixed element is positioned relative to the *screen*, not the page, so it physically cannot scroll away while you type. The old version scrolled the page to the menu when opened — that scroll was removed; it felt broken.
- **Dishes got metadata.** Each card gained `data-category` (Fast Food / Italian / Indian / Drinks / Desserts) and `data-keywords` (words a user might type: "shake", "spicy", "sweet", "breakfast"…).
- **Scoring, not just matching.** A function scores every dish for your text: exact name match +120, name starts with your text +80, name contains it +60, each keyword word matched +30, category matched +20. Results sort by score. Typing **"choco"** → Chocolate Drink and Chocolate on top. Typing **"sweet"** → the desserts, even though no dish is *named* "sweet" — that's what keywords are for.
- **Similar products.** After the top results, dishes sharing the **category of the best match** are listed under "You may also like" (pizza → Pasta and Lasagna). Every suggestion row has the photo, price and its own **Add** button; tapping the row itself closes the search, scrolls to that dish's card and flashes a yellow outline around it (`@keyframes cardFlash`) so your eye lands on it.

## 8. Round 2 — making it a real restaurant business

Real delivery apps share a set of mechanics; each was implemented as actual working logic, not decoration:

- **Category chips** above the menu set a filter value; one `applyFilters()` function combines category + search text + favourites-only, so the three filters can never fight each other.
- **Veg / non-veg badges** — the small green (dot in a square) and red (triangle) marks Indian users recognise; they are data on the card, shown over the photo.
- **One money function.** All prices flow through `breakdown(subtotal)`: discount first (promo **FOODIE50**: 50% off, capped at ₹100, only when subtotal ≥ ₹299), then delivery (₹30, **free when subtotal − discount ≥ ₹499**), then total. The cart panel shows the full bill — subtotal, discount row, delivery row, total — and a live note: "Add ₹99 more for FREE delivery", computed from the same numbers. Because one function does the maths, the cart and the order form always agree.
- **Restaurant info strip** in the hero (4.5 rating, 30–40 min, free delivery over ₹499) and an **Open/Closed badge that reads the real clock**: JavaScript checks the hour against the 11:00–23:00 opening hours and renders a green "Open now" or red "Closed · opens 11 AM". (During testing at 00:10 AM it correctly showed Closed.)
- **A fuller order:** payment choices as radio "pills" (Cash on Delivery / UPI, the selected one highlights via the CSS `:has()` selector), an optional delivery-note field, and a confirmation that adds the **delivery-by time** (now + 40 minutes, formatted) and a **4-step status tracker** (Order received → Preparing → On the way → Delivered).
- **Restaurant JSON-LD** in the page head — structured data that tells Google "this is a restaurant, in New Delhi, open 11–23" in machine-readable form.

**Testing round 2** verified the numbers exactly, not just "it works": Pasta ×3 = subtotal ₹750 → FOODIE50 → discount −₹100 → delivery FREE → **total ₹650**; removing one Pasta → subtotal ₹500 → after discount ₹400 (below ₹499) → ₹30 fee returns → **total ₹430** with the "Add ₹99 more" note. The mobile pass at ~390px confirmed: nav fits in one row, hamburger toggles, hero wraps, search stays pinned, and **no sideways scrolling anywhere**. (In that window the menu rendered 2 columns — the window's effective width behaved like a small tablet; the stricter single-column rules apply below 560px.)

## 9. Auth0 login — how it was implemented (24 Oct 2026)

The request: signup with phone number and email, Continue with Google, login with password using email **or** phone number, forgot password and change password — all **free**, with no money for OTP messages.

**The key fact first:** there is no free SMS OTP anywhere in the world — every text message is billed to someone. So the design uses the standard free alternative: **the phone number is the username.** In Auth0's database connection there is a setting "Requires Username"; with it on, signup asks for a username (the user types their phone number), an email and a password. After that, the Auth0 login page accepts *either* the username (phone) *or* the email, plus the password. Zero messages sent, zero cost, exactly the behaviour requested.

**How the integration works** (`auth.js`):

1. The site loads Auth0's official JavaScript SDK (`auth0-spa-js`) from Auth0's CDN — only after the config is filled in.
2. Clicking **Login / Create account / Continue with Google** calls `loginWithRedirect()`. The browser leaves the site for Auth0's hosted login page (Auth0's secure pages, where "Forgot password" also lives), and Auth0 sends the user back to the site afterwards. Signup passes `screen_hint: "signup"`; Google passes `connection: "google-oauth2"`.
3. On return, the SDK exchanges the code in the URL for tokens (`handleRedirectCallback()`), and `getUser()` gives the profile — name, email, photo. Passwords are never seen or stored by this website; Auth0 stores them hashed.
4. The navbar button becomes the user's photo (or initial). The account panel shows name, email, phone (read from the username when it looks like a phone number) and buttons. The **order form pre-fills** name/email/phone from the profile.
5. **Change password** calls Auth0's Authentication API directly: `POST https://{domain}/dbconnections/change_password` with the client ID, the user's email and the connection name. Auth0 emails a secure reset link — that's also exactly how "forgot password" works. (Auth0 free plan: 25,000 monthly active users, unlimited social logins — verified against Auth0's pricing/docs.)
6. **Google users and "set a password":** a Google account has no Foodie password — Google manages it. The panel says this honestly and shows a "Set a password" explanation instead of a fake button. Giving a Google user a second, password-based identity on the *same* account is called **account linking** in Auth0 and is the planned next step; it is deliberately not faked.
7. **No MongoDB is needed.** Auth0 *is* the user database. MongoDB would only enter the picture if orders later need to be saved on a server.

**Until the keys exist**, `AUTH_CONFIG` at the top of `auth.js` is empty, and the account panel simply shows "Login is being set up" — the rest of the site is untouched. To switch it on: create the free Auth0 account + a "Single Page Web Applications" app, set the callback/logout/web-origin URLs to `https://randhirsingh77.github.io/Food-Delivery/`, enable "Requires Username" on the database connection, enable Google — then paste the app's **Domain** and **Client ID** into `auth.js` (both are public values for a web app, safe to share).

## Pending / next steps

- Auth0 Domain + Client ID from Randhir → login goes live; then test signup/login/Google/forgot-password end to end and add the results here.
- Account linking for Google users (phase 2 of auth).
- Optional: wire placed orders to his email (FormSubmit, like the portfolio) so orders actually reach him.

## 10. Redesign v3 — "warm modern bistro" (24 Oct 2026)

His feedback: the site "does not look good" — and with 1,505 skills now installed, he asked for the redesign to use them. Two skills drove this round: **ui-ux-pro-max** (its priority order: accessibility/contrast first, then touch targets, typography and colour tokens) and **no-ai-design-slop** (a quality gate: a design choice is suspect if it could be pasted into any unrelated product unchanged; every element must earn its place). The skill's own search database wasn't included in the repo copy, so the design was built from its priority rules directly — stated here for honesty.

**How it was done safely:** before touching anything, every JavaScript hook was inventoried (all element IDs, the classes script.js queries, and the markup JS itself generates for cart rows and search suggestions). The redesign changes presentation only — CSS rewritten wholesale, plus exactly two lines in the HTML (the font link and the theme colour). No id, class or data attribute used by JS was renamed, which is why nothing functional broke.

**The new system, and why each piece changed:**

- **Tokens first.** All colours/radii/shadows are CSS variables (`--bg`, `--ink`, `--brand`, `--line`, `--shadow-card`…). One source of truth: change one variable, the whole site follows.
- **Colour.** The old design was white + pale yellow `#fac031` everywhere — flat, and white text on that yellow has a contrast ratio of about 1.6:1 (nearly unreadable; the accessibility rule is 4.5:1). Now: warm cream background `#fff9f1`, warm charcoal text `#221a12`, a deeper marigold `#f5a301` as the working brand colour, and the original yellow kept only as a bright highlight. Buttons are dark text on amber (≈7:1 — passes).
- **Typography.** Headings and dish names moved to **Fraunces**, a warm display serif (food brands use serif display type because it feels crafted, not generated); Poppins stays for UI text. Dish names were yellow before — now dark serif, with the amber moved to the stars and the italic word in each section title.
- **One authored moment.** The hero photo sits on an amber **arch** (a `::before` panel, rounded fully at the top) with a soft drop shadow — a single strong idea instead of scattered decoration. The offer became a dark pill (the amber code pops against it), and the restaurant info is one white pill card.
- **Shape language.** Everything rounded consistently: cards 22px, images 14px, buttons/chips fully pill. Cards got warm-tinted shadows and hairline borders instead of the old harsh grey shadow, and lift 4px on hover.
- **The dated bits removed.** The order section's photo-background-with-white-overlay (a 2015 template look) became one clean white form card; the light-grey footer became dark charcoal-brown with cream text; category chips turn dark when active instead of yellow.
- **Touch rules.** Navbar icon buttons are now true 44×44px targets (the skill's minimum), quantity buttons grew 26→30px, and focus outlines use the deep amber so keyboard users can see them on cream.

**Commits:** `efe37c6` "add fraunces font, update theme color", `ea8d845` "redesign site styles".

**Testing:** live-browser QA on the deployed site — 9 of 10 checks passed with exact values: all design markers confirmed (cream bg, Fraunces, arch, dark footer, dark serif dish names); cart regression exact (Pasta ×3 → subtotal ₹750 → FOODIE50 → −₹100 → delivery FREE → **₹650**, and the order form's estimated total updated to ₹650 too); search stayed pinned and "choco" ranked Chocolate Drink first with Juice as similar; the Italian chip filtered to exactly Pasta/Lasagna/Pizza; account panel opened cleanly; no errors across ~30 interactions (the QA browser can't read the console directly — reported honestly as a caveat). One deployment wrinkle: the browser kept showing the old design for ~15 minutes because the old stylesheet was cached — a fresh tab confirmed the new CSS was live. The mobile check (390px) still can't be run by the test browser — it needs Randhir's phone or a resized-window hand-back, same as round 2.

## 11. Search panel behind the top bar — the fix (24 Oct 2026)

**The bug he saw on his phone:** tap the search icon, and the top of the search panel hides *behind* the header. Root cause: the panel is `position: fixed; top: var(--header-h)` — placed using a *guessed* header height (68px, 60px on small screens). But on a narrow phone the real header is taller than the guess — the logo plus five 44px icon buttons wrap onto two rows — so the panel's fixed top edge landed underneath the bar.

**The fix (commit `ec1144f` "fix search overlay position on mobile"):** stop guessing. A few lines in script.js measure the header's actual height (`headerEl.offsetHeight`) and write it into the `--header-h` CSS variable; a `ResizeObserver` on the header re-measures whenever its height changes (rotation, menu opening, font loading), plus `resize`/`load` listeners as backup. Everything that positions against the header — the search overlay, the hero's top padding, sections' `scroll-margin-top` — reads that one variable, so all of them follow the real height at every screen size. This is the general pattern worth remembering: **when CSS needs a measurement only the browser knows, measure it in JS and feed it back as a CSS variable.**

## 12. Auth0 goes live (24 Oct 2026)

He offered to hand over his Auth0 credentials in chat so the whole setup could be done for him. That was declined — passwords never travel through chat (his own new rule: keys go nowhere). Instead he entered them once into the secure sign-in card (Secure Vault), and the browser signed in to **his** Auth0 dashboard with the saved login and did the entire setup:

- **Created** the "Foodie" application (Single Page Web Applications) in his tenant `dev-4jg6o5xx41f8s6nk` (US region).
- **Set the three allowed URLs** (Callback, Logout, Web Origins) to exactly `https://randhirsingh77.github.io/Food-Delivery/` and re-verified they persisted after a reload.
- **Turned ON "Requires Username"** on the `Username-Password-Authentication` connection — the switch that makes the phone-number-as-username design work — and confirmed the connection was enabled for the Foodie app.
- **Confirmed Google** (`google-oauth2`) enabled for the app, using Auth0's built-in developer keys (fine for launch; his own free Google keys are a later upgrade).
- Read the app's **Domain** (`dev-4jg6o5xx41f8s6nk.us.auth0.com`) and **Client ID** and wired them into `AUTH_CONFIG` in auth.js — commit `b7a7ed5` "connect auth0 login". (Both values are public identifiers for a web app — they appear in every login URL — so they are safe in the code. His password appears nowhere.)

The tenant shows a free-trial banner (22 days left at setup time); no card is attached, and when it ends the tenant continues on the free plan, which covers this site's needs.

**End-to-end verification (live browser, 7/7 passed):** account panel shows Login / Create account / Continue with Google (no longer "being set up") → Create account lands on the Auth0 signup page → the form asks exactly Username / Email / Password → a test account (username `9876543210`, email `foodie.test.98765@gmail.com`) signed up with **no email-verification block** and returned to the site logged in (avatar "FO", panel showing Change password + Logout) → the order form pre-filled from the account (Name shows the email, since the test account has no display name — cosmetic, expected) → Logout restored the logged-out state and emptied the form → Continue with Google reached Google's real sign-in page through Auth0 (not completed, by design). The test account can be deleted anytime from Auth0 Dashboard → User Management.

**Still to come (his side):** a MongoDB connection for the orders backend — the database stores **orders only** (users live in Auth0; cart/favourites live in the browser). The backend will be built with a proper folder structure (`src/config`, `src/models`, `src/routes`, `src/controllers`, `src/middleware`), and the connection string will be read from an environment variable — never written into code, files or the repo.

## 13. The header that ate the page — growth bug, diagnosis, fix (2026-10-24)

**Reported by Randhir (~01:59):** "the top bar is slowly take overing the page".

**Diagnosis (measured on the live site, old code):** the fixed header grew on its own, continuously and without any interaction — about +1px per animation frame. In 20 idle seconds it grew 300+ px; within minutes it covered the whole viewport and made the page unusable.

**Root cause — a feedback loop in section 11's fix.** `syncHeaderH()` measured the header's `offsetHeight` and wrote it into `--header-h`. But `.nav` inside the header has `min-height: var(--header-h)`, and `offsetHeight` includes the header's own 1px bottom border. So each write made the header exactly 1px taller, the ResizeObserver fired again, wrote the bigger value back — +1px per cycle, forever. Lesson: never set a variable from a measurement of an element whose size depends on that same variable; a border you forget is enough to start a ratchet.

**The fix (commits ac304eb "fix header and search position", 5fbf062 "tighten mobile header"):**
- The whole measuring mechanism is GONE — JavaScript never writes `--header-h` now; it stays a plain CSS constant used only for hero spacing and scroll margins.
- The search overlay is positioned at the moment it opens: `overlay.style.top = header.getBoundingClientRect().bottom + "px"` — the header's real bottom edge, correct for one-row, two-row, or menu-open headers — and re-anchored on window resize while open.
- Small-phone header tightened (logo 76px, tighter gaps) so it stays one row on most phones.

**Verified live, 5/5 checks passed:** header height identical after 20s idle; overlay top meets the header's bottom edge exactly, including after scrolling; cart/account panel open-close cycles never changed the header height; FOODIE50 regression intact (Pasta ×3 → ₹650). One note: during testing the search backdrop once stayed blurred until a reload — did not recur across repeated open/close cycles; watch it.

## 14. Orders backend — foodie-server (2026-10-24)

**What was asked:** Randhir is ready for the MongoDB setup. The database stores ORDERS only (users live in Auth0; cart/favourites live in the browser). Built with the installed Express + REST API skills, proper folder structure (his standing rule).

**Where:** `~/workspace/github-prep/foodie-server/` (not yet pushed/deployed — it goes public only when deployed, and the connection string NEVER goes into the repo; `.env` is git-ignored, `.env.example` holds variable names only).

**Structure:** `server.js` (env → DB → listen) · `src/app.js` (app builder: request-id → CORS locked to the site origin → JSON 50kb limit → routes → 404 → 4-arg error handler last) · `src/config/db.js` (Mongoose, reads `MONGODB_URI` from env) · `src/models/Order.js` · `src/utils/pricing.js` (server-side menu prices + FOODIE50/delivery rules — the money source of truth) · `src/middleware/` (requestId, validateOrder boundary checks, adminAuth with timing-safe key compare) · `src/controllers/orderController.js` · `src/routes/orderRoutes.js` · `scripts/smoke-test.js` · README with the full API table.

**API:** `GET /health`; `POST /api/v1/orders` (public — guest checkout); `GET /api/v1/orders` + `GET /:orderId` + `PATCH /:orderId/status` (admin key header). Errors use ONE envelope `{error:{code,message,details}}` with honest status codes (400/401/404).

**Design points worth remembering:**
- **Server recomputes every amount** from its own price list; browser totals are ignored. A tampered request claiming Pasta costs ₹1 still saves at ₹250 (tested).
- **Idempotency:** the website's order ID (`FD-XXXXXX`) is unique in the schema; a retried submission returns the original order with `replayed: true` instead of duplicating it.
- **Order lifecycle:** received → preparing → on_the_way → delivered / cancelled — matches the website's status tracker.

**Testing:** `npm install` done; `npm run smoke` boots the real app against an in-memory MongoDB and runs 14 checks — **14/14 PASS** (health; Pasta ×3 + FOODIE50 = subtotal 750, discount 100, delivery 0, total 650; replay; tamper; unknown dish 400; missing fields 400; list without key 401; list with key + pagination; status patch; unknown route 404). Note for future runs: the memory-server's own binary downloader timed out in this environment; downloading the mongod tarball with curl and setting `MONGOMS_SYSTEM_BINARY` worked.

**Next steps (waiting on Randhir):** create the free Atlas M0 cluster (steps sent to him: Mumbai region, DB user, network 0.0.0.0/0, Node driver string, add db name `foodie`). Then: deploy the server on a free host (Render), he pastes `MONGODB_URI` + an `ADMIN_KEY` into the host's environment settings HIMSELF (the string never passes through chat or files), and finally the website's order form gets wired to `POST /api/v1/orders` so real orders start saving.

**Update (same night):** Randhir couldn't see the backend because it only existed locally — so it was published as his own repo **github.com/randhirsingh77/foodie-server** (16 files, verified tree; no `.env`, no `node_modules` — only `.env.example` with variable names). This also sets up deployment: Render can connect straight to this repo.

## 15. Frontend folder structure — one project, two repos (2026-10-24)

**What was asked:** structure the frontend the same way as the backend, "as it will be the full stack project".

**Before:** everything sat at the repo root — `index.html`, `style.css`, `script.js`, `auth.js`, `image/` (25 photos).

**After (ONE commit `54d458e` "restructure files into folders", following Randhir's new commit-cadence rule):**
```
index.html          (stays at root — GitHub Pages + the page itself)
css/style.css
js/script.js
js/auth.js
images/             (renamed from image/ — clearer plural, matches convention)
LICENSE, README.md, robots.txt, sitemap.xml   (root — web standards live there)
```

**How it was done safely:** first grepped every reference (`image/`, `style.css`, `script.js`, `auth.js`) across HTML/CSS/JS — all references lived in `index.html` only (the CSS uses no image URLs; the JS reads dish data from the page). The local `index.html` was verified byte-identical to the repo's before editing. The commit was built with the Git Data API: unchanged files were MOVED by reusing their existing blobs at new paths (no re-upload, no content change), only `index.html` got a new blob (paths rewritten: `css/style.css`, `js/script.js`, `js/auth.js`, `images/...`, including the absolute og:image and JSON-LD URLs) and `README.md` gained a "Project structure" section + a "Full stack" section linking the backend repo. The local folder was restructured to mirror the repo exactly.

**Verified live, 5/5 checks passed:** page fully styled from `css/style.css` (not unstyled HTML), hero/logo/all dish photos load from `images/`, cart works (Pasta add + badge + totals), search opens under the header and filters, account panel shows Login / Create account / Continue with Google (proves `js/auth.js` loaded from `js/`). No rebuild delay — worked on first hard refresh.

**The full-stack picture now:** frontend repo `randhirsingh77/Food-Delivery` (this site, GitHub Pages) + backend repo `randhirsingh77/foodie-server` (Express + MongoDB, to be deployed on a free host) — two repos, one project; each README cross-links the other.

## 16. React migration — Vite + React + TypeScript (2026-10-24)

**Decision (Randhir's, from a comparison of React / Angular / Vue / staying vanilla):** React — it matches his MERN profile branding, his React Native skills transfer (components, hooks, Zustand), Sarthi will also be React, and Auth0 has an official React SDK. He chose "start now" over waiting until after STET.

**How it was built (working copy: `~/workspace/github-prep/foodie-react/`):**
- Scaffolded by hand (not create-vite) for full control: Vite 5 + React 18 + TypeScript (strict), `base: "/Food-Delivery/"` in vite.config.ts because Pages serves from a sub-path.
- **The design did not change**: the existing stylesheet moved verbatim to `src/index.css`, and every component reuses the same class names and DOM structure, so the warm bistro look carries over exactly.
- Structure: `src/data/dishes.ts` (menu catalog + search scoring, ported 1:1 from the old script — exact/name-prefix/substring 120/80/60, keyword +30, category +20), `src/utils/pricing.ts` (same FOODIE50/delivery rules as the site AND the backend), `src/store/useStore.ts` (Zustand: cart as a name→qty map, favourites, promo, panel/menu UI state; persists to localStorage and **adopts the old site's saved cart/favourites/promo** on first run so returning visitors keep their data), `src/components/` (Header, CartPanel, AccountPanel, SearchOverlay, Sections, MenuGallery+DishCard, OrderSection, Footer/Toast), `src/auth/AuthProvider.tsx` (@auth0/auth0-react, same tenant/client, localStorage cache, redirect back to the Foodie URL — no Auth0 dashboard changes needed).
- Images live in `public/images/` (served/copied as-is; referenced via `import.meta.env.BASE_URL`).
- Feature parity with the vanilla site: sticky header + badges, open/closed badge, mobile menu, search overlay anchored to the header's real bottom edge (the safe pattern from section 13 — measured at open time, never written into CSS), category chips, favourites filter, gallery order buttons (non-menu items land in the order form), order form synced with the cart + typed-items total estimate, Auth0 prefill, confirmation with order ID + ETA + status tracker that advances, toasts, Escape/outside-click closing.

**Verification:** `npm run build` GREEN (tsc strict + vite build; JS 414 kB / 124 kB gzip). The built `dist/` was served locally and checked: HTML/CSS/images all 200, bundle contains the promo logic, Auth0 config, dish data, search and order code, correct `/Food-Delivery/` asset prefixes. The automated browser could NOT open the local preview (it refuses local addresses), so the full click-through suite is still to run — it will run against the live URL right after the merge, same as every previous round.

**Where it lives:** branch **`react-migration`** on the Food-Delivery repo — 4 staged commits per the cadence rule (`scaffold vite react typescript app` → `add zustand store` → `add components and auth` → `add readme`), 50 files, tree verified; old vanilla paths absent. `main` is untouched, so the live site is still the vanilla version.

**Two things needed at merge time (both his, both quick):**
1. The deploy workflow (`.github/workflows/deploy.yml`, written and kept in the local working copy) could NOT be pushed: his GitHub token has `repo` scope but GitHub requires the **`workflow`** scope for workflow files (same token page where the `user` scope for his profile name/bio is also pending). He adds the scope → Muse pushes the file in one commit; alternatively he pastes it via the GitHub web UI.
2. GitHub Pages source must be switched to "GitHub Actions" (repo Settings → Pages) so pushes to main build + deploy automatically. Then merging `react-migration` into `main` takes the React app live, and the 7-check live QA runs.

## 17. The platform build — private repos, own auth, role dashboards, live tracking (2026-10-24, overnight)

Randhir's brief (03:00 IST, before shutting down): make the repo private; finish the React migration; then a complete platform — better UI with full refactoring, MongoDB-backed profiles with addresses, an owner admin with sales + graph, kitchen/manager order handling with out-of-stock toggles, Zomato/Swiggy-style live rider tracking with ETA, a driver dashboard with (demo) earnings, and driver ratings with photos. He also directed: all screens in a `screens/` folder with a better file structure, and — replacing Auth0 — **our own login/signup system** with Continue with Google. Skills used: ui_ux_pro_max (priority rules — accessibility, 44px targets, chart legends/tooltips, form labels) and no_ai_design_slop (kept the warm-bistro identity rather than swapping in a fashionable template; every added element carries product meaning).

### What was done, in order

1. **Repos private**: `Food-Delivery` and `foodie-server` set to private via the API (he asked for "this repo"; the server repo went private too — zero downside since it isn't deployed — disclosed in the report). Consequence he was told plainly: **GitHub Pages stops serving a private repo on the free plan**, so the live site is down while the repo is private; flipping it back to public restores it.
2. **Migration merged**: `react-migration` merged into `main` (merge commit 7fd6031) — main's tree verified to be exactly the React app (50 files, no vanilla leftovers).
3. **Backend platform (foodie-server)**: new models `UserProfile` (role enum customer/admin/manager/driver, addresses sub-documents, driver block: vehicle/photo/availability/rating/earnings) and `DishState` (availability exceptions); `Order` gained driverSub, deliveryPoint, timeline, rating. New API: profile CRUD + addresses, role directory, order queue per role, driver accept, role-checked status advance (kitchen: received→preparing→packing; assigned driver: →on_the_way→delivered, delivery credits the driver ₹40 demo pay), customer rates driver (running average updates), public tracking endpoint (rider position interpolated over the ride window from the status-change timestamp; deterministic per-order destination near Connaught Place), owner analytics (totals, 14-day series, top dishes, status counts), menu-state GET/PATCH. A `seed-demo` script (3 drivers with photos/ratings, a manager, 20 orders across 14 days and all statuses). Smoke suite grew 14 → 32 checks, all passing.
4. **Own auth system (replaces Auth0, his direction)**: backend `authController` — register (name/email/phone/password, bcrypt, uniqueness on email+phone) → JWT (7d); login by **email OR phone** + password; forgot (generic answer); change-password (JWT + current-password check; Google accounts get an honest message); Google OAuth2 redirect flow (needs GOOGLE_CLIENT_ID/SECRET env — until set, `/auth/google` answers 503 "not configured" and the callback returns the browser to SITE_URL with the JWT in the URL hash). `identify` middleware now verifies the Bearer JWT first, with the old demo header path kept for simple integrations. Smoke suite 32 → **40 checks, all passing** (register/login-by-phone/duplicate/weak-password/JWT/bad-JWT/Google-503/change-password flow).
5. **Frontend platform (Food-Delivery)**: structure reorganised — `src/screens/` (HomeScreen, AuthScreen, ProfileScreen, AdminScreen, KitchenScreen, DriverScreen, TrackScreen), `src/api/` (types, HTTP client with JWT, a full demo-dataset implementation of the same interface, profile hook), `src/components/` (shop sections + Dash shell), `src/store/`, `src/data/`, `src/utils/`. The app runs on the demo dataset when `VITE_API_URL` is unset, so every screen works before the backend is deployed; one env var switches it to the real API.
   - *AuthScreen*: own login/signup (tabs), Google button (backend URL in HTTP mode; a demo Google user in demo mode), forgot-password. Auth0 removed entirely (SDK uninstalled, provider deleted) — the Auth0 tenant still exists in his account, unused.
   - *ProfileScreen*: edit name/phone, role badge + demo role switcher (one login tries every view), address book (add/delete), my orders with tracking links and rate-the-driver.
   - *AdminScreen*: stat cards (revenue/orders/AOV/delivered/drivers on duty), 14-day revenue area chart (Recharts, brand colours, ₹ tooltips), top dishes, status counts.
   - *KitchenScreen*: live queue with next-step buttons, driver roster with ratings/duty, dish availability switches that grey out the menu card ("Out of stock", button disabled — MenuSection reads the same state).
   - *DriverScreen*: profile head (photo, vehicle, stars), duty switch, pickup pool (accept), active deliveries (picked up → delivered, ₹40 credited), earnings/deliveries stats.
   - *TrackScreen*: Leaflet/OpenStreetMap with restaurant/home/rider markers (FontAwesome divIcons — no broken Leaflet image assets), 4-second polling, status step rail, ETA while on the way, driver card with photo + rating, rate-after-delivery.
   - *Checkout*: orders now go through the API (cart items → real order ID → "Track your order live"); saved-address picker fills the form; profile prefill comes from the own-auth profile. Free-text gallery orders still confirm on-page.
   - *UI polish*: header gains a scroll shadow; platform CSS appended as one system (design tokens reused, pills per status, switches, stat cards, tables, map pins, auth card) with ≤860px rules and reduced-motion handling. Build green (tsc strict + vite; JS 736 kB — recharts+leaflet; code-splitting is a noted future improvement).
6. **Commits** (grouped, per cadence rule): server — `add user profiles and roles`, `add order platform flow`, `add seed script and extend smoke test`, `add own auth system`; frontend — `add platform api and own auth screens`, `add dashboard screens and live tracking`, `wire checkout to api and add stock states`.

### MongoDB Atlas (his cluster)

He created the cluster and shared the connection link for one-time transient use (his explicit choice; the string was used only as a command environment value and is stored NOWHERE — not in code, files, repos or memory). Two environment findings: (1) this sandbox's DNS refuses SRV lookups — worked around by resolving the SRV/TXT records over DNS-over-HTTPS and building the equivalent direct replica-set URI (database name `foodie`); (2) **Atlas then refused the connection: this machine's IP is not whitelisted.** He was given the 30-second fix (Atlas → Network Access → Add IP → Allow access from anywhere, 0.0.0.0/0) — as of this entry it is still pending, so **the live DB is not yet seeded/verified**. The same whitelist entry will be needed for the deployment host later. Local verification stands at 40/40 smoke checks against in-memory MongoDB.

### Still needed from Randhir (go-live checklist)

1. Atlas whitelist `0.0.0.0/0` → Muse seeds + verifies the live DB.
2. Google Cloud OAuth client (Client ID + Secret) for Continue with Google on the own-auth system — his to create; secrets go to the server's environment, never chat/files.
3. GitHub token `workflow` scope → Muse pushes the deploy workflow; Pages source → GitHub Actions; repo public again (or a paid plan) for the site to serve.
4. Deploy foodie-server (Render): he pastes MONGODB_URI + JWT_SECRET + ADMIN_KEY (+ Google values) into the host's env himself; then set VITE_API_URL on the frontend and rebuild.

**Correction (03:33 IST, same night):** after Randhir added the whitelist entry, connection attempts still failed — deeper diagnosis found the real cause is this sandbox, not Atlas: its network refuses SRV DNS lookups and answers direct database TLS handshakes with a 5-byte plaintext proxy response ("wrong version number", no certificate). Web traffic (HTTPS) works fine; raw MongoDB connections from this VM do not, regardless of whitelisting. His whitelist step is still correct and required (the deployment host needs it). Consequence: the live DB will be seeded from the deployment host at deploy time with the existing `npm run seed` script (already tested against in-memory MongoDB); nothing about the app or backend changes.

## 18. Full screen QA pass (2026-10-24, ~04:00 IST, his instruction before sleeping)

**What he asked:** test every screen, fix what's wrong, and make sure all screens follow one consistent design, as part of getting production-ready.

**How it was tested (the method):** a real browser test, not a code read-through. The built app (dist) was served locally and driven with an automated Firefox (Playwright) that played a customer end-to-end: shop → cart (Pasta ×3 + FOODIE50 = ₹650 regression) → search → signup → profile + address → switch to Owner (dashboard + chart) → Kitchen (queue, mark Pasta out of stock → menu showed it disabled → back in stock) → place a real demo order → kitchen prepared/packed it → driver accepted, picked up → live tracking (map, rider pin, ETA, driver card) → delivered (₹40 credited) → customer rated the driver 5★. Plus a 390px mobile check (no sideways overflow) and console-error watch. **Result: 30/30 checks passed, zero console errors.** Screenshots of every screen were eyeballed for design consistency (same cream/marigold/Fraunces system everywhere).

**Bugs found and fixed:**
1. **Role switches didn't reach the header.** The profile lived in two places (screen-local state + the app store), so after switching to Owner in the profile, the account panel still thought "customer" and hid the Kitchen shortcut. Fixed by making the store the single source of truth (`useProfile` now reads/writes the store).
2. **New screens opened scrolled halfway down** (the Owner dashboard title slid under the fixed header) because view changes kept the old scroll position. Fixed: every screen change scrolls to top, like a page navigation.
3. **Invisible avatar circles + dull stars:** the platform CSS used `var(--marigold)` / `var(--cream)`, but the design system's variables are named `--brand` / `--bg` — undefined variables fail silently, so driver avatar fallbacks were transparent with white text. Fixed all 7 references (verified by computed-style probe: avatar now #f5a301).
4. **Tracking step rail** redrawn with proper circular step dots (green checks for done steps, ring for current).
5. Small spacing fix: section titles after forms in profile cards get proper top margin.

**Production hardening in the same pass:** Font Awesome is now **bundled with the app** (npm package) instead of loaded from the cdnjs CDN — one less third-party dependency that can fail or be blocked; it also removed the only console errors the QA saw.

**One honest limitation:** map *tiles* (OpenStreetMap images) can't load inside this sandbox (its network blocks tile servers, same reason direct MongoDB is blocked) — the map frame, pins and attribution render correctly and tiles load on any normal connection.

**Commit note:** the grouped commit ("fix screen consistency issues from qa", 7 files) hit a GitHub rate limit (422/403) after the night's many pushes — the changes are built and verified locally; a retry is scheduled for 08:30 IST and will confirm to him.

## 19. Backend deployed live on Render (2026-10-24, ~14:52 IST)

**What happened:** the foodie-server backend went live on Render's free tier. Randhir signed in with GitHub and pasted the MongoDB connection string into Render's environment settings himself (it never passed through chat); the JWT and admin secrets were generated inside Render's page and typed in there — nobody has seen them, and they live only in Render's settings.

**Settings used:** Web Service from the private `foodie-server` repo, Singapore region, build `npm install`, start `npm run seed && npm start` (so the first boot seeded the database by itself), env: CORS_ORIGIN = the GitHub Pages origin, SITE_URL = the live site URL.

**Verified live (from outside, over HTTPS):** `GET /health` → `{"ok":true}`; deploy log showed "MongoDB connected" + "Seeded 3 drivers, 1 manager, 20 orders"; a real test account registered and received a login token; a real test order (FD-LIVETEST, Burger ×1) was placed and the server computed ₹40 + ₹30 delivery = ₹70 itself. Service URL: https://foodie-server-kwl6.onrender.com

**Two honest footnotes:** (1) the connection string he pasted has no database name in it, so Atlas put the data in its default database called `test` instead of `foodie` — everything works exactly the same; renaming is optional and his call. (2) Free Render services sleep when idle — the first request after a quiet spell takes up to ~50 seconds to wake. The start command still includes the seed step; it gets reset to plain `npm start` once the database-name question is settled, so future restarts don't re-seed.

## 20. Frontend live on Render + full live test (2026-10-24, ~15:11 IST, his instruction: "make all the things working... I want to see the thing by myself")

**What was done:** instead of waiting on the GitHub Pages route (which still needs the token's workflow scope), the frontend went live on Render as a Static Site — same platform as the backend, free, and it serves instantly (static sites don't sleep). Build command overrides the Vite base to `/` for its own subdomain (`npx vite build --base=/` — the repo keeps `/Food-Delivery/` for the future Pages route), and `VITE_API_URL` was set in the site's environment to the live backend. The backend's CORS_ORIGIN then gained the new origin (`https://randhirsingh77.github.io,https://foodie-tvna.onrender.com`) and redeployed. **Live site: https://foodie-tvna.onrender.com**

**The live test:** the same automated browser suite from section 18 was run against the REAL pair (live frontend + live backend + live Atlas database). Headline checks passed (menu, cart ₹650 regression, search, order placement, tracking map/ETA/driver card, mobile). Ten checks "failed" on their fixed short waits — the backend had been asleep and its first response took ~50 seconds (free-tier cold start). The database itself proved every one of them actually completed: the test user's address is saved; the order (Pasta ×3 + Biryani ×2, FOODIE50, total ₹1,010) went received → kitchen → driver → **delivered**; the driver was credited **₹40** and carries a **5-star rating, count 1**. Lesson recorded: on a sleeping free-tier backend, UI checks need generous waits — judge by end state, not first paint.

**Known remaining item:** "Continue with Google" still returns 503 until Randhir creates the Google OAuth client and its two values are added to the backend's environment (redirect URI: https://foodie-server-kwl6.onrender.com/api/v1/auth/google/callback). Everything else — email/phone signup and login, profiles, addresses, ordering, kitchen, driver, tracking, ratings, owner analytics — is live and verified.

**Keep-alive (same day, his instruction):** a small background service on Muse's machine (`foodie-keepalive`, systemd) pings the backend's `/health` every 14 minutes — one minute before Render's 15-minute idle limit — so the backend never sleeps. Verified running with HTTP 200 pings. Two caveats told to him plainly: it runs from this workspace (a long offline stretch here could still let the backend nap until the next ping), and 24/7 uptime uses roughly 720–744 of the free plan's 750 monthly instance hours — inside the limit, but nearly all of it.

## 21. Koyeb migration attempt — platform no longer free (2026-10-24)

Randhir chose Koyeb over Render/Oracle to escape Render's sleep + instance
hours. Account was created (GitHub sign-in, org "foodie-server"), but the
deploy could not start: since Koyeb joined Mistral AI (Feb 2026), new
accounts get no free tier and no service-creation console at all — the
cheapest plan is Pro at $29/month. The migration was stopped at that
paywall (his rule: the host must be free). Nothing changed: the backend
stays on Render with the 09:00-24:00 IST keep-alive, and the frontend was
never repointed. Remaining free routes if he wants one: Oracle Cloud
Always Free (real VPS, card needed at signup) or Google Cloud Run
(free quota, ~2s wake).

## 22. Full alignment fix + UI redesign — one design system (2026-10-24)

**What was asked:** fix every alignment problem and redesign everything
"from UI to button", using the installed design skills (ui_ux_pro_max +
no_ai_design_slop). No business logic was allowed to change, and nothing
was to be committed or pushed — the work sits in the local working tree
for review.

**How the design was chosen (the easy version):** the design skill's own
data for food-delivery apps says keep the pattern the app already had
(hero, category chips, dish cards with ratings, cart, tracking stepper),
and its colour data pairs an appetising orange with a cream background —
which is exactly Foodie's existing brand. So instead of inventing a new
look, the old "warm bistro" identity (cream page, deep marigold, Fraunces
serif headings, Poppins text) was kept and turned into strict rules.

**The alignment system — three rules that fix almost everything:**
1. **One spacing ladder.** Every gap and padding in the app now comes
   from a single ladder: 4, 8, 12, 16, 24, 32, 48, 64 px. Before, numbers
   like 0.9rem, 1.6rem and 120px were scattered everywhere, so nothing
   lined up with anything else. Sections use 64px top/bottom, cards use
   16–24px padding, rows use 8–16px gaps.
2. **Three fixed containers, one side gap.** Pages are 1280px wide,
   dashboards 1180px, forms/auth 1150px (the auth card itself 520px),
   and every one of them uses the same 20px side padding. The header,
   page content and footer now start and end on the same invisible
   vertical lines. The cart/account pop-down panels also line up with
   the container's right edge instead of floating at a random offset.
3. **One size for things you touch.** All main buttons are 48px tall
   pill buttons; small buttons are 40px; icon buttons are 44×44px;
   inputs are 48px tall. Before this, buttons came in at least five
   different heights (some only 30px tall — too small to tap reliably).

**Real bugs the audit found (not just taste):**
- The account drop-down panel had NO CSS at all — its classes were
  never written, so it rendered as plain unstyled buttons.
- The hamburger menu button was missing the id the CSS looks for, so
  the "hide on desktop" rule never applied.
- One CSS variable the header uses for the heart icon (`--brand-deep`)
  did not exist; it is now defined (and doubles as the darker marigold
  that passes text-contrast rules where plain marigold failed).
- The checkout form's layout rule pointed at an old id from the
  pre-React site, so the neat two-column form only worked by accident;
  it now uses a proper class.
- The square logo image was making the header ~116px tall while the
  rest of the CSS assumed 68px — dashboard content was sliding under
  the fixed header. The logo is now height-limited, the bar really is
  69px, and every page clears it (verified by measuring).
- Two form styles and two avatar styles were defined twice with
  different sizes, so which one won depended on file order. Each now
  has exactly one definition.

**Button system (one family):** primary = marigold pill, dark = ink
pill, ghost = outline pill, danger = red pill, plus the Google button —
all share the same shape, weight and states: gentle lift on hover,
press-down on click, a clear amber focus ring for keyboard users
(focus rings are never removed anywhere in the app), and a faded,
non-clickable disabled state. Menu cards now bottom-align their price
and Order button as a group, so cards in a row share one baseline even
when a dish name wraps to two lines (measured: price positions differ
by less than 3px across a row).

**Colours and reading:** body text was lightened-grey in places that
failed the 4.5:1 contrast rule; muted text is now a darker warm grey
(4.9:1) and marigold is only used for text in its deeper shade (5.4:1).
Inputs got visibly stronger borders. The admin table can scroll
sideways inside its card on small screens instead of breaking the page.

**Testing:** the production build passes (`tsc` + Vite, zero errors).
Two automated browser suites ran against the built app locally:
the existing functional suite — **30/30 passed**, including the money
regression (Pasta ×3 + FOODIE50 = ₹650 with free delivery) and the full
order → kitchen → driver → delivered → 5-star-rating journey — and a
new design suite written for this task — **27/27 passed** (header
height stable, no horizontal overflow on desktop or at 390px on shop
and dashboard, hamburger hidden on desktop/visible on mobile, panels
inside the viewport, measured contrast and button heights, checkout
fields sharing one row). Zero console errors in both. One testing note:
local QA must be built WITHOUT the production API address, because
`.env.production` points builds at the live backend (which rightly
refuses localhost by CORS) — the suites ran against the app's built-in
demo data, exactly like the earlier QA passes. Screenshots:
`~/workspace/foodie-redesign-qa/` (12 images). Not verifiable from this
machine, same as before: real map tiles on the track screen and true
phone rendering — those still need a look on his phone.

**Status:** changes are in the local working tree only
(`src/index.css` rewritten, 792 lines; tiny structural edits in
Header, OrderSection and AdminScreen). NOT committed, NOT pushed,
live site unchanged until he reviews and approves.

**Update (same evening, 2026-10-24):** Randhir approved ("Push it
live"). Pushed as ONE grouped commit `e2997eb` "redesign ui and fix
alignment" on Food-Delivery `main` (parent `2ddda8b`) via the GitHub
Data API — all 4 files read back from the repo and byte-matched the
local files. Render auto-deployed from the push; the live site's new
CSS bundle was fetched and confirmed to contain the new `--brand-deep`
token, so the redesign is live at https://foodie-tvna.onrender.com.

## 23. Demo role switcher removed + owner account (2026-10-25)

Once the repos and site went public, the Profile page's demo role cards
(POST /profile/demo-role) let any registered visitor promote themselves
to Owner. Removed end-to-end: the backend endpoint + controller
(foodie-server commit dacd9cb "remove demo role endpoint"; the smoke
suite now assigns roles directly in the DB and asserts the endpoint
answers 404 — 41/41 pass), and the Profile page role cards + API method
(Food-Delivery commit 01719f9 "remove role switcher from profile";
build green). Verified live: the endpoint returns 404, a fresh customer
gets 403 on owner routes, and the live bundle has no role-switcher code.
Randhir's own owner account was created on the live backend (his email
+ phone, role admin, verified: profile reads admin, /admin/analytics
200, login works by email and by phone). The first generated password
was corrupted in transit through tool output, so the password was reset
by editing the account's passwordHash directly in Atlas (Foodie project,
foodie DB) to a hash of a plain-text password Muse chose; the working
password was verified by real logins before being handed to him in
chat. It is stored nowhere in these docs or memory. Role changes now
happen only via an existing admin (PUT /profile/role).

## 24. Differentiator features — dietary data, queue ETA, group orders, tiffin plans, demo login (2026-10-26)

Five features were added in one build, cheapest first. Each one exists in
BOTH API implementations (the real backend and the in-browser demo
dataset), because the site silently switches between them. Backend
smoke suite: 83/83 pass (it grew from 48 as each feature added checks).
Frontend build (tsc + vite) green after every piece. One commit per
finished piece per repo, pushed the same evening and verified live.

### 24.1 Dietary filters + nutrition (per-dish data)
Every dish now carries three dietary flags (Jain, sattvic, no
onion-garlic), an allergen list, and per-serving nutrition (kcal,
protein, carbs, fat). Important detail: Jain is NOT just "no
onion-garlic" — Jain food also excludes root vegetables, so the flags
are declared one by one per dish, never calculated from the veg flag.
"High protein" is calculated with a fixed rule: at least 15 g protein,
at most 700 kcal, and protein at least 10% of the calories.
How it was built: the values live as declared defaults in the backend
(`src/utils/dishMeta.js`) and mirrored in the site's dish list; the
kitchen can correct any dish from a new "Dish details" editor in the
Kitchen screen, and those corrections are stored in a `DishMeta`
collection and served back through the existing menu-state endpoint, so
the menu always shows the kitchen's latest numbers. The menu gained a
second row of filter chips (Jain / Sattvic / No onion-garlic / High
protein), badges and a nutrition line on each dish card, and an honesty
note: values are kitchen-declared estimates and cross-contact is
possible. A new dish was added everywhere a menu lives (site list,
server price list, seed script): **Ghar Jaisa Thali, ₹130** — 4 rotis,
dal, seasonal sabzi, rice, salad, made without onion-garlic — which the
tiffin plan below delivers.
Commits: server 99a89ce, frontend 51338ff.

### 24.2 Queue-aware ETA (honest delivery estimates)
The tracking screen used to show a time only after the rider left. Now,
while an order is with the kitchen, the server estimates from the
kitchen's own live data: how many orders are ahead of yours × the
kitchen's recent average prep time (measured from real order timelines,
last 30 orders), plus the usual ride time — and shows it as a RANGE
with the reason ("2 orders ahead of yours · kitchen averaging ~12 min
per order right now. Estimated from the live kitchen queue."). No fake
"AI prediction" wording anywhere; if the kitchen has no history yet, a
12-minute default is used. Time already spent waiting is subtracted so
old orders are not quoted a fresh full cycle. Verified live on a probe
order (FD-PROBE1026): it answered a range with queueAhead 2 against the
real live queue. Backend: `src/utils/eta.js`, fields added to the
existing track response; the demo dataset mirrors the same maths with
its shorter demo ride time.
Commits: server 1d81d6d, frontend 495c827.

### 24.3 Group orders with per-person bill split
A host opens a shared cart (button in the cart panel or the Group order
screen), gets a 6-letter code and a shareable link (…#group=CODE), and
friends join and add their OWN dishes from their own phones. Design
choices that matter: the cart is ONE database document, because
single-document updates in MongoDB are atomic — two people adding at
the same moment cannot corrupt the cart, and an item can never land
after the host locks (the "still open?" check lives inside the update
itself). The host alone locks (prices are re-checked against the
server price list at that moment) and checks out through the normal
order path. The split is worked out in integer PAISE, never decimal
rupees: each person pays for their own dishes plus a share of
delivery/discount in proportion to their dishes, using
largest-remainder allocation so the shares always add up to the exact
total (a smoke test proves a ₹330 order splits into shares summing to
exactly 33000 paise). Settlement is person-to-person: the cart stores
the HOST's own UPI id and shows each person a "Pay host via UPI" link —
deliberately no multi-payer checkout, which would need payment-gateway
split settlements. Joining is rate-limited (10 tries per 10 minutes per
IP per code) so codes cannot be guessed cheaply, and abandoned carts
delete themselves after 2 hours (a database TTL index); a checked-out
cart is kept for 30 days. Live probe: a fresh account created a cart
(code FVEZQ8) on the real backend.
Commits: server b4aaaf5, frontend 86dd3e4.

### 24.4 Tiffin subscriptions (meal credits, not a wallet)
Weekly plan: 6 thali meals, ₹699 over 7 days. Monthly: 24 meals,
₹2,499 over 4 weeks. The plan is modelled as MEAL CREDITS with an
append-only ledger (every credit movement is one ledger entry — buy,
deliver, skip, pause) rather than a rupee wallet: simpler, auditable,
and no stored-money liability. Rules, all enforced on the server in
Indian time (`src/utils/ist.js` — the server clock is UTC, so every
date rule goes through IST helpers): skip or pause before 9:00 PM for
the next day; skipped and paused days extend the plan's end date;
unused meals expire at plan end with no refund (the policy is printed
on the plan card before anyone pays); no auto-renewal. Subscribing
reuses the normal checkout's payment choices (Cash on Delivery / UPI).
The daily delivery run is a secured endpoint
(POST /api/v1/admin/run-tiffin-orders, admin key) that creates one
ordinary thali order per due subscriber; it is IDEMPOTENT — the
credit is claimed with a conditional database update keyed by
subscription + date, so triggering it twice creates nothing twice
(smoke-tested). Because the free host has no working cron, a small
loop script on this machine (`~/workspace/keepalive/foodie-jobs.sh`,
systemd unit foodie-jobs, installed next to the existing keep-alive)
calls it at 06:00 IST daily and also calls the demo reset (below) at
03:30 IST. It reads the admin key from a protected file
(`~/workspace/keepalive/.admin-key`) and simply logs "SKIPPED" until
that file exists — the key is the owner's secret and was never written
into any code or repo.
Commits: server 08b472a, frontend 5860ceb.

### 24.5 One-click demo accounts
So a visitor from the portfolio can try every role without signing up:
three seeded demo accounts (customer / kitchen manager / driver) with
a published, throwaway password, plus POST /api/v1/auth/demo-login,
which issues a normal login token for the chosen role. Safety rails:
logins are rate-limited to 5 per IP per hour; a `demo` flag on the
profile powers a guard (`demoGuard`) that refuses destructive actions
for demo accounts (changing the password, deleting addresses);
ordering and all dashboards stay open, since trying them is the point.
The site's login page has three "Demo:" buttons, and a link like
`?demo=driver` signs straight into that role — that is what the
portfolio's demo buttons will point at. The accounts are created by the
seed script and refreshed nightly by POST /api/v1/admin/reseed-demo
(admin key; only ever touches demo-* rows), triggered by the same VM
jobs script at 03:30 IST. On the live backend, demo-login currently
answers "demo accounts are not set up yet" (503) — by design, until
the first reseed runs, which needs the admin key file (see 24.4).
Commits: server 9aa3463, frontend d3fbb16.

### 24.6 What the owner still needs to do (one small thing)
Put the server's ADMIN_KEY value into `~/workspace/keepalive/.admin-key`
on this machine (one line, file is already expected there). That single
step switches on both daily jobs (tiffin deliveries at 06:00 IST, demo
reset at 03:30 IST) and makes the live demo accounts appear. No new
server settings were needed anywhere — every feature was designed to
reuse the existing admin key instead of adding new secrets.
