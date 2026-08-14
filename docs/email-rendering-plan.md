# Email rendering plan (email-rendering branch)

Replace the hand-rolled notification email template
(`baker/emailNotifications/NotificationEmail.tsx`) with a
[react-email](https://react.email) implementation of the designed template
([Figma: "The OWID Brief-V2"](https://www.figma.com/design/tSJW2qxeaWwnfEXLmAfC5D/Subscribe?node-id=530-5592)),
loosely based on the /latest page design.

Everything upstream of rendering already exists on this stack and stays
unchanged: `sendEmailNotifications.ts` fetches subscribers from D1, builds
`NotificationEmailItem`s from recently published gdocs (topic-hierarchy
matching, excerpts, thumbnails, full body blocks for data insights), and sends
via Postmark. Only the rendering layer and its dev/preview tooling change.

## Why react-email

The current template uses `ReactDOMServer.renderToStaticMarkup` with inline
styles on `<div>`s. That breaks in Outlook desktop (Word rendering engine: no
`max-width`, unreliable `<div>` layout). react-email compiles React components
to table-based, inline-styled HTML that renders consistently across Gmail,
Outlook, Apple Mail, etc., and gives us a component vocabulary (`Container`,
`Row`, `Column`, `Section`, …) instead of hand-writing nested tables. It also
produces a plain-text alternative from the same component tree.

## Decisions

These were agreed in planning; each is cheap to revisit later.

- **Newsletter name**: not settled ("Daily update" is wrong because
  preferences can make sends less than daily). Header renders **"Your OWID
  Update"** for now, in the mockup's small-line/big-line treatment ("Your" /
  "OWID Update"), from a single constant so renaming is a one-liner.
- **Kicker icons: none in v1.** The mockup uses FontAwesome glyphs
  (chart-line, lightbulb, book, calendar-day), which in email must be `<img>`s.
  When a client blocks images it shows a broken-image placeholder box in the
  reserved space — it does not collapse — and per our preference (empty
  boxes are worse than no icons) we ship text-only kickers. Follow-up option:
  hosted PNGs committed to the site's static assets. Arrows in CTAs ("Read
  the article →") use the text character `→`, which needs no image.
- **Dates: absolute** ("August 3"), computed at send time. The mockup's
  "yesterday" goes stale for anyone opening the email late. Cross-year edge:
  append the year when it differs from the send year (possible in January,
  since the content window reaches back up to 30 days).
- **Articles: excerpt only**, plus author, thumbnail, and "Read the article
  →". The mockup's full-text article is not generalizable (articles are often
  3000+ words). The excerpt is the article's authored `latest-feed-excerpt`
  when set — the same one /latest shows — falling back to the gdoc excerpt
  and then the first text block. It's rich text (several paragraphs, some
  emphasis, links), so it's carried as blocks rather than a string.
    - **Its links are resolved before rendering** (`excerptLinks.ts`). Google
      Doc links to other articles become public URLs; grapher and explorer
      links are already public and pass through. Anything unresolvable — an
      unregistered or unpublished doc, or a link type with no meaning in an
      email such as a detail on demand — degrades to plain text, which is
      what the site does with a link it can't resolve. A Google Doc URL must
      never reach a subscriber. Resolution needs each article's linked
      documents, so `buildNotificationItems` loads them for articles that
      have an authored excerpt.
- **Data insights: full body**, as today, including the closing call to
  action ("Explore the full data for …") rendered bold with a trailing `→`
  as in the mockup. No heuristic is needed: the CTA turned out to be a
  first-class `cta` ArchieML block (`{ type: "cta", text, url }`, see
  `types/…/archieMLComponents/Cta.ts`), present on every recent data insight,
  so the renderer just handles that block type. An earlier plan to detect it
  by shape (a final text block that is only a link) matched zero of the eight
  data insights in the last 30 days and was dropped.
- **Transactional emails (welcome, magic link) stay as-is.** They will be
  designed later; this branch does not touch
  `functions/_common/emailNotifications.ts`.
- **Preview DX: an admin page** with form controls for the mock
  subscription, no react-email CLI/dev server (it bundles Next.js). See below.
- **Plain-text alternative**: send Postmark a `TextBody` generated via
  `render(component, { plainText: true })`. Improves spam scoring and serves
  text-only clients; today we send HTML only.
- **Fonts: web-safe only**, matching the design's own substitutions (Arial
  for Lato, Times New Roman for Playfair). Lato and Playfair Display are not
  named in the stacks: the email is designed against the substitutes, so
  readers who happen to have the real fonts installed would get a layout that
  was never checked rather than the one that was.
    - body/UI: `Arial, Helvetica, sans-serif`
    - serif titles (header, article titles): `"Times New Roman", serif`
- No `@font-face` web-font loading.

## The template, piece by piece

Layout: 632px container on `#f7f7f7` (Gray 5) background, 40px horizontal
padding → 552px content column. Fluid below 632px (`width: 100%; max-width:
632px`). Design tokens from the Figma variables:

| token                  | hex       | use                                    |
| ---------------------- | --------- | -------------------------------------- |
| Oxford Blue / Blue 100 | `#002147` | header background                      |
| Blue 90                | `#1d3d63` | titles, body text                      |
| Blue 60                | `#426591` | kicker text, author lines              |
| Blue 30                | `#a4b6ca` | header title text                      |
| Blue 10                | `#ebeef2` | article card background, image borders |
| Vermillion             | `#ce261e` | header rule, "Read …" CTAs             |
| Gray 5                 | `#f7f7f7` | page background                        |

1. **Header**: `#002147` block, ~120px tall; left: "Your" (18px) over "OWID
   Update" (36px), Playfair-stack semibold, `#a4b6ca`; right: the text-based
   OWID logo (white "Our World in Data" on navy — pure HTML/text, no image);
   a 5px `#ce261e` rule underneath.
2. **Intro** (14px, `#1d3d63`): "Here is what we published in the last
   {day|week} across the topics you follow. Update your preferences or, if
   this was forwarded to you, subscribe here." — "Update your preferences"
   links to the request-link endpoint (magic-link flow), "subscribe here" to
   `/subscribe`. (The unsubscribe link moves out of the intro; it lives in the
   footer and in the `List-Unsubscribe` header.)
3. **Items**, 32px apart, newest first (existing sort). Every item starts
   with a **kicker row**: left `DATA UPDATE — HEALTH` (10px bold uppercase,
   1px tracking; type label `#426591`, topic `#1d3d63`), right the date
   (same style, `#426591`). Then, per content type:
    - **`data-update` and `announcement`** — plain on the gray background:
      title (20px bold sans, `#1d3d63`), excerpt (16px/24px), inline
      "Read more →" link in `#ce261e`. Announcements are usually untagged, so
      their kicker shows the type only.
    - **`data-insight`** — white card, 24px padding: title (20px bold
      sans), then the full body via the block renderer (text, heading, image
      with a 1px `#ebeef2` border, and the `cta` block styled bold + `→`;
      links underlined, inheriting text color), then the byline.
    - **`article`** — `#ebeef2` card (16px sides / 16px top / 24px bottom):
      thumbnail (full width), title (24px serif bold, `#1d3d63`), author line
      (16px italic, `#426591`), excerpt, "Read the article →" bold in
      `#ce261e`.
4. **Footer** (not in the mockup; carries over the current template's content,
   restyled to the palette): "This email was sent to {email} because you
   subscribed to email updates from Our World in Data", update-preferences and
   unsubscribe links, and the postal-address line. The current template's
   "Browse the latest on Our World in Data" button also moves here, above the
   footer text, linking to `/latest`.

## Implementation

### Dependencies

Add `@react-email/components` (which re-exports `@react-email/render`) to the
root `package.json`. Rendering runs only in the baker/admin server (Node), not
in Cloudflare Functions. No react-email CLI.

### Files

- **`baker/emailNotifications/NotificationEmail.tsx`** — rewritten with
  react-email components (`Html`, `Head`, `Preview`, `Body`, `Container`,
  `Section`, `Row`, `Column`, `Heading`, `Text`, `Link`, `Img`, `Hr`).
  `renderNotificationEmail` becomes async (react-email's `render` returns a
  promise) and returns `{ html, text }`. The existing `Block`/`Spans`
  ArchieML renderers are ported into the new component tree (same block
  subset: text, heading, image; same span handling). A `<Preview>` line
  (inbox preview text) lists the first item titles.
- **`baker/emailNotifications/sendEmailNotifications.ts`** — call the async
  renderer; pass `TextBody` to Postmark alongside `HtmlBody` (both the
  broadcast send and the dry-run path, which now writes `.html` and `.txt`).
- **`baker/emailNotifications/emailNotificationsUtils.ts`** — add the
  `formatItemDate` helper, unit-tested.
- **`baker/emailNotifications/notificationItems.ts`** — new: the item-building
  code moved out of `sendEmailNotifications.ts`, so the preview route can
  reuse it without importing that script's yargs entrypoint (which runs, and
  calls `process.exit`, on import).
- **`adminSiteClient/EmailNotificationsPreviewPage.tsx`** (+ `.scss`,
  routed at `/admin/email-notifications-preview`, linked from the sidebar's
  utilities section) — the preview, inside the admin chrome. A form on the
  left controls the mock subscription (subscriber email, frequency, content
  types, topics, send date); the right pane shows the rendered
  email in a sandboxed iframe, toggleable to the plain-text alternative. The
  toolbar reports how many items matched out of those published in the
  window, and the rendered HTML size (flagged red past Gmail's clipping
  limit). Editing a control re-renders.
- **`adminSiteServer/apiRoutes/emailNotifications.ts`** — backs that page:
  `GET /api/email-notifications-preview` returns `{ html, text, itemCount,
publishedInWindowCount, htmlBytes }`, and
  `GET /api/email-notifications-preview/topics` returns the topic areas a
  subscriber can choose from (the same list the public subscribe form
  offers). The preview runs the mock subscriber's preferences through the
  send job's own `filterItemsForSubscriber`, so the page shows what that
  subscriber would actually receive, not just everything published. The
  content window isn't set directly: it follows from the send date and the
  frequency, exactly as it does for a real subscriber's first email — the
  mock subscriber's `lastSentAt` is left null so the same code derives it.
  Picking an earlier send date shows what a past send would have looked
  like, and the send date is also the `now` the template formats item dates
  against, so a January date exercises the cross-year year suffix.
- **`baker/emailNotifications/NotificationEmail.test.ts`** — snapshot tests
  of the rendered HTML and plain text for a fixture covering all four content
  types (data insight with text/image/cta blocks, article with and without a
  thumbnail, untagged announcement), plus assertions on invariants that
  snapshots obscure: unsubscribe/preferences URLs present, no `undefined` in
  the output, and the rendered size.

### Email-client constraints observed

- Table layout via react-email primitives; no flex/grid, no `max-width`
  reliance in Outlook-critical spots (react-email emits MSO conditionals).
- All URLs absolute (already the case: `BAKED_BASE_URL`).
- Images get explicit `width` and `alt` text; charts/thumbnails keep
  `height: auto` fluidity.
- No icon fonts, no SVG, no background images, no CSS in `<style>` required
  for the core layout (styles are inlined).
- Dark mode: no special handling in v1. Gmail/Outlook auto-invert can shift
  the navy header; acceptable for launch, revisit if it looks bad in testing.

## Edge cases

- **Announcement without tags** → kicker shows type only, no "— topic".
- **Missing thumbnail/excerpt** → element skipped (existing item-builder
  behavior already makes these optional).
- **Data insight image missing from the Cloudflare images map** → image block
  skipped (existing behavior).
- **Data insight without a `cta` block** → the card simply ends after the
  body; no error path.
- **Unsupported ArchieML blocks/spans in a data insight** → skipped/flattened
  to text, as today.
- **Date in a previous year** (January sends reaching back into December) →
  year appended.
- **Gmail clipping (~102KB HTML)**: react-email's inlined styles are verbose,
  and a weekly all-topics subscriber can receive 10+ items including several
  full data insight bodies. Not capped in v1; the snapshot test logs the
  rendered size of the all-types fixture, and the preview route displays the
  HTML byte size so we notice before launch. If real sends approach the
  limit, cap items with an "and N more on /latest" line (follow-up).
  Measured so far: 14KB for the four-item test fixture, and 62KB for a real
  30-day all-topics window (8 data insights with full bodies) — under the
  limit, but close enough that the cap is worth keeping in mind. The admin
  preview page surfaces this number on every render.

## Verification

- `yarn typecheck`, `yarn testLintChanged`, unit + snapshot tests.
- Visual pass on the admin preview page against the Figma mockup.
- `sendEmailNotifications --dry-run --local` end-to-end render from real data.
- Full send-path check through the existing postmarkCatcher
  (`yarn postmarkCatcher` + `POSTMARK_API_BASE_URL=http://localhost:8025`,
  then a `--local` send): exercises the real Postmark request —
  `TextBody`, `List-Unsubscribe` headers, metadata — with the caught email's
  HTML viewable at `http://localhost:8025` and the payload (including the
  plain-text body) as JSON.
- Real-client spot check: send a preview to ourselves via Postmark
  (Gmail web/iOS, Apple Mail, Outlook) before launch.

## Out of scope / follow-ups

- Final newsletter name (constant swap) and whether the subject line
  ("Your {daily|weekly} update from Our World in Data") should match it.
- Kicker icons as hosted PNGs, if we decide placeholder-box risk is
  acceptable or find a collapse-safe technique.
- Designed transactional emails (welcome, magic link) on a shared layout.
- Item cap / digest truncation for very full weeks.
- Dark-mode-specific styling.
