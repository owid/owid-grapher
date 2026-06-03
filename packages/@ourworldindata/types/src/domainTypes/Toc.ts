import type { BlockVisibility } from "../gdocTypes/archieMLComponents/generic.js"
import type { EnrichedBlockHeading } from "../gdocTypes/archieMLComponents/Heading.js"

export interface TocHeading {
    text: string
    slug: string
    isSubheading: boolean
}

export interface TocHeadingWithTitleSupertitle extends TocHeading {
    title: string
    supertitle?: string
}

/** A heading entry in a {@link Toc}. */
export interface TocHeadingItem {
    level: EnrichedBlockHeading["level"]
    text: string
    slug: string
    supertitle?: string
}

/**
 * A chart bullet under a sidebar section. `anchorId` ("chart-<slug>", "-2", …
 * for repeats) matches the `id` rendered on the chart wrapper.
 */
export type TocChartEntry =
    | {
          kind: "chart"
          url: string
          anchorId: string
          visibility?: BlockVisibility
      }
    | { kind: "narrative-chart"; name: string; anchorId: string }

/** One H1 section plus the chart bullets that belong to it. */
export interface TocSidebarSection {
    heading: TocHeadingItem
    charts: TocChartEntry[]
}

/**
 * The table of contents stored on a gdoc's content, tailored to the one TOC
 * consumer the page has (if any):
 *
 * - `"sidebar"` — the topic-page / profile sidebar and the `ltp-toc`
 *   "Sections" block: H1 sections carrying their chart bullets.
 * - `"inline"` — the `sdg-toc` block's `<details>` list of H2/H3 headings.
 *
 * Pages with no TOC consumer store no `toc` at all.
 */
export type Toc =
    | { kind: "sidebar"; sections: TocSidebarSection[] }
    | { kind: "inline"; headings: TocHeadingItem[] }
