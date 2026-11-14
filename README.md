# DragonVision Hub

Internal team-management app for **DragonVision**, a small AI video-production studio in Tunisia.
Arabic-only, full RTL, mobile-first, installable PWA.

**Stack:** React + Vite + TypeScript · Tailwind CSS v4 · Firebase Auth (email/password + Google) · Cloud Firestore · Netlify.
Font: **Cairo** (Google Font, self-hosted through `@fontsource-variable/cairo` so it also works offline in the PWA).

> This repository currently contains the **foundation** only: auth, roles, security rules, data model,
> the app shell and the *الفريق* (Team) page. The other pages are placeholders for later prompts.

---

## 1. Setup — what you must fill in

| # | Where | What |
|---|-------|------|
| 1 | Firebase console | Create a project, then enable **Authentication → Sign-in method → Email/Password** and **Google**. |
| 2 | Firebase console | **Firestore Database → Create database** (production mode). |
| 3 | Firebase console | **Project settings → Your apps → Web app** → copy the SDK config into `.env` (step 4). |
| 4 | `.env` | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. |
| 5 | `.env` → `VITE_DIRECTOR_EMAIL` | The director's email. |
| 6 | **`firestore.rules` → `DIRECTOR_EMAIL()`** (top of the file, clearly boxed) | The **same** email. This is the one constant that actually gates the director role. |
| 7 | `.firebaserc` | Replace `dragonvision-hub` with your real Firebase project id (or run `npx firebase use --add`). |
| 8 | Terminal | `npx firebase login`, then `npx firebase deploy --only firestore:rules`. |
| 9 | Firebase console → Authentication → Settings → **Authorized domains** | Add your Netlify domain (e.g. `your-site.netlify.app`) and any custom domain. Google sign-in fails without it. |
| 10 | Netlify → Site settings → Environment variables | Add the same `VITE_*` variables from `.env` (the `.env` file is git-ignored and is not deployed). |

Until `.env` is filled in, the app shows a setup screen listing the missing variables instead of crashing.

The director signs in **once** with the director email (Google, or email/password + email verification).
Their profile is created automatically with role `director`. Everyone else is invited from the Team page.

## 2. Run it

```bash
npm install
npm run dev          # against your real Firebase project (needs .env)
npm run dev:emu      # against local emulators — no real Firebase needed (uses .env.emulator)
npm run test:rules   # Firestore rules tests (starts the emulator itself, needs Java)
npm run build        # type-check + production build (+ service worker)
```

`npm run dev:emu` starts the Auth + Firestore emulators (UI at http://localhost:4000) and Vite together.
`.env.emulator` holds `VITE_DIRECTOR_EMAIL`; like `.env` it **must equal `DIRECTOR_EMAIL()` in `firestore.rules`**, or the emulator refuses to create the director profile.
The emulator loads `firestore.rules` when it starts — restart it after editing the rules.

## 3. Roles & permissions

Exactly five roles. **Enforced in `firestore.rules`**; the UI only hides what the rules would refuse anyway.

| Capability | director | sales | editor | audio | gen_assistant |
|---|:-:|:-:|:-:|:-:|:-:|
| Invite / remove members, assign roles, deactivate | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve deliveries (`approved` / `changes_requested`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| See / edit prices, tools cost, deposit, client payments, shares (`projects/*/private/finance`) — including the dashboard's collection-group query | ✅ | ❌ | ❌ | ❌ | ❌ |
| Read / write `settings/finance` (minimum price, payment delay; the commission default is kept in the doc but hidden) | ✅ | ❌ | ❌ | ❌ | ❌ |
| See everyone's payouts | ✅ | ❌ | ❌ | ❌ | ❌ |
| See **own** payouts (never prices, other members' amounts or the margin) | — | ✅ | ✅ | ✅ | ✅ |
| Create / update / delete payouts, mark ready (client paid **in full**) and paid | ✅ | ❌ | ❌ | ❌ | ❌ |
| Receive a notification when their payout is ready / paid (own amount only) | — | ✅ | ✅ | ✅ | ✅ |
| See all projects | ✅ | ❌ | ❌ | ❌ | ❌ |
| See projects they are assigned to (`memberIds`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| See projects they brought in (`createdBy`) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create projects | ✅ any stage | ✅ only a new `lead`, no members | ❌ | ❌ | ❌ |
| Edit / delete projects | ✅ | ❌ | ❌ | ❌ | ❌ |
| Move a project's stage (**one step forward**, or back any number) | ✅ | ❌ | ❌ | ❌ | ❌ |
| See all tasks | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / edit / reassign / delete tasks (assignee must be a project member, never the director) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve a task or request changes (never on their own task; history entry appended) | ✅ | ❌ | ❌ | ❌ | ❌ |
| See own tasks | ✅ | ✅ | ✅ | ✅ | ✅ |
| On own task: `todo → in_progress`, `changes_requested → in_progress`, `in_progress → in_review` (needs a valid http(s) `deliverableUrl`), and edit `deliverableUrl` while not under review | — | ✅ | ✅ | ✅ | ✅ |
| Change assignee / project / stage / review history of a task | ✅ (not the history) | ❌ | ❌ | ❌ | ❌ |
| Read / mark-read **own** notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read another user's notifications | ❌ | ❌ | ❌ | ❌ | ❌ |
| Read prospects (+ their outreach log) | ✅ all | ✅ only those **assigned to them** | ❌ | ❌ | ❌ |
| Create prospects (incl. bulk import) | ✅ (assign to a sales member or leave unassigned) | ✅ always assigned to themselves | ❌ | ❌ | ❌ |
| Edit a prospect, change its status / follow-up, add outreach activities | ✅ | ✅ own only (`won` / `lost` are final for sales) | ❌ | ❌ | ❌ |
| Reassign or delete a prospect | ✅ | ❌ | ❌ | ❌ | ❌ |
| Read / copy message templates | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create / edit / delete templates | ✅ | ❌ | ❌ | ❌ | ❌ |
| Read the team directory (names, emails, roles) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change own role / `active` flag | ❌ | ❌ | ❌ | ❌ | ❌ |
| Change own display name | ✅ | ✅ | ✅ | ✅ | ✅ |

Navigation per role (labels exactly as specified):

* **director** — لوحة المخرج، المشاريع، المهام، **للمراجعة** (with a badge = tasks awaiting review)، الزبائن المحتملون، المستحقات، الفريق — plus **الإعدادات** in the desktop sidebar and a ⚙ icon in the mobile top bar (the bottom bar is already full)
* **sales** — مهامي، **المشاريع** (so they can open the leads they create)، الزبائن المحتملون، مستحقاتي
* **editor / audio / gen_assistant** — مهامي، المشاريع، مستحقاتي

Design decisions worth knowing:

* **Stage gate.** Rules guarantee only the director can move a project, and only **one stage forward** at a time, so a project can never reach `delivered` without passing `review`. The rule *"every task of the current stage must be approved"* needs a query, which security rules can't run, so it is enforced by the director's UI (the advance button is disabled and a message names the blocking tasks). The director is the trusted owner; if you ever delegate stage moves, move this check into a Cloud Function.
* **Nobody approves their own task.** The director can't be a task assignee (rules), and the review rule also refuses `assigneeId == auth.uid`.
* **Notifications are created by the client** (no backend yet), but rules tie each one to a real task in the *same batch* (`getAfter`): the director may notify a task's assignee (assigned / approved / changes requested); an assignee may notify the director only for their own task that is now `in_review`. Nobody can send arbitrary notifications.
* **One director.** The `director` role cannot be granted through invites or role changes — it exists only for `DIRECTOR_EMAIL`. The director cannot demote or deactivate themself.
* **Deactivation is immediate.** Every rule re-reads `users/{uid}.active` on each request. A deactivated member can read only their *own* profile doc (so the app can say "your account is deactivated") and nothing else.
* **Team directory.** Any active member can read `users` (display name, email, role). Remove this in `firestore.rules` if you want members to see only themselves.
* **Email must be verified.** Profile creation requires `email_verified == true`; otherwise anyone could register with the director's or an invitee's address via email/password. Google accounts are verified automatically; email/password users confirm through a link (the app guides them).
* **No emails are sent.** Sending invitation emails needs a backend (Cloud Functions → Blaze plan). Instead the Team page has a *نسخ الدعوة* button that copies a ready-to-paste message (WhatsApp-friendly) with the app link.

### Money display (RTL)
All amounts go through `src/lib/money.ts`: `fmtMoney(1250)` → **"1 250 د.ت"** (Western digits, thin-space thousands separator).
Mixing numbers into right-to-left text is where digits get scrambled, so the number is wrapped in an LTR *isolate*, the group separator is a real thin space (U+2009 + a word joiner so a line can't break inside a number),
and a no-break space joins it to the currency. The test run measures real glyph positions to prove the order (digits left-to-right, currency on the far side, visible gap).
The invisible characters are built with `String.fromCharCode` in the source on purpose.

### Dashboard (لوحة المخرج)
Cards link to filtered pages (`/review`, `/tasks?filter=overdue`, `/prospects?due=1`, `/payouts?status=ready`). *Money this month*: revenue = client payments **received this month** (from `payments`),
outstanding = Σ max(0, price − paid), payouts paid this month, margin of projects delivered this month. *Team performance* (last 30 days, per member): tasks approved, % approved on/before `dueDate`,
average `changes_requested` rounds per completed task, tasks overdue now — delivered work, not activity.

## 4. Onboarding flow

1. Director → **الفريق** → enters email + role → writes `invites/{email}` (`status: "pending"`).
2. The invitee opens the app and signs in with **that same email** (Google, or *أول مرة؟ أنشئ حسابك* with email/password and confirms the email).
3. On first sign-in the client does one atomic batch: create `users/{uid}` **with the invited role** and mark the invite `accepted`.
   Firestore rules accept the create only if the role equals the pending invite's role (or the email is `DIRECTOR_EMAIL` → `director`). The user can't pick their own role.
4. An email with no invite sees *"لا توجد دعوة لهذا البريد"* and gets no access.

The invite document id **is the lower-cased email** — Firestore rules can't run queries, so they look the invite up by id.

## 5. Data model (Firestore)

Shared contract for the web app **and the future desktop app**: use these exact collection names, field names and enum values.
TypeScript definitions live in [`src/lib/types.ts`](src/lib/types.ts); Arabic labels in [`src/lib/labels.ts`](src/lib/labels.ts).
**Video files are never stored in Firebase** — projects and tasks store Google Drive links only.

Timestamps are Firestore `Timestamp`s. `createdAt` is always set with `serverTimestamp()`.

### `users/{uid}`  (uid = Firebase Auth uid)
| Field | Type | Notes |
|---|---|---|
| `displayName` | string | 1–100 chars. User may edit their own. |
| `email` | string | lower-case, must equal the auth email |
| `role` | `director` \| `sales` \| `editor` \| `audio` \| `gen_assistant` | set at creation from the invite; only the director changes it afterwards |
| `active` | boolean | `false` = deactivated, all access denied |
| `createdAt` | timestamp | |

### `invites/{inviteId}`  (inviteId = invitee's lower-case email)
| Field | Type | Notes |
|---|---|---|
| `email` | string | lower-case, equals the doc id |
| `role` | `sales` \| `editor` \| `audio` \| `gen_assistant` | `director` cannot be invited |
| `invitedBy` | string | director uid |
| `status` | `pending` \| `accepted` | |
| `createdAt` | timestamp | |

### `projects/{projectId}`
| Field | Type | Notes |
|---|---|---|
| `title`, `clientName`, `brief` | string | |
| `prospectId` | string (optional) | → `prospects/{id}` |
| `stage` | enum | one of 7, **in this order**: `lead` جلب الزبون → `script` السيناريو → `generation` التوليد → `audio` الصوت → `editing` المونتاج والألوان → `review` مراجعة الجودة → `delivered` التسليم والنشر |
| `dueDate` | timestamp \| null | |
| `driveFolderUrl` | string | Google Drive folder link |
| `memberIds` | string[] | uids with access to this project |
| `deliveredAt` | timestamp (optional) | set when moved to `delivered`; the dashboard counts the margin in that month |
| `createdBy` | string | uid (for sales: "brought in by") |
| `createdAt`, `updatedAt` | timestamp | |

### `projects/{projectId}/private/finance`  — **director only**
Amounts are plain numbers **in dinars** (up to 3 decimals). The rules accept writes only to the doc id `finance`.
| Field | Type | Notes |
|---|---|---|
| `price`, `toolsCost` | number | ≥ 0 |
| `currency` | `"TND"` | |
| `commissionRate` | number | **always saved as `0`** — commissions are switched off (see below). Percent 0–100 if they ever return |
| `salesMemberId` | string | **always saved as `""`** (no commission earner) |
| `shares` | map `uid → amount` | only **current project members** (rules check this) |
| `depositAmount` | number | agreed/received deposit (informational) |
| `depositReceivedAt` | timestamp \| null | |
| `amountPaidByClient` | number | **total** received so far, deposit included |
| `clientPaid` | boolean | derived on save: `amountPaidByClient ≥ price` |
| `payments` | `{ amount, at }[]` | appended automatically whenever `amountPaidByClient` changes (negative = correction) — lets the dashboard know what arrived *this month* |
| `updatedAt` | timestamp | |

Derived (never stored): **director margin = price − toolsCost − Σ shares**. Client status: unpaid / partial / paid.

> **Commissions are disabled (business decision).** The UI shows no commission fields, lines or wording, finance docs are always saved with `commissionRate: 0` and `salesMemberId: ""`
> (so they stay valid for the unchanged `firestore.rules`), and **no `commission` payouts are ever created**. To pay someone on a project — the sales member included — add them as a
> project member, then give them a share (the finance block says so). `settings/finance.defaultCommissionRate` stays in the document, untouched, only because the rules require the field.
The UI *warns* (never blocks) when the price is below `minProjectPrice`, or the margin is negative or under 20 % of the price.

### `settings/finance`  — **director only**
| Field | Type | Notes |
|---|---|---|
| `defaultCommissionRate` | number | not editable any more (commissions off); kept unchanged because the rules require the field |
| `minProjectPrice` | number | default **500** (dinars) |
| `paymentDelayDays` | integer | default **3**: a payout becomes due this many days after it turns `ready` |

If the doc doesn't exist the app uses those defaults. `settings/seed` (the template-seed marker) is also director-only.

### `tasks/{taskId}`
| Field | Type | Notes |
|---|---|---|
| `projectId` | string | immutable |
| `stage` | stage enum | director may change it |
| `title` | string | 1–200 chars |
| `instructions` | string | `""` when none |
| `assigneeId` | string | uid; must be in the project's `memberIds`, never the director. Only the director changes it, and not while `in_review`/`approved` |
| `dueDate` | timestamp \| null | |
| `status` | `todo` \| `in_progress` \| `in_review` \| `changes_requested` \| `approved` | flow below |
| `deliverableUrl` | string | Google Drive (any http/https) link; `""` until attached; required to submit |
| `reviewNotes` | `{ by: uid, text: string, at: timestamp, kind: "approved" \| "changes_requested" }[]` | append-only history, written by the director only. `text` is required for `changes_requested`. `at` is the client clock (`serverTimestamp()` isn't allowed inside arrays); rules bound it to ±10 min of server time |
| `createdAt`, `updatedAt` | timestamp | |

Status flow (enforced by rules):

```
todo ──▶ in_progress ──▶ in_review ──▶ approved
              ▲              │
              │              └──▶ changes_requested
              └──────────────────────────┘
```
`todo → in_progress`, `in_progress → in_review` (needs a valid link) and `changes_requested → in_progress` are the assignee's;
`in_review → approved | changes_requested` is the director's alone.

### `notifications/{id}`
| Field | Type | Notes |
|---|---|---|
| `userId` | string | recipient — only they can read it |
| `type` | `task_assigned` \| `task_submitted` \| `task_approved` \| `changes_requested` \| `payout_ready` \| `payout_paid` | |
| `projectId` | string | |
| `taskId` | string | `""` for payout notifications |
| `payoutId` | string | payout notifications only |
| `text` | string | Arabic, ready to display (≤ 300 chars) |
| `read` | boolean | the recipient may only flip this |
| `createdAt` | timestamp | |

Created when: a task is assigned/reassigned (→ assignee), submitted for review (→ director), approved or sent back (→ assignee), a payout becomes ready or paid (→ **that payout's member only**, text shows only their own amount — rules tie it to the payout in the same batch).
No indexes are required: queries use equality filters only and are sorted in the client.

### `prospects/{prospectId}`
| Field | Type | Notes |
|---|---|---|
| `name` | string | 1–200 chars; the import skips exact-name duplicates |
| `city`, `sector`, `notes` | string | may be `""` |
| `pageUrl` | string | Facebook page, `""` or an http(s) link |
| `followers` | integer | ≥ 0 |
| `lastPost` | `this_week` \| `this_month` \| `1_3_months` \| `older` \| `no_page` \| `""` | `""` = unknown (`-` in an import). *(Was a timestamp in the first draft of the schema — nothing was stored yet.)* |
| `runningAds` | `yes` \| `no` \| `unclear` | |
| `quality` | `1` \| `2` \| `3` \| `null` | quality of **their current creatives**: 1 = weak = best prospect; `null` = not rated |
| `outreachStatus` | `not_contacted` \| `contacted` \| `follow_up` \| `meeting` \| `won` \| `lost` | flow below |
| `lostReason` | string | required when `lost` |
| `nextFollowUp` | timestamp \| null | stored as the end of that day |
| `assigneeId` | string | a **sales** member's uid, or `""` = unassigned (director only) |
| `projectId` | string | set when converted to a project, else `""`. The project's `prospectId` points back |
| `createdBy` | string | uid |
| `createdAt`, `updatedAt` | timestamp | |

Status flow: `not_contacted → contacted → follow_up → meeting → won | lost` (a later stage, or `lost`, from any open stage; `won` / `lost` are final for sales).
**The priority score is never stored** — it is computed in the app (`src/lib/prospects.ts`):
`runningAds` yes +3 / unclear +1 · `quality` 1 +3 / 2 +1 · `lastPost` this week or month +2, 1–3 months +1 · ≥ 5000 followers +1.
7+ = high, 4–6 = medium, 0–3 = low.

### `prospects/{prospectId}/activities/{activityId}`  (append-only outreach log)
| Field | Type | Notes |
|---|---|---|
| `type` | `message` \| `call` \| `visit` \| `meeting` \| `note` | |
| `channel` | `facebook` \| `instagram` \| `whatsapp` \| `phone` \| `in_person` | |
| `text` | string | 1–2000 chars |
| `createdBy` | string | uid |
| `createdAt` | timestamp | |

Visible to whoever can see the parent prospect. Adding one can also set the prospect's status / next follow-up in the same batch.

### `templates/{templateId}`
| Field | Type | Notes |
|---|---|---|
| `title`, `body` | string | `{name}` and `{city}` are replaced with the prospect's values when copying |
| `createdBy` | string | director uid |
| `createdAt`, `updatedAt` | timestamp | |

Two Arabic (Tunisian darja) defaults, `default-first-contact` and `default-follow-up`, are written once by the director's client the first time the app is opened,
guarded by the director-only marker doc `settings/seed` (so deleting them never brings them back).

### `payouts/{payoutId}`
The **id is `${projectId}_${memberId}_${type}`** (rules enforce it), so "create payouts" can be run any number of times without duplicates.
| Field | Type | Notes |
|---|---|---|
| `projectId` | string | immutable |
| `projectTitle` | string | denormalised, so a member never needs to read the project |
| `memberId` | string | immutable; never the director. A member reads **only** payouts where this is their uid |
| `amount` | number | TND ≥ 0 |
| `type` | `fee` \| `commission` | one `fee` per share. `commission` is allowed by the rules but never created |
| `status` | `awaiting_client_payment` \| `ready` \| `paid` | flow below |
| `method` | string | note when paid: "نقداً", "D17"… |
| `createdAt`, `updatedAt` | timestamp | |
| `paidAt` | timestamp \| null | set when paid |
| `dueAt` | timestamp \| null | set when `ready`: now + `paymentDelayDays` |

```
awaiting_client_payment ──▶ ready ──▶ paid
   (re-running "create payouts"      (director, with paidAt
    may change the amount)            and an optional method)
```
`ready` is only accepted by the rules if the client paid **in full** (the rule reads the finance doc). A `paid` payout is final.
Re-running "create payouts" updates amounts of unpaid payouts, removes unpaid ones whose share disappeared, never touches paid ones, and reports what changed.

### Query note
Rules cannot filter, so clients must query within what they may read:
members query tasks with `where("assigneeId", "==", uid)`, projects with `where("memberIds", "array-contains", uid)`,
payouts with `where("memberId", "==", uid)`. An unconstrained list query by a non-director is denied.

## 6. Testing

* **Rules tests** — `tests/firestore.rules.test.ts`, run on the Firestore emulator. Only critical permissions
  (each also asserts the *allowed* case so a deny-everything rule set can't pass):
  1. a non-director cannot read `projects/{id}/private/finance`
  2. a member cannot change their own role
  3. a member cannot read another member's payouts
  4. a member cannot read a project they are not assigned to
  5. a deactivated member is denied
  6. an assignee cannot set their own task to `approved` / `changes_requested`
  7. an assignee cannot change a task's assignee, project or stage
  8. a non-director cannot change a project's stage (and the director cannot skip stages)
  9. a member cannot read or write tasks of a project they are not assigned to
  10. a user cannot read another user's notifications
  11. editor / audio / gen_assistant cannot read prospects (or their activities / templates)
  12. sales cannot read a prospect assigned to another user
  13. sales cannot change a prospect's `assigneeId` or delete it
  14. only the director can write templates
  15. a non-director cannot create, update or delete any payout (including their own status) — and the director is held to the id / status-flow rules
  16. a non-director cannot read or write `settings/finance`
  (test 3 also covers: a member can read only their own payouts, by id and by an own-only query; unfiltered list denied)
* **Finance flow check** (not committed): director opens a project with an editor and a sales member → fills finance (800 / tools 150 / editor share 120) → checks the breakdown
  (434, 54.3 %) and the warnings → creates payouts, runs it again (no duplicates, "no changes"), changes and restores a share → records the client paying partially then in full → payouts become ready →
  marks the editor's payout paid (D17). The editor's مستحقاتي shows only their amount; every page the editor and the sales user can open is scanned for price / margin / commission / other amounts (none),
  and REST calls by the editor to the finance doc, the collection-group query, all payouts and settings are denied. Dashboard numbers are checked against seeded fixtures, and RTL money rendering is measured.
* **Prospects flow check** (not committed): director invites a sales member → the sales user pastes an import of 3 rows (1 malformed, 1 duplicate), checks the preview and imports →
  opens a prospect, logs a message with a follow-up for today → sees it in *متابعات اليوم* → copies a template with placeholders filled (and the select-text fallback when the clipboard refuses) →
  marks the prospect won → creates the lead project → the director sees it on the board. Also: an editor has no prospects navigation, is redirected, and is denied by the rules (REST calls return 403).
* **Workflow flow check** (not committed): with the emulators and Playwright — director creates a project with an editor, creates and assigns tasks,
  the editor sees them + the notification, submits Drive links, the director requests changes with a note, the editor resubmits, the director approves,
  and the project advances (and is blocked while a task isn't approved). Also covers reassign/delete, the members editor and a sales user opening a lead.
  Screenshots at 390 px and 1280 px were reviewed for RTL, overflow and contrast.

## 7. Project layout

```
firestore.rules            security rules (DIRECTOR_EMAIL() lives here)
firebase.json              emulators + rules config
netlify.toml               build, SPA redirect, cache headers
src/lib/types.ts           data-model types (shared contract)
src/lib/roles.ts           routes + per-role navigation
src/lib/labels.ts          Arabic labels for roles/stages/statuses
src/context/AuthContext    sign-in, email verification, first-sign-in profile creation
src/components/Layout      sidebar (desktop) + bottom nav (mobile)
src/pages/Team.tsx         invite / list / change role / deactivate
src/pages/Projects.tsx     stage board (columns on desktop, stage chips on phones)
src/pages/ProjectPage.tsx  details, tasks by stage, stage gate
src/pages/MyTasks.tsx      مهامي (own tasks) + director's all-tasks list
src/pages/ReviewQueue.tsx  للمراجعة — approve / request changes
src/pages/Notifications.tsx
src/pages/Dashboard.tsx    لوحة المخرج: cards, stage bars, money this month, team performance
src/pages/Payouts.tsx      director المستحقات + every member's مستحقاتي
src/pages/SettingsPage.tsx settings/finance
src/components/FinanceBlock director-only finance editor, breakdown, payout actions
src/lib/money.ts           money formatting / parsing (RTL-safe)
src/lib/finance.ts         breakdown, warnings, payout plan (idempotent)
src/lib/stats.ts           dashboard maths
src/pages/Prospects.tsx    list: follow-ups section, filters, cards / table
src/pages/ProspectPage.tsx details, quick links, status flow, outreach log, templates, convert to project
src/pages/ImportProspects  paste → preview (ready / duplicates / errors) → import
src/pages/Templates.tsx    message templates (director edits, sales copy)
src/lib/prospects.ts       priority score, follow-up buckets, status flow, import parser, default templates
src/components/TaskViews   task card, task detail (status buttons, review history)
src/context/DataContext    role-scoped realtime listeners (matches the rules)
src/lib/workflow.ts        stage order, stage gate, allowed transitions
src/lib/actions.ts         every workflow write (task + notification in one batch)
tests/                     Firestore rules tests
```

## 7b. Performance & updates (PWA)

* **Lazy loading.** Only the login page is in the startup bundle. Every page after sign-in is a lazy chunk (`React.lazy` + an RTL loading state), the Firestore SDK (the biggest dependency) is loaded
  **after** the login page paints (in the background, or immediately after sign-in), and vendors are split into stable chunks (`vendor-react`, `vendor-auth`, `vendor-firestore`, `vendor-firebase`).
  Login-page JS before first paint: **1 089 kB → 381 kB raw (322 kB → 121 kB gzip)**.
* **"New version available".** The service worker runs in *prompt* mode (`registerType: "prompt"`, `clientsClaim`): a freshly deployed build waits in the background and a banner
  «نسخة جديدة متاحة — تحديث» appears; tapping it activates the new worker and reloads. The app checks for a new version on every focus / return to the tab (rate-limited) and hourly.
  Previously (`autoUpdate`) a returning user could keep running an old cached build.

## 8. Deploying

### Netlify
`netlify.toml` sets: build command `npm run build` (type-check + production build), publish directory `dist`, Node 22, the **SPA fallback** (`/* → /index.html`, status 200) and cache headers (no-cache for `sw.js` / the manifest, immutable for hashed assets).
Connect the GitHub repo, then add **these environment variables** in *Site configuration → Environment variables* (the `.env` file is git-ignored and is not deployed):

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase console → Project settings → Web app |
| `VITE_FIREBASE_AUTH_DOMAIN` | `dragonvision-hub.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `dragonvision-hub` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `dragonvision-hub.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | from the same config |
| `VITE_FIREBASE_APP_ID` | from the same config |
| `VITE_DIRECTOR_EMAIL` | the director's email — **must equal `DIRECTOR_EMAIL()` in `firestore.rules`** |

Do **not** set `VITE_USE_EMULATORS`. Vite bakes these in at build time, so redeploy after changing any of them.

### Firebase (manual — nothing here deploys it for you)
1. Publish `firestore.rules` (Firebase console → Firestore → Rules, or `npx firebase deploy --only firestore:rules`). **Required for every feature to work.**
2. Authentication → Sign-in method: enable Email/Password and Google. Authentication → Settings → Authorized domains: add the Netlify domain.
3. No Firestore indexes are needed.

### GitHub
The repository is meant to be **private**. Never commit `.env` (it is git-ignored). `.env.emulator` is committed on purpose: it holds only demo keys and the director email.
Install the PWA from the browser menu (*Add to Home Screen* on phones).
