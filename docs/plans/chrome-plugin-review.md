# Chrome Extension Review

## Scope

- Compared branch against master base commit 502770eda78539e145d483334a9db9ef1b25bac1.
- Reviewed docs/plans/chrome-plugin.md implementation plan and notes.

## Findings

1. High: `FunctionalRouter` double-send risk. `getGdocRaw` and `getGdocAttachments` call `res.json`, then `FunctionalRouter.wrap` will still call `res.send` with the callback return value. This can trigger "headers already sent" errors and unstable responses. Prefer `res.set(...)` + `return data` instead of `res.json(...)`. Files: `adminSiteServer/apiRoutes/gdocs.ts:406`, `adminSiteServer/apiRoutes/gdocs.ts:444`.
2. High: Attachment data can drift from live content. `getGdocAttachments` uses `GdocsContentSource.Internal`, which loads attachments from stored DB content and ignores current Google Doc edits. New charts/images will not show until the doc is refreshed into the DB. Consider using `GdocsContentSource.Gdocs` on manual attachment refresh or accepting a `contentSource` param. File: `adminSiteServer/apiRoutes/gdocs.ts:471`.
3. Medium: Sidepanel does not update on tab navigation. `fetchDocId` runs only once on mount, so switching to a different doc in the same tab keeps the preview stuck on the previous doc until the panel is reloaded. Add a listener (`chrome.tabs.onUpdated` or a content script message) to refresh `docId`. File: `chrome-extension/src/sidepanel/App.tsx:52`.
4. Medium: Auth failure can look like a JSON parse error. `proxyFetch` assumes any 200 response is JSON; a 302 redirect to login yields HTML and throws `SyntaxError`, which is surfaced as a generic error rather than an auth prompt. Check `response.headers.get("content-type")` or `response.redirected` and convert to an auth error when needed. File: `chrome-extension/src/background/service-worker.ts:53`.
5. Low: Cookie logging leaks session info in extension logs. The service worker logs cookie names and the start of the cookie header; this is sensitive and should be removed or guarded by a debug flag. File: `chrome-extension/src/background/service-worker.ts:41`.
6. Low: Crypto shim returns a non-SHA hash, so inline ref IDs differ from production and can collide more easily. This is probably OK for local preview but diverges from server behavior. Files: `chrome-extension/src/shims/crypto.ts:1`, `db/model/Gdoc/archieToEnriched.ts:206`.

## Crypto Alternatives (more elegant)

- Use a small SHA-1 implementation such as `@noble/hashes/sha1` or `sha.js` and wrap it in a shared `hashInlineRef` helper. This keeps sync hashing and matches server output without stubbing `crypto` globally.
- Inject a hash function into `extractRefs` (or `archieToEnriched`) so Node uses `createHash` and the extension supplies a browser SHA-1 implementation.
- Bigger change: make the parsing pipeline async and use `crypto.subtle.digest` in the browser. This removes the shim but will ripple through call sites.

## Tests

- No automated tests added for the new admin endpoints or extension flows. Consider minimal API tests for `/admin/api/gdocs/:id/raw` and `/admin/api/gdocs/:id/attachments`, plus a basic auth failure case (HTML redirect) to verify the error path.

## Questions

- Is the staleness of attachment data acceptable for the preview use case, or should attachment refresh hit the live doc content?
- Should the extension harden `proxyFetch` to only send admin cookies to known admin URLs?
