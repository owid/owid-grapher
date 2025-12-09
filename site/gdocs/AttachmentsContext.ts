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
