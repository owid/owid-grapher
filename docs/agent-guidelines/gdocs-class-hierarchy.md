# Gdocs Class Hierarchy

This note complements the Google Docs CMS pipeline overview by mapping the server-side class structure that models Google Docs content. All classes live in `db/model/Gdoc/` and ultimately persist to the `posts_gdocs` table.

## Base Class: `GdocBase`

`GdocBase` (`db/model/Gdoc/GdocBase.ts`) implements the shared life cycle for every Google Doc type:

- Fetches the document from the Google Docs API (`fetchAndEnrichGdoc`), records the `revisionId`, and converts the document to enriched JSON (`gdocToArchie` → `archieToEnriched`).
- Provides shared state: `content`, `linkedCharts`, `linkedIndicators`, `linkedDocuments`, `imageMetadata`, `latestDataInsights`, `errors`, etc.
- Coordinates attachment loading (`loadLinkedCharts`, `loadLinkedIndicators`, `loadLinkedDocuments`, `loadImageMetadataFromDB`, `loadNarrativeChartsInfo`).
- Enforces cross-cutting validation (`validate`) including whitespace checks, linked author verification, image metadata completeness, and link integrity.
- Offers hook methods that subclasses override:
    - `_getSubclassEnrichedBlocks` to expose extra content for markdown/export.
    - `_enrichSubclassContent` for post-parse transformations.
    - `_validateSubclass` for type-specific validation.
    - `_loadSubclassAttachments` for bespoke data fetches.
    - `typeSpecificFilenames` / `typeSpecificUrls` to augment dependency discovery.
- Supplies computed helpers such as `enrichedBlockSources`, `linkedImageFilenames`, and `links` that downstream code uses for rendering and dependency tracking.

`GdocBase` does not assume a concrete `OwidGdocType`; subclasses are responsible for shaping their `content` and validation rules.

## Subclasses

### `GdocPost` (`db/model/Gdoc/GdocPost.ts`)

- Represents the majority of articles (article, topic page, linear topic page, fragment).
- Generates derived structures: table of contents (`generateToc`), sticky nav (`generateStickyNav`), citations (`formatCitation`), FAQ parsing (`parseFaqs`), and summary text blocks.
- Exposes FAQ, reference, and deprecation notice blocks via `_getSubclassEnrichedBlocks` for markdown conversion.
- Validates required tags for certain components and ensures linked charts/indicators are present.

### `GdocDataInsight` (`db/model/Gdoc/GdocDataInsight.ts`)

- Focused on short-form insights highlighting a single chart or dataset.
- Enforces presence of `approved-by` metadata and tracks optional URLs (`grapher-url`, `narrative-chart`, `figma-url`).
- Loads latest data insight metadata and companion image information for preview panels.

### `GdocHomepage` (`db/model/Gdoc/GdocHomepage.ts`)

- Models the public homepage.
- Validates that only one homepage is published at a time.
- Loads aggregate site metrics (chart count, topic count, tag graph) plus latest data insights for homepage modules.

### `GdocAbout` (`db/model/Gdoc/GdocAbout.ts`)

- Used for about-style pages that may embed donor acknowledgements.
- Crawls the enriched block tree to detect donor blocks and, if present, loads donor names via `getPublicDonorNames`.

### `GdocAuthor` (`db/model/Gdoc/GdocAuthor.ts`)

- Represents author profile pages.
- Normalises HTML summary fields (bio) into enriched text, parses socials (`parseSocials`), and exposes these blocks to the markdown/export pipeline.
- Loads the author’s latest work (with fallback featured image) and associated image metadata.
- Warns when bio or social information is missing.

### `GdocAnnouncement` (`db/model/Gdoc/GdocAnnouncement.ts`)

- Lightweight wrapper for announcements; currently only inherits shared behaviour and reuses latest data insight metadata.

## Factory and Registration

- `GdocFactory.gdocFromJSON` maps database rows to subclass instances based on `content.type`. When a document is first ingested, `createGdocAndInsertIntoDb` instantiates `GdocBase`, fetches Google Docs content, then rehydrates the correct subclass via `loadGdocFromGdocBase`.
- `GdocFactory` also exposes helpers to list published instances of specific types (authors, data insights, homepages).

## Adding a New Gdoc Type

When introducing another document type:

1. **Define the type**
    - Add a new enum entry to `OwidGdocType` (`packages/@ourworldindata/types/src/gdocTypes/Gdoc.ts`) and extend any related type definitions (content interface, minimal interface, etc.).

2. **Implement a subclass**
    - Create `db/model/Gdoc/GdocYourType.ts` extending `GdocBase`.
    - Specify `content` with the correct TypeScript interface and override hooks for enrichment, validation, attachment loading, and dependency discovery as needed.

3. **Register the subclass**
    - Update `GdocFactory.gdocFromJSON` and `GdocFactory.loadGdocFromGdocBase` to route the new `OwidGdocType` to your class.
    - Wire any listing helpers (similar to `getPublishedDataInsights`) if the type needs querying endpoints.

4. **Update parsing expectations**
    - Ensure the ArchieML schema used by authors is supported by `rawToEnriched.ts` and `htmlToEnriched.ts`. Add or adjust block parsers if the new type introduces bespoke components.

5. **Extend validation & admin UI**
    - Provide subclass-specific validation messages by overriding `_validateSubclass`.
    - Adjust the admin interface if new front-matter fields or components need bespoke handling.

6. **Add tests and documentation**
    - Extend `db/gdocTests.test.ts` (or add new tests) to cover parsing and round-tripping.
    - Document authoring expectations in internal guides or ArchieML reference docs.

By following this pattern, new document types get the full lifecycle support—fetching, parsing, validation, enrichment, and persistence—while keeping behaviour encapsulated in targeted subclasses.
