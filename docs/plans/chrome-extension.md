# Chrome Extension Changes

## Latest updates

- Added a `runDetailsOnDemandWithDetails` helper in `site/detailsOnDemand.tsx` to reuse the tooltip wiring without triggering a fetch.
- Updated the extension preview to fetch parsed DODs via the auth-aware background proxy, then hydrate DOD tooltips with the new helper.
- Hydrated footnote tooltips after each preview render to match site behavior.

## Files touched

- `site/detailsOnDemand.tsx`
- `chrome-extension/src/shared/api.ts`
- `chrome-extension/src/sidepanel/Preview.tsx`
