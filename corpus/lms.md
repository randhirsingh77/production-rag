# LMS — project document

Randhir's own course-selling platform. Frontend: React + Vite on Vercel
(https://lms-seven-gold.vercel.app, auto-deploys from the `lms` repo's
main branch). Backend: Express + MongoDB on Render
(https://lms-m5d0.onrender.com, service "lms", root dir `server`,
auto-deploy on commit). Payments: Stripe checkout + webhook.

> Note (2026-10-26): the original version of this document was wiped by
> a sandbox storage fault that intermittently truncated files on write.
> This file was rebuilt the same day from the verified records of each
> work round (memory notes, commit history and live probes). The code
> itself was never lost — it is all on GitHub in randhirsingh77/lms.

## Bug hunt and access-control fixes (2026-10-25)

Randhir tested the live site and reported five problems. Each was
reproduced first, then fixed in the code:

1. **Reset Password was missing** from the navbar avatar menu. Added it
   (to the avatar dropdown and the mobile menu), pointing at the
   existing /change-password page.
2. **Instructor-only data leaked to any logged-in user.** The write
   endpoints were already owner-checked, but several read endpoints
   were not: unpublished courses could be read by id; lecture lists and
   videos were readable for any course; the course-detail-with-status
   response included every lecture's video URL even for non-buyers;
   the four course-progress handlers answered strangers; students
   could create courses through the API; a lecture could be edited
   into a different course; orphaned lectures could be deleted by
   anyone; checkout happily sold unpublished courses (masked as a
   Stripe 500); and search results embedded the enrolled-students
   buyer-id list. All of these were closed with owner/enrolment
   checks, clean 404/403 answers, and field filtering.
3. **Category filter** was verified correct in the current code — the
   live symptom came from the old server still running (see the
   deploy gap below). One real client defect was fixed: a failed
   search was rendered as "Course not found"; it now shows a distinct
   "Search failed" state with retry.
4. **Profile update:** a failed photo upload used to surface as a
   generic "Failed to update profile" and leaked the temp file. It
   now returns a specific message and cleans up (same fix for course
   thumbnails).
5. **Instructor-profile click-through** was verified working in the
   current code; its live failure was also the old server.

Verification: a reproduction suite went from 43/67 before the fixes to
67/67 after; a second suite passed 70/70; build and lint green.
Pushed 2026-10-25 as two grouped commits: dbd11f7 "fix access control
and upload errors" (server) and 45d9ab7 "add reset password menu and
fix search state" (client).

Known leftovers, documented but not fixed (architecture changes, his
call): logout does not invalidate the stateless JWT server-side, and
there is no delete-course endpoint. On the live server, SECRET_KEY is
shorter than the recommended 32 characters and SMTP settings are
unset, so forgot-password emails cannot send until he adds them.

## The deploy gap, closed (2026-10-26)

For days the live site behaved as if the fixes did not exist: the
Vercel frontend redeployed on every push, but the Render server never
picked up the new commits, so the new frontend kept talking to the old
server (that is why signing up as an instructor "failed" yet created
a student account — the old server ignored the role and returned no
session). On 2026-10-26 the Render service was manually deployed at
his go (deploy of commit 60e8981) and verified live: /health 200,
instructor signup returns the instructor role with a session cookie,
login no longer leaks the password hash. FRONTEND_URL and auto-deploy
turned out to be set correctly already; why the earlier pushes never
deployed remains unexplained.

## Round F — responsive + loading overhaul (2026-10-26)

His complaints: footer wrong on phone, Featured Courses misaligned at
desktop widths, the loading spinner looked off, and the footer appeared
on the signup/login pages. Done:

- Footer is hidden by route on /login, /signup, /forgot-password,
  /reset-password, /change-password and the whole /admin area. On
  phones it stacks as 40px tap rows.
- The hardcoded blue "Loading, Please wait....." spinner was replaced
  by a shared PageLoader (graduation-cap mark, app name, small primary
  spinner, theme colours, respects reduced-motion). List skeletons
  were verified under a slowed API rather than rebuilt.
- Featured Courses cards got fixed 16:9 thumbnails at every width,
  plus a muted book-icon tile for missing/broken thumbnails — the
  uneven thumbnails, not the cards, were the real cause of the
  desktop misalignment.
- The search filter card collapses behind its "Filter Options" header
  below the md breakpoint, with 40px category rows.
- Tab title fixed from "Vite + React" to "E-Learning"; course
  descriptions can no longer be pushed wide by huge tables, images or
  links.

Verification: a responsive suite passed 208/208 across 360/390/768/
1024/1440 widths (no horizontal overflow, no console errors, dark
mode included); smoke 48/48, qa-browser 22/22, qa-metrics 20/20,
qa-auth 27/27; client build and ESLint green. Before/after screenshots
are the 60-* files in ~/workspace/lms-admin-qa/.

## Round G — roster leak + upload atomicity (2026-10-26)

A follow-up hunt against the same live reports found two more real
defects, both fixed:

- The enrolled-students buyer-id roster was still leaking through
  detail-with-status and GET /course/:id. It is now stripped; the
  payload sends enrolledCount instead.
- updateProfile and editCourse deleted the old Cloudinary asset
  BEFORE uploading the new one, and a failed upload threw away all
  other field edits with a 500. They now upload first, save the text
  fields regardless (with the specific error), delete the old asset
  only after success, and clean temp files on every path.

Round G's own test suites were written but could not run while the
sandbox storage fault was killing the test database — worth a re-run
when the environment is healthy.

Rounds F + G were pushed 2026-10-26 at his go as two grouped commits:
2a48391 "fix responsive layout and loading state" (Round F) and
7c00f76 "fix enrollment roster leak and upload failure handling"
(Round G). Verified: remote head 7c00f76, live Vercel title
"E-Learning", PageLoader present, old spinner file gone.

## Payment confirmation fix — verify-on-return (2026-10-26)

His report: after a successful Stripe payment, the course page sat on
"Confirming your payment…" instead of opening the course.

How it worked before: paying at Stripe does not itself unlock the
course. A Stripe webhook has to reach the server to mark the purchase
completed, and the progress page polled for about 10 seconds waiting
for that. On Render's free tier the server sleeps when idle, so a
webhook arriving at a sleeping server is held up ~50 seconds while it
wakes — and if Stripe's first delivery times out, retries are spaced
far apart. The page gave up long before the purchase completed. A
live probe confirmed the webhook endpoint itself is configured and
healthy (it verifies signatures and answers in ~0.4s when awake), so
the delay was the wake-up race, not settings.

The fix removes the race for the normal flow:

- The Stripe success URL now carries the checkout session id back to
  the progress page (?checkout=success&session_id={CHECKOUT_SESSION_ID}).
- New authenticated endpoint POST /api/v1/purchase/checkout/verify-session:
  it asks Stripe directly whether that session was paid, checks the
  session's metadata belongs to the signed-in user (one account can
  never complete a purchase with another account's session), and if
  paid, completes the purchase through completePurchase() — a helper
  now shared with the webhook, so both paths do exactly the same
  enrollment steps and are idempotent (racing them is safe).
- The progress page fires the verify call once on arrival, then
  refetches; the existing polling stays as a fallback.

Result: enrollment lands in about a second after returning from
Stripe instead of waiting on webhook timing. The webhook remains the
backstop for buyers who close the tab before returning.

Tested locally before the push decision: client build green; the
endpoint answers 401 without login, 400 for a malformed session id,
and a clean "could not verify" (no hang, no enrollment) when Stripe
cannot confirm. The completion helper is the same code path the
webhook suites already verified (a replayed webhook enrolls exactly
once).

Pushed at his go as d213e81 "fix payment confirmation delay" and
verified live the same evening: the Vercel bundle contains the new
verify call, and after a manual Render deploy (auto-deploy did not
fire — see below) the endpoint answers 401 instead of 404 and
/health is 200.

DEPLOY NOTE: Render's auto-deploy did not fire for ANY of the
2026-10-26 pushes — before the manual deploy, the live server was
still on 60e8981, so the manual deploy to d213e81 also carried the
Round G server fixes live for the first time. If future server
changes don't appear live within a few minutes of a push, use
Render → lms service → Manual Deploy → Deploy latest commit.

## Verifiable certificates (2026-10-26)

Goal: a student who finishes a course gets a certificate that anyone
(an employer, a recruiter) can check is real — most course sites just
hand out a PDF, which anyone can fake in five minutes.

How it was built:

- The certificate is a record on the server, not a file. Each record
  gets a random unguessable ID (a UUID), the student's name, the
  course title and the instructor's name frozen at the moment of
  issue (so a later name change cannot rewrite an old certificate),
  the issuer name "E-Learning", and a revocation flag.
- A public page at /verify/<id> needs no login. It looks the record up
  and answers clearly: valid, revoked, or no such certificate. The
  record also stores a keyed checksum (HMAC) of its contents; the
  verify endpoint recomputes it, so a record edited directly in the
  database would fail its integrity check instead of showing "valid".
  The checksum secret is optional — if CERTIFICATE_HMAC_SECRET is not
  set, the existing login secret is used, so nothing new HAS to be
  configured and the server can never fail to boot over it.
- The printable certificate page shows a QR code that encodes only
  the verify URL. Scanning it shows the LIVE status, so even an old
  printout of a revoked certificate fails verification.
- Who earns one: the important design decision. The old "Mark as
  completed" button used to mark every lecture as watched, which
  would have let anyone mint a certificate in one click. The button
  still exists as a personal marker, but it no longer touches the
  watched records. Certificates are issued only from the real
  per-lecture watched records (plus quiz passes — see below), checked
  by one shared eligibility function on the server.
- The course's instructor can revoke a certificate (issued in error,
  for example); students see their certificates in My Learning and on
  the course progress page, where a "Claim your certificate" button
  appears once every lecture is watched.

Verified with an automated probe (21 checks) against the real server
booted on a throwaway database: refusal before watching, the
mark-as-completed exploit failing, issue after watching, re-issue
returning the same certificate, public verify, revoke flow, and
non-enrolled/unauthenticated refusals. Pushed as 1cd4681 "add
verifiable certificates" (server part needs a Manual Deploy on Render
to go live — see the deploy note above; the client went live on
Vercel automatically).

## Timestamped doubts (2026-10-26)

Goal: when a student is confused at one exact moment of a video, they
should be able to ask about THAT moment — normal course Q&A only
attaches a question to a whole lecture.

How it was built:

- Each doubt stores the course, the lecture, the second in the video
  (timestampSec), and the video's total length at ask time
  (videoDurationSec — if the instructor later replaces the video with
  a different-length cut, the doubt can be spotted as possibly stale
  instead of silently pointing at the wrong moment).
- In the player page, an "Ask at mm:ss" box reads the current second
  straight from the video element — the student never types a
  timestamp. The doubt list is sorted by timestamp, so it doubles as
  a map of the moments students found hard. Clicking a doubt's
  timestamp seeks the video back to that second.
- Access uses the exact same enrolment check as course progress:
  only enrolled students and the course creator can read or post.
  Bodies are plain text (no HTML is ever trusted).
- Students can reply and upvote ("Me too" instead of asking a
  duplicate). When the course creator replies, the doubt is marked
  answered automatically. The creator can close/reopen doubts and
  delete spam; authors can delete their own.
- Instructors get a "Doubts inbox" page in the admin sidebar: every
  doubt across their courses, open ones first, with the course,
  lecture and timestamp, answerable in place.

Verified with an automated probe (26 checks): posting, sorting,
enrolled-only access, validation, upvote toggling, inbox contents,
the auto-answered rule, status permissions and deletion rules.
Pushed as 72a964e "add timestamped doubts" (server part needs a
Manual Deploy on Render).

## Per-lecture quizzes (2026-10-26)

Goal: a short quiz on a lecture, so completion means something —
without annoying students on lectures that have no quiz.

How it was built:

- The instructor authors a quiz inside the lecture edit screen
  (questions, 2–6 options each, the correct option, an optional
  explanation, and a pass mark, default 70%). Saving is checked on
  the server for ownership — only the course's own instructor can
  add a quiz to it.
- The classic security rule: correct answers NEVER reach the
  student's browser before submitting. The student endpoint rebuilds
  each question without the answer fields, the server scores the
  submission itself, and only the result includes the correct answers
  and explanations. Retakes are unlimited.
- Gating is deliberately gentle: watching is never blocked, and a
  lecture without a quiz blocks nothing. The one firm gate is the
  certificate — issue requires a passing attempt for every lecture
  that has a quiz (the eligibility function was extended to check
  this).
- Lecture progress entries now record WHEN a lecture was first
  watched (viewedAt). Older entries have no timestamp and are not
  backfilled — this is what the public profile's streaks count from.
- A demo showcase was seeded by a new script
  (server/scripts/seed-demo.js, `npm run seed:demo`): a demo
  instructor, a demo student enrolled directly (never through
  checkout), and a published "Demo Course: Web Development
  Foundations" with 3 lectures, each with a drafted 4-question quiz.
  The script is safe to re-run — it rebuilds only the demo course.
  Demo logins: demo.instructor@example.com / demo.student@
  example.com, password DemoPass123! (throwaway demo accounts).

Verified with automated probes (23 checks for quizzes, including
the no-answer-leak check and the certificate gate; 11 checks for the
seed, including idempotency and logging in as the demo student).
Pushed as afd5c84 "add per-lecture quizzes and demo course seed"
(server part needs a Manual Deploy on Render; run the seed once
against the live database to create the demo course there).

## Public skill profile (2026-10-26)

Goal: a student can share one link that shows what they actually
finished — completed courses, verified certificates, quiz scores
and learning streaks.

How it was built:

- Strictly opt-in: the profile is off by default, and while off the
  public address answers 404, the same as a wrong link. Turning it
  on (Profile page → "Public skill profile") generates a random
  unguessable link slug — never the student's name or email, so
  profiles cannot be enumerated. Turning it off and on again keeps
  the same link.
- The public page at /u/<slug> shows the student's name and photo,
  completed courses (a course counts as completed only when every
  lecture has a real watched record), each course's certificate
  linked to its public verify page, and quiz averages — unless the
  student switches "Show quiz scores" off, in which case no scores
  are sent at all.
- Streaks are computed in the Asia/Kolkata timezone from real
  activity: a day counts when a lecture was first watched or a quiz
  was passed. The page states plainly that streaks count from when
  activity tracking began (older progress has no timestamps).
- Privacy is enforced on the server by building the payload field by
  field: email and phone are never included, in any state of the
  toggles.

Verified with an automated probe (21 checks): auth required for
settings, 404 before enabling and after disabling, slug shape and
stability, course/certificate/score display, score hiding, and the
no-email/no-phone payload checks. Pushed as b6ca285 "add public
skill profile" (server part needs a Manual Deploy on Render; the
client went live on Vercel automatically).

## Navigation fixes — one hamburger, aligned menus (2026-10-27)

Two small things that looked broken, both with plain causes:

- A teacher in the admin area on a phone or narrow window saw TWO
  hamburger (three-line) buttons at once. There were two separate
  mobile menus: the main navbar's menu button (shown to everyone
  under 768px) and a second bar built into the admin sidebar ("Instructor
  admin" + its own menu button, shown under 1024px) that opened a
  duplicate of the same admin links and wasted a full row of screen.
  The fix deleted the sidebar's bar and folded the admin links into
  the one navbar menu for instructors — exactly one hamburger for
  every role now. The desktop sidebar is unchanged.
- In the navbar's profile dropdown and mobile menu, "Reset Password"
  was the ONLY item with an icon in front of it, so its text sat
  pushed ~24px right of every other item and looked misaligned. (The
  Reset Password row on the Profile page itself was always fine —
  icon, label, and arrow in line with its neighbours — and was left
  untouched.) The fix removed that one lone icon from the two menus
  so all items line up.

Pushed as 53941eb "fix navigation menus".

## Full redesign — one design system for every screen (2026-10-27)

The app already had a good foundation (Tailwind v4 design tokens,
dark mode, shared UI components), so the redesign rebuilt the look
ON that system instead of starting over:

- Real typography: the app used to fall back to system fonts. It now
  loads two proper webfonts — Fraunces for headings/display and
  Public Sans for body text — self-hosted with the app.
- One refreshed colour palette in the theme tokens (light and dark),
  with text contrast mechanically script-checked at 4.5:1 or better
  for every foreground/background pair in both modes.
- Consistency fixes across all 23 screens: ONE page container width
  for student and admin areas (they used to differ), one shared
  page-header/empty-state system (two competing copies were merged
  into one), the Change Password page moved into the normal signed-in
  app shell (it oddly used the login-page shell), and one video
  player approach — the native browser player everywhere, replacing
  a second library player that only the course-preview used.
- Every screen was then brought onto the refreshed system: same
  headers, spacing rhythm, cards, empty states, and loading
  skeletons, in light and dark mode.

Pushed as c9c8086 "redesign screens"; the client build is clean and
the contrast check is scripted, not eyeballed.

## Proctored tests — integrity logging (2026-10-27)

A standalone Test section: teachers build tests for a course
(questions, duration, pass mark, warning limit), students take them
in a dedicated full-screen test screen, and the system watches for
the things a web page can honestly watch for:

- Before starting, the student sees a consent screen that lists
  exactly what is logged, and must agree — the agreement is stored
  on the server with the notice version.
- During the test the app requests full-screen and records events
  with server timestamps: switching tabs or minimising (with how
  long), leaving the window, exiting full-screen, and copy/paste
  attempts (only the NUMBER of characters pasted, never the content
  itself).
- Warnings escalate: warning on the 1st and 2nd flagged events, a
  final warning on the 3rd, and the test auto-submits on the 4th.
  The teacher can set the limit per test.
- Afterwards the teacher sees each attempt with a plain timeline
  labelled "Flagged events — review recommended", and records a
  decision: cleared or upheld.

The honest framing, deliberate throughout: this is **integrity
logging** — it flags events for a teacher to review; it does not
and cannot prove cheating. A browser page cannot see a second
phone, another person helping, or what happens outside the tab, and
nothing in the app claims "AI proctoring" or "cheating detected".
Verified with an automated probe (47 checks): consent required
before starting, event logging with server timestamps, answer keys
never sent to students before submitting, warning/auto-submit
counting, scoring, teacher review decisions, and non-enrolled
students blocked. Pushed as c45cf43 "add proctored tests".

One caution to act on before real use: under India's DPDP Act,
logging behaviour of students under 18 is restricted — treat these
tests as for adult learners unless that has been checked properly.

## Live sessions — video classes inside the LMS (2026-10-27)

Teachers can now schedule live video sessions for a course, and
enrolled students join from inside the LMS. The video itself runs on
Jitsi Meet (free, open-source) embedded in the page — no account or
API key was needed, unlike the metered alternatives (their "free"
tiers counted participant-minutes, which a single class of twenty
burns through in a handful of sessions).

- Each session gets an unguessable room name (course id + session
  id + random part), stored on the server and revealed ONLY to
  enrolled students, and only inside the join window (from shortly
  before the start until the teacher ends the session). Non-enrolled
  accounts never see the room name anywhere — the probes check the
  raw responses for leaks.
- The teacher schedules and ends sessions from the admin area;
  students see upcoming sessions and a Join button when it's time.
- One behaviour of Jitsi's public service to know: the teacher
  should join first, and Jitsi may ask the teacher to sign in (with
  Google/GitHub/Facebook) to open the room — that is Jitsi's own
  rule for whoever hosts. The teacher UI says this plainly. Students
  join by the in-app button with their LMS name, no Jitsi account.

Verified with an automated probe (25 checks): scheduling guards,
room-name secrecy for strangers and for enrolled students outside
the window, join-window behaviour, and teacher-only controls.
Pushed as da46c40 "add live sessions".

## R2 video storage — a second, bigger home for new videos (2026-10-27)

Why: course videos lived only on Cloudinary, whose free plan is one
small shared pool (1 GB stored or streamed ≈ 1 credit of 25/month)
with a steep price jump after it. Cloudflare R2's free tier is
10 GB of storage with unlimited free streaming, so new videos can
live there instead — while nothing existing moves.

How it works:

- Every lecture now records WHERE its video lives: a provider
  ("cloudinary" or "r2"), the object key for R2 videos, and one
  playbackUrl that players always read, so the player never needs to
  know the provider. Old rows written before this field existed get
  their playbackUrl filled in automatically from their video URL —
  every existing Cloudinary lecture plays exactly as before,
  untouched and unmoved.
- When R2 is configured, the server answers "r2" to the client's
  which-store question and hands out a short-lived presigned upload
  URL; the video then travels directly from the teacher's browser to
  R2 (never through the free server, which couldn't proxy
  lecture-sized files anyway), and the lecture is registered with
  its key and ready-made playback URL.
- When R2 is NOT configured, everything behaves exactly as before:
  the server answers "cloudinary", the presign endpoint refuses with
  a clean "R2_NOT_CONFIGURED" message, and registering an R2 video is
  refused too (a video pointing at an unconfigured store could never
  play). The five R2 settings are optional environment variables —
  no secrets in code, ever; placeholders only in .env.example.

Switching it on later is the owner's one step: create a free
Cloudflare account and an R2 bucket, make an R2 API token for that
bucket, and put the five values (account id, access key id, secret,
bucket name, public base URL) into the LMS server's environment on
Render, then redeploy. Note Cloudflare may ask for a payment method
to activate R2 even though the free tier itself costs nothing.

Verified with an automated probe (19 checks) in two boots — without
R2 settings (Cloudinary stays the provider, presign refuses, legacy
playback URLs resolve unchanged, R2 registration refused) and with
fake R2 settings (presign returns a correctly signed URL for the
configured account/bucket, and a registered lecture reads back
playbackUrl = public base + key). No real cloud account was used.
Pushed as 5ac9b45 "add r2 video storage option" (server part needs a
Manual Deploy on Render; the client went live on Vercel
automatically).
