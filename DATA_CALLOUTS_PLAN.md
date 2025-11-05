# Data Callout Feature Implementation Plan

## Overview

A new ArchieML component that allows embedding templated sentences in gdocs that get populated with real data from grapher charts. Used primarily in country profiles but also standalone.

## Syntax & Structure

### ArchieML Format

```
{.data-callout}
url: https://ourworldindata.org/grapher/production-vs-consumption-co2-emissions
entity: $entityName
[.+content]
In <a href="#callout:latestYear(Territorial emissions)">placeholder_year</a>, <a href="#callout:entity">placeholder_country</a> emitted <a href="#callout:latestValue(Territorial emissions)">placeholder_value</a> tonnes of CO2 domestically, but <a href="#callout:latestValue(Consumption-based emissions)">placeholder_value</a> when we adjust for trade.
[]
{}
```

**Key points:**

- `entity` can be `$entityName` (in profiles (See GdocProfile.ts and instantiateProfile in profiles.ts)) or a literal country name like `United States` (when not written as part of a profile)
- Entity names must match the official entity list (see regions.ts) (validated at parse time)
- `content` contains ONLY the templated statement - no surrounding text or components
- Other text/charts are siblings to the callout block, not children

### Link Syntax

Authors write rich-text links in the gdoc with anchor format: `#callout:functionName(parameterName)`

**Supported functions:**

- `latestYear(columnName)` - Returns the most recent year with data for this column
- `latestValue(columnName)` - Returns formatted value for this column at latest year
- `entity` - Returns entity name with proper article/possessive form (see `articulateEntity`)

**Example:** `<a href="#callout:latestYear(Consumption-based emissions)">year</a>`

This would render as "2024" in the client (assuming that that is the latest year for which there's data for whichever entity had been specified)

## Type Definitions

### ArchieML Types

```typescript
export const CALLOUT_FUNCTIONS = [
    "latestYear",
    "latestValue",
    "entity",
] as const
export type CalloutFunction = (typeof CALLOUT_FUNCTIONS)[number]

export type RawBlockDataCallout = {
    type: "data-callout"
    value: {
        url?: string
        entity?: string
        content?: RawBlockText[]
    }
}

export type EnrichedBlockDataCallout = {
    type: "data-callout"
    url: string
    entity: string
    content: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors
```

### Span Type

```typescript
export type SpanCallout = {
    spanType: "span-callout"
    value: CalloutFunction // "latestYear" | "latestValue" | "entity"
    parameters: string[] // e.g., ["Consumption-based emissions"]
    children: [] // the actual text to show is extracted from attachments
}
```

### Attachment Types

```typescript
// Reuse existing GrapherValuesJson types from GrapherValuesJson.ts
export interface GrapherValuesJson {
    entityName?: EntityName
    startTime?: Time
    endTime?: Time
    columns?: Record<ColumnSlug, GrapherValuesJsonDimension>
    startValues?: GrapherValuesJsonDataPoints
    endValues?: GrapherValuesJsonDataPoints
    source: string
}

export type LinkedCallout = {
    id: string // normalized URL + entity (e.g., "grapher/co2-emissions" or "grapher/vaccination-coverage-who-unicef?metric=coverage&antigen=comparison" for multidims)
    values: GrapherValuesJson
}

// Attachment structure
export type LinkedCallouts = Record<string, LinkedCallout>
```

## Architecture Decisions

### Code Location

- **`constructGrapherValuesJson`** must live in `@ourworldindata/grapher` (not utils) because it depends on `GrapherState`, `makeChartState`, and `MapChartState` from grapher. Moving it to utils would create a circular dependency.
- The CloudFlare functions will import from grapher after this refactor.
- For baking, we create a server-side wrapper that: fetches chart config from DB → loads data table → creates `GrapherState` → calls `constructGrapherValuesJson`.

### Admin Preview

- **Fetches real data on each preview** - no caching for v1. Authors need to see actual values to craft sensible sentences and verify entity support.
- If performance becomes an issue, we can add per-session caching later.

### Entity & Column Discovery

- **No UI assistance** - authors reference the actual grapher chart to see available entities and column names.
- Column name matching is **case-sensitive** and exact.

### Validation Errors

- **One error per mistake** - each missing column, invalid entity, or malformed function call produces its own error message.

### Implementation Scope

- **Phase 1**: Regular graphers only, with abstraction layer designed for extensibility
- **Phase 2** (same branch): Add MultiDim and Explorer support before merging

## Data Handling

### Key Generation

The `id` for a LinkedCallout is: `{normalizedUrl}+{entityName}`

**Normalization rules:**

- Remove base domain (just keep path + query)
- Sort query parameters alphabetically to make sure we don't duplicate data unnecessarily
- Example: `grapher/vaccination-coverage-who-unicef?metric=coverage&antigen=comparison` → `grapher/vaccination-coverage-who-unicef?antigen=comparison&metric=coverage`

### Fetching Strategy (Dev)

- implement a loadLinkedCallouts function on GdocBase and add it to the loadState method

### Fetching Strategy (Baking)

**Two-pass approach:**

1. **Pass 1 - Extract callouts:**
    - Parse all gdocs to find data-callout blocks
    - Build list of LinkedCallouts to fetch

2. **Fetch - Bulk data retrieval:**
    - For each LinkedCallout, initiate a grapher and fetch the metadata (see fetchDataValuesForGrapher in our cloudflare functions for inspiration - we might need to refactor that to share code)

3. **Pass 2 - Render:**
    - Provide `LinkedCallouts` via React context (similar to linkedCharts/linkedImages)
    - Render profiles with callouts resolved

### Data Validation

**At parse time (before publishing):**

- Validate entity names against regions.ts
- Validate callout function names against `CALLOUT_FUNCTIONS`
- Validate that column names in parameters exist in the chart (requires fetching chart metadata)
- **Block publishing if validation fails**

**At bake time (for already-published gdocs):**

- Check that all column names still exist in the chart
- If column missing or entity has no data → hide entire callout block (don't render it)
- Log error to Sentry with gdoc ID and missing column info
- Sentry alert triggers Slack notification linking to admin page for that gdoc

### Missing Data Behavior

If any data is unavailable (missing entity, missing column, missing value at endTime):

- Don't render the callout block at all
- Surrounding text/components render normally (they're siblings, not children)
- Authors see validation errors in admin before publishing
- Post-publish data changes trigger Sentry alerts

## Rendering Implementation

A new case for a Callout will need to be added to SpanElements.tsx

**Context requirements:**

- Need `currentCalloutUrl` and `currentEntity` from wrapping DataCallout component
- Similar to how span-guided-chart-link uses chart context

```tsx
export const DataCallout = ({
    url,
    entity,
    content,
}: EnrichedBlockDataCallout) => {
    const linkedCallouts = useContext(LinkedCalloutsContext)
    const calloutKey = generateCalloutKey(url, entity)
    const calloutData = linkedCallouts[calloutKey]

    // Don't render if data unavailable
    if (!calloutData) return null

    // More checks here to make sure all data is available

    return <SpanElements spans={content} />
}
```

## MultiDim & Explorer Support

### MultiDim

- Full URL with query params becomes part of the key
- Query params must be normalized (alphabetically sorted)
- Example: `grapher/vaccinations?metric=coverage&antigen=dpt+United States`

### Explorers

Mostly similar - see fetchDataValuesForExplorerView

## Implementation Checklist

### 1. Type Definitions

- [ ] Add `CALLOUT_FUNCTIONS` constant
- [ ] Add `CalloutFunction` type
- [ ] Add `RawBlockDataCallout` and `EnrichedBlockDataCallout` types
- [ ] Add `SpanCallout` type
- [ ] Add `LinkedCallout` and `LinkedCallouts` types

### 2. Parser (ArchieMlComponents)

- [ ] Parse data-callout blocks
- [ ] Transform `#callout:*` links into `span-callout` spans
- [ ] Extract function name and parameters from link anchor
- [ ] Validate function names against `CALLOUT_FUNCTIONS`
- [ ] Validate entity names against official entity list

### 3. Loading

- [ ] Add loadLinkedCallouts method on GdocBase that fetches chart metadata
- [ ] Check that all referenced column names exist
- [ ] Block publishing if validation fails
- [ ] Display clear error messages in admin

### 4. Baking (SiteBaker)

- [ ] Implement two-pass baking strategy
- [ ] Pass 1: Extract all linked callouts
- [ ] Implement URL normalization (query param sorting)
- [ ] Bulk fetch all LinkedCallout data
- [ ] Cache LinkedCallouts in memory during bake (in PrefetchedAttachments)
- [ ] Pass 2: Provide LinkedCallouts via context during rendering
- [ ] Add data existence checks during rendering
- [ ] Log Sentry errors for missing data with gdoc ID + column name

### 5. Rendering

- [ ] Create `DataCallout` component
- [ ] Create `CalloutContext` for providing url/entity to child spans
- [ ] Add `LinkedCalloutsContext` provider (similar to linkedCharts)
- [ ] Implement `span-callout` case in SpanElements
- [ ] Implement `findColumnByName()` helper
- [ ] Implement `generateCalloutKey()` helper with normalization
- [ ] Handle missing data gracefully (return null, hide block)
- [ ] Use `articulateEntity()` for entity rendering

### 6. Utilities & Refactoring

- [ ] Move `constructGrapherValuesJson` from `functions/_common/grapherValuesJson.ts` to `@ourworldindata/grapher`
- [ ] Update CloudFlare functions to import from grapher
- [ ] Create server-side wrapper for baking (DB → chart config → data table → GrapherState → values)
- [ ] Implement query string normalization
- [ ] Add helper to extract unique callout tuples from parsed gdocs

### 7. Testing

- [ ] Test with profiles (using $entityName)
- [ ] Test with hardcoded entities
- [ ] Test MultiDim URLs with query params
- [ ] Test missing data scenarios
- [ ] Test column name changes (Sentry alerts)
- [ ] Test deduplication across multiple callouts
- [ ] Test per-column latestYear handling

### 8. Documentation

- [ ] Update author documentation with callout syntax
- [ ] Document supported functions and parameters
- [ ] Provide examples for common use cases
- [ ] Document validation and error messages
