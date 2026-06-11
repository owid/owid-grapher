import type { docs_v1 } from "@googleapis/docs"
import type {
    LinkedAuthor,
    LinkedChart,
    LinkedIndicator,
    ImageMetadata,
    OwidGdocMinimalPostInterface,
    RelatedChart,
    NarrativeChartInfo,
    LinkedStaticViz,
    MinimalTag,
    OwidGdocContent,
    OwidGdocErrorMessage,
} from "@ourworldindata/types"

export interface Attachments {
    linkedAuthors: LinkedAuthor[]
    linkedCharts: Record<string, LinkedChart>
    linkedIndicators: Record<number, LinkedIndicator>
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    relatedCharts: RelatedChart[]
    linkedNarrativeCharts: Record<string, NarrativeChartInfo>
    linkedStaticViz: Record<string, LinkedStaticViz>
    tags: MinimalTag[]
}

export interface ParsedContent {
    content: OwidGdocContent
    errors: OwidGdocErrorMessage[]
}

export type RawGdocDocument = docs_v1.Schema$Document
