# Chrome Extension Changes

## Latest updates

- Added tab interface with Preview and Components tabs
- Components tab shows a gallery of all available gdoc components with realistic example data
- Each component card includes a "Copy" button that copies the ArchieML syntax to clipboard
- Search functionality to filter components by name
- Components tab works without requiring authentication or being on a Google Doc

### Previous updates

- Added a `runDetailsOnDemandWithDetails` helper in `site/detailsOnDemand.tsx` to reuse the tooltip wiring without triggering a fetch.
- Updated the extension preview to fetch parsed DODs via the auth-aware background proxy, then hydrate DOD tooltips with the new helper.
- Hydrated footnote tooltips after each preview render to match site behavior.

## Files touched

### Tab interface implementation
- `chrome-extension/src/sidepanel/TabBar.tsx` (new) - Tab bar component for switching between Preview and Components
- `chrome-extension/src/sidepanel/ComponentGallery.tsx` (new) - Gallery showing all available components
- `chrome-extension/src/sidepanel/ComponentCard.tsx` (new) - Individual component preview with copy functionality
- `chrome-extension/src/sidepanel/componentGalleryExamples.ts` (new) - Realistic example data for components
- `chrome-extension/src/sidepanel/App.tsx` - Added tab state and conditional rendering
- `chrome-extension/src/sidepanel/Toolbar.tsx` - Added search variant for components tab
- `chrome-extension/src/sidepanel/styles.scss` - Added styles for tabs, search, and gallery

### Previous files
- `site/detailsOnDemand.tsx`
- `chrome-extension/src/shared/api.ts`
- `chrome-extension/src/sidepanel/Preview.tsx`
