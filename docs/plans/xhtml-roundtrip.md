# Round-Trip Serialization Format for OWID Gdoc Content

## Context

OWID's gdoc content system has 60+ enriched block types and 13 span types. The current markdown serialization (`enrichedToMarkdown.ts`) is lossy - it cannot round-trip because it loses:

- Span formatting: subscript, superscript, underline, quote, ref URLs
- Block metadata: many optional properties on chart, image, video, etc.
- Layout information: side-by-side column assignments, alignment

**Goal**: Add a new serialization format that can round-trip (parse ↔ serialize) with 100% fidelity, optimized for LLM editing.

## Recommendation: Custom XHTML

After analyzing MDX, JSON, YAML, and XHTML options, **custom XHTML is recommended** because:

| Criterion         | XHTML                        | MDX                                         |
| ----------------- | ---------------------------- | ------------------------------------------- |
| Full fidelity     | ✅ All types map to elements | ⚠️ Needs custom components for 7 span types |
| LLM compatibility | ✅ Excellent                 | ✅ Good                                     |
| Parsing           | ✅ Standard XML parser       | ⚠️ Complex MDX parser                       |
| Nesting           | ✅ Native                    | ✅ Native                                   |
| Ambiguity         | ✅ None                      | ⚠️ Whitespace edge cases                    |

### Why Not MDX?

1. **No native syntax for 7 span types**: subscript, superscript, underline, quote, dod, ref, guided-chart-link would all need `<Component>` syntax anyway
2. **Complex parsing**: MDX combines JSX + markdown parsers
3. **Whitespace sensitivity**: Markdown whitespace rules create edge cases
4. **Captions with spans**: Would need nested components or escape to HTML anyway

### XHTML Design

#### Document Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gdoc xmlns="urn:owid:gdoc:v1">
  <!-- blocks go here -->
</gdoc>
```

#### Span Elements (Compact)

| Span Type         | Element             | Example                         |
| ----------------- | ------------------- | ------------------------------- |
| bold              | `<b>`               | `<b>text</b>`                   |
| italic            | `<i>`               | `<i>text</i>`                   |
| underline         | `<u>`               | `<u>text</u>`                   |
| subscript         | `<sub>`             | `H<sub>2</sub>O`                |
| superscript       | `<sup>`             | `x<sup>2</sup>`                 |
| link              | `<a href="...">`    | `<a href="url">text</a>`        |
| dod               | `<dod id="...">`    | `<dod id="abc">term</dod>`      |
| ref               | `<ref url="...">`   | `<ref url="#fn1">1</ref>`       |
| guided-chart-link | `<glink url="...">` | `<glink url="...">text</glink>` |
| quote             | `<q>`               | `<q>quoted</q>`                 |
| newline           | `<br/>`             | `line1<br/>line2`               |

#### Block Elements

**Type-specific elements** (chosen - more compact, LLM-friendly):

```xml
<text><p>Paragraph with <b>bold</b> text.</p></text>

<heading level="2">Section Title</heading>

<chart url="https://..." size="wide">
  <caption>Chart showing <b>important</b> data</caption>
</chart>

<list>
  <li>First item</li>
  <li>Second item with <i>emphasis</i></li>
</list>
```

**Attribute naming**: camelCase (matches TypeScript types, e.g., `hideControls="true"`).

#### Complex Block Examples

```xml
<!-- Side-by-side layout -->
<side-by-side>
  <left>
    <text><p>Left column content</p></text>
  </left>
  <right>
    <chart url="https://..." />
  </right>
</side-by-side>

<!-- Key insights carousel -->
<key-insights heading="Key findings">
  <slide title="First insight" url="https://chart...">
    <text><p>Explanation text</p></text>
  </slide>
  <slide title="Second insight" filename="image.png">
    <text><p>More explanation</p></text>
  </slide>
</key-insights>

<!-- Table -->
<table template="default">
  <caption>Table showing data</caption>
  <row>
    <cell><text><p>Header 1</p></text></cell>
    <cell><text><p>Header 2</p></text></cell>
  </row>
  <row>
    <cell><text><p>Data 1</p></text></cell>
    <cell><text><p>Data 2</p></text></cell>
  </row>
</table>
```

## Implementation Plan

### Phase 1: Type Definitions & Schema

**Files to create:**

- `packages/@ourworldindata/types/src/gdocTypes/XhtmlSerialization.ts` - TypeScript types for XHTML elements

**Tasks:**

1. Define element-to-block type mapping
2. Define attribute-to-property mapping for each block type
3. Create XSD or RelaxNG schema for validation (optional but useful)

### Phase 2: Serialization (Enriched → XHTML)

**Files to create:**

- `db/model/Gdoc/enrichedToXhtml.ts` - Main serialization logic

**Key functions:**

```typescript
function enrichedBlocksToXhtml(blocks: OwidEnrichedGdocBlock[]): string
function enrichedBlockToXhtml(block: OwidEnrichedGdocBlock): string
function spansToXhtml(spans: Span[]): string
function spanToXhtml(span: Span): string
```

**Approach:**

- Pattern match on block/span types (like existing `enrichedToMarkdown.ts`)
- Use a lightweight XML builder or template strings
- Escape text content properly (`&`, `<`, `>`, `"`)

### Phase 3: Deserialization (XHTML → Enriched)

**Files to create:**

- `db/model/Gdoc/xhtmlToEnriched.ts` - Parsing logic

**Key functions:**

```typescript
function xhtmlToEnrichedBlocks(xhtml: string): OwidEnrichedGdocBlock[]
function elementToEnrichedBlock(element: Element): OwidEnrichedGdocBlock
function elementsToSpans(nodes: Node[]): Span[]
```

**Approach:**

- Use `linkedom` or `cheerio` for parsing (already dependencies)
- Walk DOM tree, map elements to enriched types
- Validate required attributes, report parse errors

### Phase 4: Testing & Validation

**Files to create:**

- `db/model/Gdoc/enrichedToXhtml.test.ts`
- `db/model/Gdoc/xhtmlToEnriched.test.ts`

**Test strategy:**

1. **Round-trip tests**: For each block type, verify `parse(serialize(block)) === block`
2. **Golden tests**: Snapshot tests with representative documents
3. **Edge cases**: Nested spans, empty content, special characters, all optional properties
4. **Full production documents**: Optional part of the test suite that reads all gdocs from the DB, serializes to XHTML, parses back, and checks equality

### Phase 5: Integration

**Potential integration points:**

- Export endpoint in admin API
- CLI tool for batch conversion
- Integration with new gdocs parser (from `docs/plans/new-gdocs-parser.md`)

## File Summary

| File                                                                 | Purpose                    |
| -------------------------------------------------------------------- | -------------------------- |
| `packages/@ourworldindata/types/src/gdocTypes/XhtmlSerialization.ts` | Type definitions           |
| `db/model/Gdoc/enrichedToXhtml.ts`                                   | Serialize enriched → XHTML |
| `db/model/Gdoc/xhtmlToEnriched.ts`                                   | Parse XHTML → enriched     |
| `db/model/Gdoc/enrichedToXhtml.test.ts`                              | Serialization tests        |
| `db/model/Gdoc/xhtmlToEnriched.test.ts`                              | Parsing tests              |

## Alternatives Considered

### MDX

Rejected because 7 of 13 span types have no native markdown syntax and would need `<Component>` syntax anyway, negating the readability benefit. Also requires complex parser.

### JSON

Already used for storage. Not recommended for editing - verbose and hard to read prose content.

### YAML + Markdown

Would still need custom span syntax. More complex escaping rules than XHTML.

## Design Decisions

1. **Element style**: Type-specific elements (`<chart>`, `<heading>`) - more compact, LLM-friendly
2. **Attribute naming**: camelCase (`hideControls`) - matches TypeScript types directly
3. **Self-closing**: Use `<br/>` style - more compact
4. **Namespace**: Use `urn:owid:gdoc:v1`
5. **Text wrapping**: `<text>` blocks can inline spans directly, they don't need to wrap content in `<p>`
