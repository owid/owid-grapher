import { createContext } from "react"
import {
    LinkedAuthor,
    LinkedChart,
    LinkedIndicator,
    OwidGdocMinimalPostInterface,
    ImageMetadata,
    RelatedChart,
    LatestDataInsight,
    OwidGdocHomepageMetadata,
    DbEnrichedLatestWork,
    ChartViewMetadata,
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
    chartViewMetadata?: Record<string, ChartViewMetadata>
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
    chartViewMetadata: {},
})
