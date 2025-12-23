# Chrome Extension: OWID Google Docs Preview

## Overview

A Chrome extension that provides fast, real-time preview of OWID articles authored in Google Docs via a resizable sidepanel.

**Key decisions:**

- Uses OWID service account for Google Docs API (docs must be shared with service account)
- Full Chart component rendering via attachment context API
- Admin authentication required for API access
- Lives in `/chrome-extension` subfolder of owid-grapher
- **Separated content vs attachment fetching for speed**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Extension                             │
├─────────────────────────────────────────────────────────────────┤
│  Content Script          │  Sidepanel (React)                   │
│  - Extract doc ID        │  - Toolbar (refresh, auto-refresh)   │
│  - Detect changes        │  - CLIENT-SIDE PARSING:              │
│                          │    - gdocToArchie()                  │
│                          │    - archieToEnriched()              │
│                          │  - OwidGdoc rendering                │
│                          │  - AttachmentsContext provider       │
│                          │  - Caches attachments client-side    │
├──────────────────────────┴──────────────────────────────────────┤
│                     Background Service Worker                    │
│                     - Enable sidepanel on docs.google.com       │
└─────────────────────────────────────────────────────────────────┘
          │                                        │
          │ (frequent, every refresh)              │ (infrequent, cached)
          ▼                                        ▼
┌──────────────────────────────────┐  ┌────────────────────────────────┐
│ GET /admin/api/gdocs/:id/raw     │  │ GET /admin/api/gdocs/:id/      │
│                                  │  │     attachments                │
│ - Pure proxy to Google Docs API  │  │                                │
│ - Returns raw Schema$Document    │  │ - Loads charts, images, etc.   │
│ - NO parsing, NO database        │  │ - Database queries             │
│ - Credentials stay server-side   │  │ - Slower, but cached           │
└──────────────────────────────────┘  └────────────────────────────────┘
```

**Refresh strategy:**

- Raw content: Fetched on every manual refresh or auto-refresh tick (e.g. every 2-3 seconds). Parsed client-side.
- Attachments: Fetched once on initial load, then every 30-60 seconds or on manual "refresh attachments" action

---

## Implementation Phases

### Phase 1: New Admin API Endpoints

**File:** `adminSiteServer/apiRoutes/gdocs.ts`

#### Endpoint 1: `GET /admin/api/gdocs/:id/raw` (Fast, frequent)

**Pure proxy to Google Docs API.** No parsing, no enrichment - just forwards the raw response. Service account credentials stay server-side.

```typescript
export async function getGdocRaw(
    req: Request,
    res: e.Response
    // Note: no trx parameter - no DB access needed
) {
    const id = req.params.id

    // Just fetch raw Google Doc and return it
    const auth = await getGoogleReadonlyAuth()
    const docs = googleDocs({ auth })
    const response = await docs.documents.get({
        documentId: id,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })

    res.set("Cache-Control", "no-store")
    res.json(response.data) // Raw Schema$Document from Google
}
```

**Client-side processing (in extension):**

- `gdocToArchie()` - Convert Google AST to ArchieML
- `archieToEnriched()` - Parse ArchieML to enriched blocks
- Validation and error collection

#### Endpoint 2: `GET /admin/api/gdocs/:id/attachments` (Slow, cached)

Loads attachment context from database.

```typescript
export async function getGdocAttachments(
    req: Request,
    res: e.Response,
    trx: db.KnexReadonlyTransaction
) {
    const id = req.params.id

    // Load gdoc with attachments from DB (or create if new)
    const gdoc = await getAndLoadGdocById(
        trx,
        id,
        GdocsContentSource.Internal, // Use DB content, just need attachments
        false
    )

    // Return only attachment context
    res.set("Cache-Control", "no-store")
    res.json({
        linkedAuthors: gdoc.linkedAuthors,
        linkedCharts: gdoc.linkedCharts,
        linkedIndicators: gdoc.linkedIndicators,
        linkedDocuments: gdoc.linkedDocuments,
        imageMetadata: gdoc.imageMetadata,
        relatedCharts: gdoc.relatedCharts,
        linkedNarrativeCharts: gdoc.linkedNarrativeCharts,
        linkedStaticViz: gdoc.linkedStaticViz,
        tags: gdoc.tags,
    })
}
```

**Register routes in:** `adminSiteServer/appClass.tsx`

---

### Phase 2: Chrome Extension Scaffold

**Directory structure:**

```
/chrome-extension/
├── manifest.json
├── vite.config.ts
├── package.json
├── tsconfig.json
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   └── content-script.ts
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── Preview.tsx
│   │   ├── Toolbar.tsx
│   │   └── styles.scss
│   └── shared/
│       ├── api.ts
│       └── types.ts
└── public/
    └── icons/
```

**manifest.json (Manifest V3):**

```json
{
    "manifest_version": 3,
    "name": "OWID Article Preview",
    "version": "1.0.0",
    "permissions": ["sidePanel", "activeTab", "storage"],
    "host_permissions": [
        "https://docs.google.com/*",
        "https://admin.owid.io/*",
        "https://api.ourworldindata.org/*",
        "https://ourworldindata.org/*"
    ],
    "background": {
        "service_worker": "background/service-worker.js",
        "type": "module"
    },
    "content_scripts": [
        {
            "matches": ["https://docs.google.com/document/*"],
            "js": ["content/content-script.js"]
        }
    ],
    "side_panel": {
        "default_path": "sidepanel/index.html"
    }
}
```

---

### Phase 3: Background & Content Scripts

**service-worker.ts:**

- Enable sidepanel on Google Docs pages
- Handle extension icon click

**content-script.ts:**

- Extract Google Doc ID from URL: `/document/d/([a-zA-Z0-9_-]+)/`
- Respond to sidepanel requests for doc ID
- Optional: MutationObserver for change detection (auto-refresh)

---

### Phase 4: Sidepanel UI

**Toolbar.tsx:**

- Refresh content button (fast)
- Refresh attachments button (slower, shows when attachments are stale)
- Auto-refresh toggle (content every 2-3 seconds, attachments every 60 seconds)
- Loading indicators (separate for content vs attachments)
- Auth status indicator

**App.tsx:**

- Fetch doc ID from content script
- Manage two separate data fetches:
    - `fetchRawContent()` - calls `/admin/api/gdocs/:id/raw` (fast, frequent)
    - `fetchAttachments()` - calls `/admin/api/gdocs/:id/attachments` (slow, cached)
- **Client-side parsing pipeline** after fetching raw content
- Cache attachments in state, refresh on timer or manual action
- Handle auth errors (prompt login to admin.owid.io)
- Handle loading/error states

```typescript
import { gdocToArchie } from "@owid/db/model/Gdoc/gdocToArchie"
import { archieToEnriched } from "@owid/db/model/Gdoc/archieToEnriched"

const [content, setContent] = useState<OwidGdocContent | null>(null)
const [attachments, setAttachments] = useState<Attachments | null>(null)
const [errors, setErrors] = useState<OwidGdocErrorMessage[]>([])

// Fetch raw content and parse client-side
const fetchAndParseContent = async () => {
    // 1. Fetch raw Google Doc (via server proxy)
    const rawDoc = await api.getGdocRaw(docId) // Schema$Document

    // 2. Convert to ArchieML text
    const archieText = await gdocToArchie(rawDoc)

    // 3. Parse to enriched blocks
    const { content, errors } = archieToEnriched(archieText)

    setContent(content)
    setErrors(errors)
}

// Attachments: refresh infrequently, cached
const fetchAttachments = async () => {
    const data = await api.getGdocAttachments(docId)
    setAttachments(data)
}

// Auto-refresh content every 2-3 seconds
// Auto-refresh attachments every 60 seconds (or manual trigger)
```

**Preview.tsx:**

- Wrap with `AttachmentsContext.Provider` using cached attachments
- Render `OwidGdoc` component from `site/gdocs/OwidGdoc.tsx`
- Set `isPreviewing={true}`
- Gracefully handle missing attachments (show placeholders for charts/images not yet loaded)

---

### Phase 5: Vite Build Configuration

**vite.config.ts:**

```typescript
export default defineConfig({
    build: {
        target: ["chrome114"], // Sidepanel API minimum
        rollupOptions: {
            input: {
                "sidepanel/index": "src/sidepanel/index.html",
                "background/service-worker": "src/background/service-worker.ts",
                "content/content-script": "src/content/content-script.ts",
            },
        },
    },
    resolve: {
        alias: { "@owid": resolve(__dirname, "..") },
    },
    define: {
        // Production URLs for chart rendering
        "process.env.BAKED_GRAPHER_URL": JSON.stringify(
            "https://ourworldindata.org/grapher"
        ),
        "process.env.DATA_API_URL": JSON.stringify(
            "https://api.ourworldindata.org/v1"
        ),
        "process.env.CLOUDFLARE_IMAGES_URL": JSON.stringify(
            "https://images.ourworldindata.org/public"
        ),
    },
})
```

---

### Phase 6: Styling

**styles.scss:**

- Import OWID styles: `@import "../../site/owid.scss"`
- Scope within `.owid-preview-extension` container
- Override for sidepanel context (max-width, padding, etc.)

---

## Authentication Flow

1. Extension makes requests to `admin.owid.io` with `credentials: "include"`
2. Browser sends admin session cookie if user is logged in
3. If 401/403, show "Please log in to OWID admin" with link
4. User logs in via normal admin flow, then refreshes extension

---

## Error Handling

| Error          | Display                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| Not logged in  | "Please log in to OWID admin" + login link                               |
| Doc not shared | "Share document with owid-gdocs@owid-production.iam.gserviceaccount.com" |
| Network error  | Retry button                                                             |
| Parse errors   | Show validation errors from `gdoc.errors`                                |

---

## Critical Files to Modify/Create

**Backend (modify):**

- `adminSiteServer/apiRoutes/gdocs.ts` - Add two new endpoints:
    - `getGdocRaw` - Pure proxy to Google Docs API, no parsing
    - `getGdocAttachments` - Loads attachment context from DB
- `adminSiteServer/appClass.tsx` - Register new routes

**Extension (create):**

- `chrome-extension/manifest.json`
- `chrome-extension/vite.config.ts`
- `chrome-extension/package.json`
- `chrome-extension/src/background/service-worker.ts`
- `chrome-extension/src/content/content-script.ts`
- `chrome-extension/src/sidepanel/index.html`
- `chrome-extension/src/sidepanel/main.tsx`
- `chrome-extension/src/sidepanel/App.tsx`
- `chrome-extension/src/sidepanel/Preview.tsx`
- `chrome-extension/src/sidepanel/Toolbar.tsx`
- `chrome-extension/src/sidepanel/styles.scss`
- `chrome-extension/src/shared/api.ts`

**Bundle in extension (parsing pipeline):**

- `db/model/Gdoc/gdocToArchie.ts` - Google AST → ArchieML
- `db/model/Gdoc/archieToEnriched.ts` - ArchieML → enriched blocks
- `db/model/Gdoc/rawToEnriched.ts` - Block parsing
- `db/model/Gdoc/htmlToEnriched.ts` - HTML → spans

**Bundle in extension (rendering):**

- `site/gdocs/OwidGdoc.tsx` - Main rendering component
- `site/gdocs/AttachmentsContext.tsx` - Attachment context provider
- `site/gdocs/components/*` - All block components
- `site/owid.scss` - Styles

---

## Bundle Considerations

The extension bundles:

1. **Parsing code** - `gdocToArchie`, `archieToEnriched`, etc. (relatively small)
2. **Rendering components** - All gdoc block components + Grapher (larger)
3. **Styles** - OWID CSS

The extension will be larger than typical extensions due to Grapher dependencies, but this is acceptable for an internal team tool. Tree-shaking via Vite will help minimize size.

**Note:** The parsing code in `db/model/Gdoc/` may have some server-only dependencies (e.g., Cheerio for HTML parsing). May need to ensure these work in browser context or find browser-compatible alternatives.

If bundle size becomes problematic, could later optimize by:

- Using iframes for charts instead of embedding Grapher
- Lazy-loading chart components
- Excluding unused block types

---

## Implementation Status

### Completed (Initial Implementation Session)

#### Backend API Endpoints

- **`GET /admin/api/gdocs/:id/raw`** - Implemented in `adminSiteServer/apiRoutes/gdocs.ts`
    - Pure proxy to Google Docs API
    - No database access, no parsing
    - Added `getRouteWithoutTransaction` helper to `functionalRouterHelpers.ts`

- **`GET /admin/api/gdocs/:id/attachments`** - Implemented in `adminSiteServer/apiRoutes/gdocs.ts`
    - Returns attachment context from database
    - Handles case where gdoc doesn't exist in DB yet (returns empty attachments)

#### Chrome Extension Structure

All files created in `/chrome-extension/`:

- `manifest.json` - Manifest V3 with sidepanel, cookies, tabs permissions
- `package.json` - Added to yarn workspaces
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration with custom plugins
- `src/background/service-worker.ts` - Sidepanel management + API proxy
- `src/content/content-script.ts` - Doc ID extraction (currently unused)
- `src/sidepanel/` - React UI (App, Toolbar, Preview, styles)
- `src/shared/api.ts` - API client routing through background script
- `src/shared/types.ts` - TypeScript types
- `src/shims/crypto.ts` - Browser-compatible hash function

#### Build System

- Extension added to yarn workspaces in root `package.json`
- Vite configured with:
    - React plugin with decorator support for MobX
    - esbuild target `es2024` for decorator compilation
    - Custom plugin to copy manifest.json and fix HTML paths
    - Alias for `@owid` imports
    - Browser shim for Node.js `crypto` module

---

## Issues Encountered

### 1. Node.js `crypto` Module Not Available in Browser

**Problem:** `archieToEnriched.ts` imports `createHash` from Node.js `crypto` module for generating footnote reference IDs.

**Solution:** Created a browser-compatible shim (`src/shims/crypto.ts`) using the `cyrb53` hash algorithm - a fast, synchronous hash function suitable for generating IDs (not for cryptographic security). The Web Crypto API (`crypto.subtle.digest`) is async and would require refactoring the OWID codebase.

### 2. MobX Decorators Not Compiling

**Problem:** Build failed with "Decorators are not valid here" errors from esbuild when processing Grapher components that use `@observer` and other MobX decorators.

**Solution:** Configured vite with:

```typescript
esbuild: {
    target: "es2024"
}
plugins: [react({ babel: { parserOpts: { plugins: ["decorators"] } } })]
```

### 3. Chrome Extension Cookie Context

**Problem:** Requests from the sidepanel to `admin.owid.io` returned HTML (Cloudflare auth page) instead of JSON. The extension's fetch requests don't automatically include cookies from the target domain.

**Solution:**

- Added `cookies` permission to manifest
- Moved API fetching to background service worker which has access to `chrome.cookies` API
- Background script fetches cookies via `chrome.cookies.getAll({ domain: "admin.owid.io" })` and includes them in request headers
- Sidepanel communicates with background via `chrome.runtime.sendMessage`

### 4. `chrome.cookies` Not Available in Sidepanel

**Problem:** After adding cookies permission, got error "Cannot read properties of undefined (reading 'getAll')" - the `chrome.cookies` API is only available in background scripts, not in sidepanel context.

**Solution:** Refactored to proxy all API requests through the background service worker:

- Sidepanel sends `{ type: "FETCH_API", url }` message
- Background script performs fetch with cookies and returns response
- This pattern keeps all privileged Chrome API usage in the background script

### 5. Document ID Retrieval via Content Script

**Problem:** Initial implementation used content script to extract doc ID, but message passing between sidepanel → background → content script was unreliable.

**Solution:** Simplified to use `chrome.tabs.query` directly from sidepanel to get the active tab's URL and extract doc ID with regex. Required adding `tabs` permission.

### 6. HTML Output Path Mismatch

**Problem:** Vite outputs HTML to `dist/src/sidepanel/index.html` preserving source structure, but manifest expects `dist/sidepanel/sidepanel.html`.

**Solution:** Custom Vite plugin copies HTML to correct location and rewrites relative paths from `../../sidepanel/` to `./`.

---

## Current Status

The extension builds successfully and loads in Chrome. The basic infrastructure is in place:

- Sidepanel opens on Google Docs pages
- Doc ID is extracted from URL
- API requests are proxied through background script with cookies
- UI shows loading/error states

**Next steps to complete:**

1. ~~Test the full flow with a real Google Doc shared with the service account~~ ✅
2. ~~Verify parsing pipeline works correctly in browser~~ ✅
3. ~~Test OwidGdoc rendering with attachments~~ ✅
4. ~~Add proper OWID styles~~ ✅
5. Handle edge cases and improve error messages
6. Switch API URL from localhost to production once backend is deployed
7. Consider adding extension options page to configure API URL

---

## Session 2 Learnings

### 7. Testing Against Production vs Localhost

**Problem:** The new API endpoints (`/admin/api/gdocs/:id/raw` and `/attachments`) only exist in the local branch, not on production `admin.owid.io`. Requests to production returned the admin SPA HTML instead of JSON.

**Solution:** Updated extension to point to `http://localhost:3030` for development. Added localhost to `host_permissions` in manifest. The API URL is configured in `src/shared/api.ts`:

```typescript
const ADMIN_BASE_URL = "http://localhost:3030"
// const ADMIN_BASE_URL = "https://admin.owid.io"
```

### 8. Localhost Cookie Handling

**Problem:** Even with the extension pointing to localhost, requests were redirected to login page (302 to `/admin/login`). The local admin server also requires authentication via session cookies.

**Solution:** Updated `getCookiesForUrl()` in the background service worker to handle localhost differently:

```typescript
if (url.includes("localhost")) {
    cookies = await chrome.cookies.getAll({ url: "http://localhost:3030" })
} else {
    cookies = await chrome.cookies.getAll({ domain: "admin.owid.io" })
}
```

Note: Must be logged into the local admin in the same browser before using the extension.

### 9. Preview Styling Mismatch

**Problem:** The preview in the extension looked significantly different from the admin preview - missing yellow header banner, wrong fonts, different layout.

**Root causes:**

1. Missing wrapper structure that OWID CSS targets
2. Missing font loading (OWID uses Lato and Playfair Display)
3. Extension's custom CSS overriding OWID base styles

**Solution:**

1. **Added proper wrapper structure** in `Preview.tsx`:

    ```tsx
    <div id="owid-document-root">
        <DebugProvider debug={true}>
            <OwidGdoc {...gdocProps} isPreviewing={true} />
        </DebugProvider>
    </div>
    ```

2. **Added Google Fonts** to `index.html`:

    ```html
    <link
        href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap"
        rel="stylesheet"
    />
    ```

3. **Imported OWID site styles** in `main.tsx`:

    ```tsx
    import "@owid/site/owid.scss"
    import "./styles.scss" // Extension-only overrides after
    ```

4. **Removed conflicting styles** from `styles.scss` - removed html/body resets and font-family overrides that were fighting with OWID's base styles. Kept only extension-specific UI styles (toolbar, error states).

### 10. Debug Logging for Cookie Issues

Added console logging to the background service worker to help debug cookie-related auth issues:

```typescript
console.log(
    "Localhost cookies found:",
    cookies.map((c) => c.name)
)
console.log(
    "Cookie header:",
    cookieString ? cookieString.substring(0, 50) + "..." : "(empty)"
)
```

These logs appear in the Service Worker DevTools console (accessible from `chrome://extensions` → "Service Worker" link).

---

## Recent Updates (2025-12-23)

- Avoid double-send responses in new gdoc endpoints by returning data instead of calling `res.json` directly.
- Refresh the sidepanel preview when the active tab or URL changes, and treat login redirects/HTML responses as auth errors.
- Replace the crypto shim with `@noble/hashes` (SHA-1) for consistent inline ref hashing.
- Added chrome-extension typecheck adjustments to align with repo-wide React typings.
- Added a review document at `docs/plans/chrome-plugin-review.md`.
