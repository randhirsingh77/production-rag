# Golden Set — Core 100

The hand-built evaluation set for the production RAG system. The corpus is the
owner's own project documentation — Foodie, LMS, Personal AI, Portfolio — so every
answer can be judged by the person who built those systems.

**Machine-readable file:** `eval/golden_core_100.jsonl` (one JSON object per line:
id, question, type, tier, smoke flag, source_doc, gold_quote, reference_answer).

## Composition

| Stratum | Count | Purpose |
|---|---|---|
| simple | 52 | One fact, one passage — the bulk of real questions |
| reasoning | 24 | Combine two facts, or explain why/how |
| multihop | 12 | Answer needs facts from two different sections |
| unanswerable | 12 | Not in the documents — correct behaviour is refusal |

25 questions per source document. A **smoke subset of 25** (flagged in the JSONL)
runs on every change during development; the full 100 is the core anchor set.
The gating set (200–300, core + spot-checked synthetics) is built later, per the
build plan, and is the only set allowed to block a release.

## How it was verified

- Every answerable question carries a `gold_quote`: the exact passage containing
  the answer, copied from the source document.
- An independent programmatic pass re-checked **all 88 gold quotes as verbatim
  substrings** of their source documents after assembly — 0 mismatches.
- Reference answers restate only what their gold quote contains — no outside facts.
- Unanswerable questions were confirmed absent from the documents (plausible asks:
  prices, counts, or policies the docs genuinely never state).

## Growth rules

- +5–10 questions per month, promoted from real production failures.
- A question is retired when its source document section is removed.
- The set is versioned with the code; edits to gold answers need a reason in the commit.

## The 100 questions

### Foodie (food-delivery platform) — `food-delivery.md`

- **Q001** (simple) What is the live URL of the Foodie website?
- **Q002** (simple) What discount does the FOODIE50 promo give, and when does it apply?
- **Q003** (simple) How much is the delivery fee, and when is delivery free?
- **Q004** (simple) What are the restaurant's opening hours shown on the site?
- **Q005** (simple) What is the server-side price of Pasta?
- **Q006** (simple) How much demo pay does a driver earn for one completed delivery?
- **Q007** (simple) How many monthly active users does the Auth0 free plan allow?
- **Q008** (simple) What size did pasta.jpg shrink to after image compression?
- **Q009** (simple) What is the URL of the live foodie-server backend?
- **Q010** (simple) What does the weekly tiffin plan include, and what does it cost?
- **Q011** (simple) What does the monthly tiffin plan include, and what does it cost?
- **Q012** (simple) What is the price of the Ghar Jaisa Thali, and what does it contain?
- **Q013** (simple) How often does the keep-alive service ping the backend?
- **Q014** (reasoning) Why does Foodie's login use the phone number as a username instead of sending an SMS OTP?
- **Q015** (reasoning) Why did the fixed header keep growing taller on its own?
- **Q016** (reasoning) How does the site make sure prices can never disagree between the menu, the cart and the order form?
- **Q017** (reasoning) What happens if a customer tampers with the browser request to claim Pasta costs ₹1?
- **Q018** (reasoning) Why are the Jain dietary flags declared one by one for each dish instead of being calculated from other flags?
- **Q019** (reasoning) How does the group-order bill split guarantee that everyone's shares add up to the exact total?
- **Q020** (multihop) In the full live test, what was the total of the order that went through the kitchen and driver to delivery, and what did the driver end up with?
- **Q021** (multihop) Why does "Continue with Google" fail on the live site, and what is needed to make it work?
- **Q022** (multihop) Which two daily jobs start working once the owner places the ADMIN_KEY file on the machine, and at what times do they run?
- **Q023** (unanswerable) What is the price of the Chocolate Drink on the menu?
- **Q024** (unanswerable) How many registered users does Foodie have in total?
- **Q025** (unanswerable) Which payment gateway does Foodie use to process debit and credit card payments?

### LMS (course-selling platform) — `lms.md`

- **Q026** (simple) What is the live URL of the LMS frontend?
- **Q027** (simple) What is the URL of the LMS backend, and what is the Render service called?
- **Q028** (simple) What were the reproduction suite results before and after the access-control fixes of 2026-10-25?
- **Q029** (simple) What was the browser tab title changed to during the Round F overhaul?
- **Q030** (simple) How many checks did the Round F responsive suite pass?
- **Q031** (simple) What is the name of the endpoint that verifies a Stripe checkout session after a buyer returns from payment?
- **Q032** (simple) What is the default pass mark for a per-lecture quiz?
- **Q033** (simple) What password do the seeded demo accounts use?
- **Q034** (simple) How many lectures does the demo course have, and how many questions are in each lecture's quiz?
- **Q035** (simple) What issuer name is frozen onto every certificate record at the moment of issue?
- **Q036** (simple) In which timezone are learning streaks on the public skill profile computed?
- **Q037** (simple) On which flagged event does a proctored test auto-submit?
- **Q038** (simple) How much storage does Cloudflare R2's free tier provide for course videos?
- **Q039** (reasoning) Why did the "Confirming your payment…" page give up before enrolment completed, even though the webhook endpoint itself was healthy?
- **Q040** (reasoning) Why does pressing "Mark as completed" not earn a student a certificate?
- **Q041** (reasoning) How do per-lecture quizzes keep the correct answers hidden from students before they submit?
- **Q042** (reasoning) Why does an old printed certificate fail verification after the certificate has been revoked?
- **Q043** (reasoning) Why did the old profile and course update flow throw away a user's other edits when an image upload failed?
- **Q044** (reasoning) Why does each timestamped doubt store the video's total length at the time the doubt was asked?
- **Q045** (multihop) Which two kinds of records does the server's shared eligibility function rely on when deciding whether to issue a certificate?
- **Q046** (multihop) After the verifiable-certificates commit was pushed, what still had to happen before the feature worked live, and which part went live automatically?
- **Q047** (multihop) On a student's public skill profile, which two kinds of activity make a day count toward a learning streak?
- **Q048** (unanswerable) How much does the "Demo Course: Web Development Foundations" cost to buy?
- **Q049** (unanswerable) How many students are currently enrolled across all courses on the platform?
- **Q050** (unanswerable) Does the LMS offer a native Android or iOS app for students?

### Personal AI (voice assistant) — `personal-ai.md`

- **Q051** (simple) How many tools are in the assistant's tool registry, and how are they described?
- **Q052** (simple) Which local embedding model turns note chunks into number-vectors for 'ask my notes'?
- **Q053** (simple) Into roughly what size pieces are documents in the notes folder chopped?
- **Q054** (simple) What USD-to-INR conversion rate does the cost dashboard use, and from what date?
- **Q055** (simple) What kind of face model does setup_face.py train?
- **Q056** (simple) What is the built-in Porcupine wake keyword?
- **Q057** (simple) What command starts the web version's API service, and what framework does it use?
- **Q058** (simple) What was the result of the original smoke suite in the first verification?
- **Q059** (simple) What was the suite status after the Round 2 additions?
- **Q060** (simple) How much data downloads on the first use of offline speech-to-text?
- **Q061** (simple) Which reranker model does ask-my-notes v2 use, and how big is it?
- **Q062** (simple) What recall@5 did the vector-only configuration score in the sandbox measurement?
- **Q063** (simple) How many hand-written golden questions were used to measure ask-my-notes v2?
- **Q064** (reasoning) Why can the pattern planner later be swapped for Gemini's function-calling without changing any tool?
- **Q065** (reasoning) Why do the destructive tools in the MCP 'actions' profile refuse to run on a headless call?
- **Q066** (reasoning) Why are the CPU threads for the offline Whisper model capped at 4?
- **Q067** (reasoning) What does the assistant do before saving a new memory, and what happens to a near-duplicate?
- **Q068** (reasoning) What must be set for the web API to accept connections beyond localhost, and what must every API call carry?
- **Q069** (reasoning) Why is there no measured recall@5 number for the hybrid + rerank configuration?
- **Q070** (multihop) The assistant's face unlock was inspired by the earlier Friday project — was any of that project's face data reused?
- **Q071** (multihop) How many tools does the MCP readonly profile offer, and how many destructive tools are included when all tools are offered in the actions profile?
- **Q072** (multihop) In what order are the chat providers tried, and what does the first one need?
- **Q073** (unanswerable) How many face samples does setup_face.py capture from the owner?
- **Q074** (unanswerable) What is the assistant's average response latency in milliseconds?
- **Q075** (unanswerable) What is the minimum Android version the mobile companion app requires?

### Portfolio + Ask Randhir — `portfolio.md`

- **Q076** (simple) What is the live URL of Randhir's portfolio site?
- **Q077** (simple) What is the portfolio built with, and where is it hosted?
- **Q078** (simple) On what date was version 1 of the portfolio built and published?
- **Q079** (simple) Whose portfolio was the version 2 redesign modelled on?
- **Q080** (simple) What is the hex code of the portfolio's single accent colour?
- **Q081** (simple) Below what screen width do the portfolio's two columns stack?
- **Q082** (simple) To which email address does the contact form forward messages?
- **Q083** (simple) What must happen once before contact-form messages start flowing?
- **Q084** (simple) Which commit added the project case-study pages?
- **Q085** (simple) What does the honesty line under the demo buttons tell visitors?
- **Q086** (simple) What is the name of the snapshot file the Recent activity section reads?
- **Q087** (simple) Which token scope was missing when GitHub rejected the tree containing the workflow file?
- **Q088** (simple) What size is the canonical GitHub mark path that replaced the broken icon path?
- **Q089** (reasoning) Why was the 'Naukri profile' sidebar link removed on 23 Oct 2026?
- **Q090** (reasoning) Why does the Recent activity section use a snapshot file instead of calling the GitHub API from the visitor's browser?
- **Q091** (reasoning) How were the commit messages cleaned without changing any files?
- **Q092** (reasoning) How was it proven that the commit-message rewrite changed zero files?
- **Q093** (reasoning) Why can't the section-reveal animation leave content invisible if JavaScript fails?
- **Q094** (reasoning) Why was the 'server wakes up' honesty line placed under each demo button?
- **Q095** (multihop) The Naukri link was removed from the sidebar during the 23 Oct fixes, but it later returned — in what form, and what does it look like?
- **Q096** (multihop) What has to happen before the GitHub activity snapshot can start refreshing daily, and what is its state until then?
- **Q097** (multihop) The new case-study pages reuse the site's script.js, which was null-guarded in the same commit — what failure would those pages have hit without the guard?
- **Q098** (unanswerable) How many visitors did the portfolio site receive in its first month online?
- **Q099** (unanswerable) What phone number does Randhir list in the portfolio's contact section?
- **Q100** (unanswerable) What Lighthouse performance score does the portfolio home page achieve?
