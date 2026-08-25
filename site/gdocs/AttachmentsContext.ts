import { createContext } from "react"
import {
    LinkedAuthor,
    LinkedCallouts,
    LinkedChart,
    LinkedIndicator,
    OwidGdocMinimalPostInterface,
    ImageMetadata,
    LatestAnnouncement,
    LatestDataInsight,
    OwidGdocHomepageMetadata,
    DbEnrichedLatestWork,
    NarrativeChartInfo,
    MinimalTag,
    LinkedStaticViz,
    BespokeMetadata,
    BakedAllChartsBlockResults,
} from "@ourworldindata/types"

export type Attachments = {
    donors?: string[]
    linkedAuthors?: LinkedAuthor[]
    linkedCharts: Record<string, LinkedChart>
    linkedIndicators: Record<number, LinkedIndicator>
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    latestDataInsights?: LatestDataInsight[]
    latestAnnouncements?: LatestAnnouncement[]
    homepageMetadata?: OwidGdocHomepageMetadata
    latestWorkLinks?: DbEnrichedLatestWork[]
    linkedNarrativeCharts?: Record<string, NarrativeChartInfo>
    linkedStaticViz?: Record<string, LinkedStaticViz>
    tags: MinimalTag[]
    /** Top-level topic area of `tags[0]`, resolved on the server. */
    topicArea?: string
    linkedCallouts?: LinkedCallouts
    bespokeMetadata?: BespokeMetadata
    allChartsBlockResults?: BakedAllChartsBlockResults
}

export const AttachmentsContext = createContext<Attachments>({
    linkedAuthors: [],
    linkedDocuments: {},
    imageMetadata: {},
    linkedCharts: {},
    linkedIndicators: {},
    latestDataInsights: [],
    latestAnnouncements: [],
    homepageMetadata: {},
    latestWorkLinks: [],
    linkedNarrativeCharts: {},
    linkedStaticViz: {},
    tags: [],
    linkedCallouts: {},
})
