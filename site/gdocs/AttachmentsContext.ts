import { createContext } from "react"
import {
    LinkedAuthor,
    LinkedCallouts,
    LinkedChart,
    LinkedIndicator,
    OwidGdocMinimalPostInterface,
    ImageMetadata,
    RelatedChart,
    LatestDataInsight,
    OwidGdocHomepageMetadata,
    DbEnrichedLatestWork,
    NarrativeChartInfo,
    MinimalTag,
    LinkedStaticViz,
} from "@ourworldindata/types"

export type Attachments = {
    donors?: string[]
    linkedAuthors?: LinkedAuthor[]
    linkedCharts: Record<string, LinkedChart>
    linkedIndicators: Record<number, LinkedIndicator>
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    relatedCharts: RelatedChart[]
    latestDataInsights?: LatestDataInsight[]
    homepageMetadata?: OwidGdocHomepageMetadata
    latestWorkLinks?: DbEnrichedLatestWork[]
    linkedNarrativeCharts?: Record<string, NarrativeChartInfo>
    linkedStaticViz?: Record<string, LinkedStaticViz>
    tags: MinimalTag[]
    /**
     * Name of the single top-level topic area this page belongs to, e.g.
     * "Population and Demographic Change". Resolved from `tags[0]` against the
     * tag graph on the server; undefined when the page has no area.
     */
    topicArea?: string
    linkedCallouts?: LinkedCallouts
}

export const AttachmentsContext = createContext<Attachments>({
    linkedAuthors: [],
    linkedDocuments: {},
    imageMetadata: {},
    linkedCharts: {},
    linkedIndicators: {},
    relatedCharts: [],
    latestDataInsights: [],
    homepageMetadata: {},
    latestWorkLinks: [],
    linkedNarrativeCharts: {},
    linkedStaticViz: {},
    tags: [],
    linkedCallouts: {},
})
