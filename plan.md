# Slideshow Builder - Implementation Plan

## Phase 1: Foundation

### 1. Data model & migration

#### `slideshows` table

| Column      | Type             | Notes                          |
| ----------- | ---------------- | ------------------------------ |
| id          | int AUTO_INCREMENT | PK                           |
| slug        | varchar, unique  | URL-friendly identifier        |
| title       | varchar          | Display title                  |
| config      | JSON             | Full slide array + settings    |
| userId      | int              | FK to users, creator           |
| createdAt   | datetime         |                                |
| updatedAt   | datetime         |                                |
| isPublished | tinyint(1)       | Default 0                      |
| publishedAt | datetime, nullable |                              |

The `config` JSON column is the source of truth for all slide content. It stores an ordered array of slides, each with their template type and template-specific fields. This avoids a normalized `slideshow_slides` table since slides are always loaded/saved as a unit and never queried independently (same pattern as `chart_configs.full`).

#### `slideshow_links` table

Tracks outgoing references to graphers, explorers, URLs, etc. by slug. Mirrors `posts_gdocs_links`. Rebuilt on every save.

| Column      | Type    | Notes                                              |
| ----------- | ------- | -------------------------------------------------- |
| id          | int AUTO_INCREMENT | PK                                        |
| slideshowId | int    | FK to slideshows (ON DELETE CASCADE)               |
| target      | varchar | Slug or URL of the linked asset                   |
| linkType    | enum   | Reuse `ContentGraphLinkType` (grapher, explorer, url, etc.) |
| queryString | varchar | For grapher tab/entity params                     |
| hash        | varchar | Fragment                                          |

#### `slideshow_x_images` table

Many-to-many join with FK to `images`. Mirrors `posts_gdocs_x_images`. Rebuilt on every save.

| Column      | Type    | Notes                              |
| ----------- | ------- | ---------------------------------- |
| id          | int AUTO_INCREMENT | PK                        |
| slideshowId | int    | FK to slideshows (ON DELETE CASCADE) |
| imageId     | int    | FK to images                       |

#### Other type/docs work

- Add type definitions in `packages/@ourworldindata/types/src/dbTypes`
- Add table docs in `db/docs/slideshows.yml`, `db/docs/slideshow_links.yml`, `db/docs/slideshow_x_images.yml`
- Export types from index

### 2. CRUD API (`adminSiteServer/apiRoutes/slideshows.ts`)

| Method | Route                        | Notes                                                        |
| ------ | ---------------------------- | ------------------------------------------------------------ |
| GET    | `/api/slideshows.json`       | List all (for index page)                                    |
| POST   | `/api/slideshows`            | Create new slideshow                                         |
| GET    | `/api/slideshows/:id.json`   | Get one (config + metadata)                                  |
| PUT    | `/api/slideshows/:id`        | Save full config; rebuild `slideshow_links` and `slideshow_x_images` |
| DELETE | `/api/slideshows/:id`        | Delete (cascades to links and images join)                   |

On every PUT, the save handler should:
1. Update the `slideshows` row (config, updatedAt, etc.)
2. Delete all existing `slideshow_links` for this slideshow
3. Parse the config to extract grapher/explorer/URL references and re-insert into `slideshow_links`
4. Delete all existing `slideshow_x_images` for this slideshow
5. Parse the config to extract image references and re-insert into `slideshow_x_images`

Register routes in `apiRouter.ts`.

### 3. Admin routing & navigation

- Add routes in `AdminApp.tsx`: `/slideshows`, `/slideshows/:id/edit`
- Add sidebar link in `AdminSidebar.tsx`

---

## Phase 2: MVP Editor

### 4. Slideshows index page (`SlideshowsIndexPage.tsx`)

- List view with title, author, last edited, published status
- Create new / delete actions
- Follow existing index page pattern (MobX observer, `getData()` in `componentDidMount`)

### 5. Slide editor page - scaffolding (`SlideshowEditPage.tsx`)

- Three-tab left panel: Edit / Arrange / Preview
- Bottom slide strip with thumbnails, nav arrows, duplicate/delete/add buttons
- Save & Publish buttons in footer
- MobX store for editor state (current slide index, slide array, dirty tracking)
- Start with 2-3 core templates: **Image/Chart Only**, **Section**, **Title Slide**

### 6. Edit tab - template selector & options

- Template picker (popular shortcuts + full dropdown)
- Template options panel that adapts per template type
- For Image/Chart Only: upload image field, grapher URL field, section title checkbox, slide title checkbox
- Text editing for titles, body text, etc.

### 7. Arrange tab

- Drag-to-reorder slide list (using `@dnd-kit` or similar)
- Each row shows thumbnail + slide title + template type

---

## Phase 3: Rich Features

### 8. Drag-to-upload images

- Reuse existing image upload infrastructure (`fileToBase64`, Cloudflare Images upload)
- Drop zone on the slide canvas and/or the upload field
- Uploaded images go into the shared `images` table (reusable across site)

### 9. Grapher embedding

- Render live `<Grapher>` component on slides that reference a grapher URL
- Parse grapher URL to extract chart slug + query params

### 10. Presentation mode

- Fullscreen slide view with keyboard navigation (arrow keys, escape to exit)
- Separate route (`/slideshows/:id/present`) or overlay
- Consider whether this should be accessible without admin auth (for presenting at conferences)

### 11. Seamless Grapher transitions

- Animate between consecutive grapher slides (e.g. tab changes, entity changes)
- Scope TBD - this is the most complex single feature

### 12. Remaining slide layouts

- Image/Chart with text
- Blank
- Two Column Text
- Quote
- Big Number
- Full Slide Image

Each template needs: a type definition, an editor options panel, and a slide renderer.

---

## Future considerations (not yet scoped)

- Undo/redo history stack
- Speaker notes
- Duplicate slideshow
- Export (PDF/PPTX)
- Auto-save
- Keyboard shortcuts in editor
- Slide aspect ratio (locked 16:9?)
