# Google Tag Manager & GA4

How client-side analytics gets onto our pages, and how to debug it — especially
on staging, where the naive approach fails in several confusing ways.

## How GTM gets onto a page

`site/Head.tsx` (`GTMScriptTags`) renders the GTM snippet **at bake time** if
`GOOGLE_TAG_MANAGER_ID` is set in the environment doing the bake. If it's
unset (the default outside production), pages are baked **without any GTM
snippet**. The production container is `GTM-N2D4V8S`.

Staging bakes deliberately leave it unset so staging/crawler traffic doesn't
pollute production GA4. (The related `CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE:
"0"` override in `wrangler.jsonc` only silences the _server-side_
`cf_function_invocation` events — it has nothing to do with the GTM snippet.)

## dataLayer vs. the data model, and what `_clear` does

`window.dataLayer` is just a message queue. GTM folds each pushed object into
its internal persistent key→value store (the "data model"); tags and Data
Layer Variables read from the model, never from the array.

By default, arrays/objects in a push are recursively merged into the model's
existing values. `_clear: true` switches the keys **in that same push** to
overwrite instead of merge. It does **not** remove other keys from the model,
and does not reset it: values pushed earlier (e.g. a page-load push) survive
every later `_clear` push, and a stale key from a previous event survives
events that omit it. Verified against the live container in
[PR #6791](https://github.com/owid/owid-grapher/pull/6791#discussion_r3620246248);
background: [Simo Ahava, Two Simple Data Model Tricks](https://www.simoahava.com/analytics/two-simple-data-model-tricks/).

Also remember: pushing to the dataLayer sends nothing to GA4 by itself. GTM
only forwards what its container is configured to forward (Data Layer Variable

- parameter/user-property mapping on the GA4 tags, set up in the GTM UI).

Quick console checks on any page with GTM:

```js
google_tag_manager["GTM-N2D4V8S"].dataLayer.get("asn") // current model value
dataLayer.push({ event: "GAEvent", eventAction: "test", _clear: true })
```

## Debugging with Tag Assistant on a staging server

1. **Get GTM onto the staging bake.** Push a temporary commit to your branch
   that falls back to the production container in `settings/clientSettings.ts`
   (`process.env.GOOGLE_TAG_MANAGER_ID ?? "GTM-N2D4V8S"`), clearly marked
   "remove before merge", and wait ~10 min for the rebake. Test hits land in
   production GA4 but are identifiable by the staging hostname and stop when
   the commit is reverted.
2. **Start the preview from the GTM UI**, not from tagassistant.google.com:
   [tagmanager.google.com](https://tagmanager.google.com/) → container →
   **Preview** → enter the staging URL. Standalone Tag Assistant can detect
   the tags but will say the container "is not enabled for debugging".
   GTM Preview serves your **unsaved workspace draft**, so you can build and
   test variable/tag wiring without publishing anything. (Publishing the
   container affects production — coordinate that.)
3. **Consent starts denied** (`site/Head.tsx` consent defaults), so GA4 sends
   cookieless pings until you accept the cookie banner in the debug window.

Failure modes, in the order you'll hit them:

- **"No debuggable Google tags" / connection timeout** — the page has no GTM
  snippet (see step 1), or your ad blocker is eating `gtm.js`.
- **"Google tag: GTM-… not found"** — the debug window loaded but `gtm.js` was
  blocked: check DevTools → Network for `ERR_BLOCKED_BY_CLIENT` (that error is
  always caused by a browser extension). A blocked
  `static.cloudflareinsights.com/beacon.min.js` is unrelated noise — filter
  for `gtm`. Note that `pages.dev` is on the Public Suffix List, so per-site
  blocker exemptions must be set on the exact `<branch>.owid.pages.dev` site,
  ideally from inside the debug window. When in doubt, use incognito with only
  the Tag Assistant Companion extension enabled.
- **Handshake timeouts despite gtm.js loading** — install the
  [Tag Assistant Companion](https://chromewebstore.google.com/detail/tag-assistant-companion/jmekfmbnaedfebfnmakmokmlfpblbfdm)
  extension; with third-party cookies restricted, the debug window handshake
  often fails without it.
