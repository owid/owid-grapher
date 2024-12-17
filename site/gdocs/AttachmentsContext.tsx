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
    NarrativeViewInfo,
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
    narrativeViewsInfo?: Record<string, NarrativeViewInfo>
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
    narrativeViewsInfo: {},
})
