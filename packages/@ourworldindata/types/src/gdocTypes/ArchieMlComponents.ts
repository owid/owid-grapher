import { HorizontalAlign } from "../domainTypes/Layout.js"
import { Span, SpanSimpleText } from "./Spans.js"

export type BlockPositionChoice = "right" | "left"
export type ChartPositionChoice = "featured"

type ArchieMLUnexpectedNonObjectValue = string

export type ParseError = {
    message: string
    isWarning?: boolean
}

export type EnrichedBlockWithParseErrors = {
    parseErrors: ParseError[]
}

export type RawBlockAsideValue = {
    position?: string // use BlockPositionChoice in matching Enriched block
    caption?: string
}

export type RawBlockAside = {
    type: "aside"
    value: RawBlockAsideValue | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockAside = {
    type: "aside"
    position?: BlockPositionChoice
    caption: Span[]
} & EnrichedBlockWithParseErrors

export enum ChartControlKeyword {
    all = "all",
    relativeToggle = "relativeToggle",
    timeline = "timeline",
    facetControl = "facetControl",
    entitySelector = "entitySelector",
    zoomToggle = "zoomToggle",
    noDataAreaToggle = "noDataAreaToggle",
    alignAxisScalesToggle = "alignAxisScalesToggle",
    xLogLinearSelector = "xLogLinearSelector",
    yLogLinearSelector = "yLogLinearSelector",
    mapRegionDropdown = "mapRegionDropdown",
    tableFilterToggle = "tableFilterToggle",
}

export enum ChartTabKeyword {
    all = "all",
    chart = "chart",
    map = "map",
    table = "table",
}

export type RawBlockChartValue = {
    url?: string
    height?: string
    row?: string
    column?: string
    // TODO: position is used as a classname apparently? Should be renamed or split
    position?: string
    caption?: string
    title?: string
    subtitle?: string
    controls?: { list: string[] }[]
    tabs?: { list: string[] }[]
}

export type RawBlockChart = {
    type: "chart"
    value: RawBlockChartValue | string
}

export type EnrichedBlockChart = {
    type: "chart"
    url: string
    height?: string
    row?: string
    column?: string
    position?: ChartPositionChoice
    caption?: Span[]
    title?: string
    subtitle?: string
    controls?: ChartControlKeyword[]
    tabs?: ChartTabKeyword[]
} & EnrichedBlockWithParseErrors

export type RawBlockNarrativeChartValue = {
    name?: string
    height?: string
    row?: string
    column?: string
    // TODO: position is used as a classname apparently? Should be renamed or split
    position?: string
    caption?: string
}

export type RawBlockNarrativeChart = {
    type: "narrative-chart"
    value: RawBlockNarrativeChartValue | string
}

export type EnrichedBlockNarrativeChart = {
    type: "narrative-chart"
    name: string
    height?: string
    row?: string
    column?: string
    position?: ChartPositionChoice
    caption?: Span[]
} & EnrichedBlockWithParseErrors

export type RawBlockCode = {
    type: "code"
    value: RawBlockText[]
}

export type EnrichedBlockCode = {
    type: "code"
    text: EnrichedBlockSimpleText[]
} & EnrichedBlockWithParseErrors

export type RawBlockDonorList = {
    type: "donors"
    value?: Record<string, never> // dummy value to unify block shapes
}

export type EnrichedBlockDonorList = {
    type: "donors"
    value?: Record<string, never> // dummy value to unify block shapes
} & EnrichedBlockWithParseErrors

export type RawBlockKeyIndicatorValue = {
    datapageUrl?: string
    title?: string
    text?: RawBlockText[]
    source?: string
}

export type RawBlockKeyIndicator = {
    type: "key-indicator"
    value: RawBlockKeyIndicatorValue | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockKeyIndicator = {
    type: "key-indicator"
    datapageUrl: string
    title: string
    text: EnrichedBlockText[]
    source?: string
} & EnrichedBlockWithParseErrors

export type RawBlockKeyIndicatorCollection = {
    type: "key-indicator-collection"
    value: {
        heading?: string
        subtitle?: string
        button?: {
            text?: string
            url?: string
        }
        indicators: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockKeyIndicatorCollection = {
    type: "key-indicator-collection"
    heading?: string
    subtitle?: string
    button?: {
        text: string
        url: string
    }
    blocks: EnrichedBlockKeyIndicator[]
} & EnrichedBlockWithParseErrors

export type RawBlockScroller = {
    type: "scroller"
    value: OwidRawGdocBlock[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedScrollerItem = {
    type: "enriched-scroller-item"
    url: string
    text: EnrichedBlockText
}

export type EnrichedBlockScroller = {
    type: "scroller"
    blocks: EnrichedScrollerItem[]
} & EnrichedBlockWithParseErrors

export type RawChartStoryValue = {
    narrative?: string
    chart?: string
    technical?: { list?: string[] }
}

export type RawBlockChartStory = {
    type: "chart-story"
    value: RawChartStoryValue[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedChartStoryItem = {
    narrative: EnrichedBlockText
    chart: EnrichedBlockChart
    technical: EnrichedBlockText[]
}

export type EnrichedBlockChartStory = {
    type: "chart-story"
    items: EnrichedChartStoryItem[]
} & EnrichedBlockWithParseErrors

export type RawBlockExpander = {
    type: "expander"
    value: {
        heading?: string
        title?: string
        subtitle?: string
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockExpander = {
    type: "expander"
    heading?: string
    title: string
    subtitle?: string
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export enum BlockImageSize {
    Narrow = "narrow",
    Wide = "wide",
    Widest = "widest",
}

export function checkIsBlockImageSize(size: unknown): size is BlockImageSize {
    if (typeof size !== "string") return false
    return Object.values(BlockImageSize).includes(size as any)
}

export type RawBlockImage = {
    type: "image"
    value: {
        filename?: string
        smallFilename?: string
        alt?: string
        caption?: string
        size?: BlockImageSize
        hasOutline?: string
    }
}

export type EnrichedBlockImage = {
    type: "image"
    filename: string
    smallFilename?: string
    alt?: string // optional as we can use the default alt from the file
    caption?: Span[]
    originalWidth?: number
    size: BlockImageSize
    hasOutline: boolean
    // Not a real ArchieML prop - we set this to true for Data Insights, as a way to migrate
    // first generation data insights to only use their small image
    // See https://github.com/owid/owid-grapher/issues/4416
    preferSmallFilename?: boolean
} & EnrichedBlockWithParseErrors

export type RawBlockVideo = {
    type: "video"
    value: {
        url?: string
        caption?: string
        shouldLoop?: string
        shouldAutoplay?: string
        filename?: string
    }
}

export type EnrichedBlockVideo = {
    type: "video"
    url: string
    shouldLoop: boolean
    shouldAutoplay: boolean
    filename: string
    caption?: Span[]
} & EnrichedBlockWithParseErrors

// TODO: This is what lists staring with * are converted to in archieToEnriched
// It might also be what is used inside recirc elements but there it's not a simple
// string IIRC - check this
export type RawBlockList = {
    type: "list"
    value: string[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockList = {
    type: "list"
    items: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors

export type RawBlockNumberedList = {
    type: "numbered-list"
    value: string[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockNumberedList = {
    type: "numbered-list"
    items: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors

export type RawBlockPeopleRows = {
    type: "people-rows"
    value: {
        columns: "2" | "4"
        people: RawBlockPerson[]
    }
}

export type RawBlockPeople = {
    type: "people"
    value: RawBlockPerson[] | ArchieMLUnexpectedNonObjectValue
}

export type RawBlockPerson = {
    type: "person"
    value: {
        image?: string
        name: string
        title?: string
        url?: string
        text: RawBlockText[]
        socials?: RawSocialLink[]
    }
}

export type EnrichedBlockPeopleRows = {
    type: "people-rows"
    columns: "2" | "4"
    people: EnrichedBlockPerson[]
} & EnrichedBlockWithParseErrors

export type EnrichedBlockPeople = {
    type: "people"
    items: EnrichedBlockPerson[]
} & EnrichedBlockWithParseErrors

export type EnrichedBlockPerson = {
    type: "person"
    image?: string
    name: string
    title?: string
    url?: string
    text: EnrichedBlockText[]
    socials?: EnrichedSocialLink[]
} & EnrichedBlockWithParseErrors

export const pullquoteAlignments = [
    "left",
    "left-center",
    "right-center",
    "right",
] as const

export type PullQuoteAlignment = (typeof pullquoteAlignments)[number]

export type RawBlockPullQuote = {
    type: "pull-quote"
    value: {
        align?: string
        quote?: string
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockPullQuote = {
    type: "pull-quote"
    content: EnrichedBlockText[]
    align: PullQuoteAlignment
    quote: string
} & EnrichedBlockWithParseErrors

export type RawBlockGuidedChart = {
    type: "guided-chart"
    value: OwidRawGdocBlock[]
}

export type EnrichedBlockGuidedChart = {
    type: "guided-chart"
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockHorizontalRule = {
    type: "horizontal-rule"
    value?: Record<string, never> // dummy value to unify block shapes
}

export type EnrichedBlockHorizontalRule = {
    type: "horizontal-rule"
    value?: Record<string, never> // dummy value to unify block shapes
} & EnrichedBlockWithParseErrors

/* This can either be a link to a gdoc/grapher/explorer or external URL */
export type RawHybridLink = {
    url?: string
    title?: string
    subtitle?: string
}

/* This can either be a link to a gdoc/grapher/explorer or external URL */
export type EnrichedHybridLink = {
    url: string
    title?: string
    subtitle?: string
    type: "hybrid-link"
}

export type RawBlockResourcePanel = {
    type: "resource-panel"
    value?: {
        icon?: string
        kicker?: string
        title?: string
        links?: RawHybridLink[]
        buttonText?: string
    }
}

export const resourcePanelIcons = ["chart"] as const

export type ResourcePanelIcon = (typeof resourcePanelIcons)[number]

export type EnrichedBlockResourcePanel = {
    type: "resource-panel"
    icon?: ResourcePanelIcon
    kicker?: string
    title: string
    links: EnrichedHybridLink[]
    buttonText?: string
} & EnrichedBlockWithParseErrors

export type RawBlockRecirc = {
    type: "recirc"
    value?: {
        title?: string
        align?: string
        links?: RawHybridLink[]
    }
}

export const recircAlignments = ["left", "center", "right"] as const

export type RecircAlignment = (typeof recircAlignments)[number]

export type EnrichedBlockRecirc = {
    type: "recirc"
    title: string
    align?: RecircAlignment
    links: EnrichedHybridLink[]
} & EnrichedBlockWithParseErrors

export type RawBlockText = {
    type: "text"
    value: string
}

export type EnrichedBlockText = {
    type: "text"
    value: Span[]
} & EnrichedBlockWithParseErrors

export type EnrichedBlockSimpleText = {
    type: "simple-text"
    value: SpanSimpleText
} & EnrichedBlockWithParseErrors

export type RawBlockHtml = {
    type: "html"
    value: string
}

export type EnrichedBlockHtml = {
    type: "html"
    value: string
} & EnrichedBlockWithParseErrors

export type RawBlockScript = {
    type: "script"
    value: RawBlockText[]
}

export type EnrichedBlockScript = {
    type: "script"
    lines: string[]
} & EnrichedBlockWithParseErrors

export type RawBlockUrl = {
    type: "url"
    value: string
}
// There is no EnrichedBlockUrl because Url blocks only exist inside Sliders;
// they are subsumed into Slider blocks during enrichment
export type RawBlockPosition = {
    type: "position"
    value: string
}

export type RawBlockHeadingValue = {
    text?: string
    level?: string
}
export type RawBlockHeading = {
    type: "heading"
    value: RawBlockHeadingValue | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockHeading = {
    type: "heading"
    text: Span[]
    supertitle?: Span[]
    level: number
} & EnrichedBlockWithParseErrors

export type RawSDGGridItem = {
    goal?: string
    link?: string
}

export type RawBlockSDGGrid = {
    type: "sdg-grid"
    value: RawSDGGridItem[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedSDGGridItem = {
    goal: string
    link: string
}

export type EnrichedBlockSDGGrid = {
    type: "sdg-grid"
    items: EnrichedSDGGridItem[]
} & EnrichedBlockWithParseErrors

export type RawBlockStickyRightContainer = {
    type: "sticky-right"
    value: {
        left: OwidRawGdocBlock[]
        right: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockStickyRightContainer = {
    type: "sticky-right"
    left: OwidEnrichedGdocBlock[]
    right: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockStickyLeftContainer = {
    type: "sticky-left"
    value: {
        left: OwidRawGdocBlock[]
        right: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockStickyLeftContainer = {
    type: "sticky-left"
    left: OwidEnrichedGdocBlock[]
    right: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockSideBySideContainer = {
    type: "side-by-side"
    value: {
        left: OwidRawGdocBlock[]
        right: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockSideBySideContainer = {
    type: "side-by-side"
    left: OwidEnrichedGdocBlock[]
    right: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockAllCharts = {
    type: "all-charts"
    value: {
        heading?: string
        top?: { url: string }[]
    }
}

export type EnrichedBlockAllCharts = {
    type: "all-charts"
    heading: string
    top: { url: string }[]
} & EnrichedBlockWithParseErrors

export type RawBlockGraySection = {
    type: "gray-section"
    value: OwidRawGdocBlock[]
}

export type EnrichedBlockGraySection = {
    type: "gray-section"
    items: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type ProminentLinkValue = {
    url?: string
    title?: string
    description?: string
    thumbnail?: string
}

export type RawBlockProminentLink = {
    type: "prominent-link"
    value: ProminentLinkValue
}

export type EnrichedBlockProminentLink = {
    type: "prominent-link"
    url: string
    title?: string
    description?: string
    thumbnail?: string
} & EnrichedBlockWithParseErrors

export type RawBlockCallout = {
    type: "callout"
    value: {
        icon?: "info"
        title?: string
        text: (RawBlockText | RawBlockHeading | RawBlockList)[]
    }
}

export type EnrichedBlockCallout = {
    type: "callout"
    icon?: "info"
    title?: string
    text: (EnrichedBlockText | EnrichedBlockHeading | EnrichedBlockList)[]
} & EnrichedBlockWithParseErrors

export type RawBlockTopicPageIntro = {
    type: "topic-page-intro"
    value: {
        "download-button":
            | {
                  text: string
                  url: string
              }
            | undefined
        "related-topics":
            | {
                  text?: string
                  url: string
              }[]
            | undefined
        content: RawBlockText[]
    }
}

export type EnrichedTopicPageIntroRelatedTopic = {
    text?: string
    url: string
    type: "topic-page-intro-related-topic"
}

export type EnrichedTopicPageIntroDownloadButton = {
    text: string
    url: string
    type: "topic-page-intro-download-button"
}

export type EnrichedBlockTopicPageIntro = {
    type: "topic-page-intro"
    downloadButton?: EnrichedTopicPageIntroDownloadButton
    relatedTopics?: EnrichedTopicPageIntroRelatedTopic[]
    content: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors

export type RawBlockKeyInsightsSlide = {
    title?: string
    filename?: string
    url?: string
    narrativeChartName?: string
    content?: OwidRawGdocBlock[]
}

export type RawBlockKeyInsights = {
    type: "key-insights"
    value: {
        heading?: string
        insights?: RawBlockKeyInsightsSlide[]
    }
}

export type EnrichedBlockKeyInsightsSlide = {
    type: "key-insight-slide"
    title: string
    filename?: string
    url?: string
    narrativeChartName?: string
    content: OwidEnrichedGdocBlock[]
}

export type EnrichedBlockKeyInsights = {
    type: "key-insights"
    heading: string
    insights: EnrichedBlockKeyInsightsSlide[]
} & EnrichedBlockWithParseErrors

export type RawBlockResearchAndWritingLink = {
    url?: string
    authors?: string
    title?: string
    subtitle?: string
    filename?: string
    date?: string
}

export type RawBlockResearchAndWritingRow = {
    heading?: string
    articles?: RawBlockResearchAndWritingLink[]
}

export type RawBlockLatestWork = {
    heading?: string
}

export type RawBlockResearchAndWriting = {
    type: "research-and-writing"
    value: {
        heading?: string
        "hide-authors"?: string
        "hide-date"?: string
        // We're migrating these to be arrays, but have to support the old use-case until it's done
        primary?:
            | RawBlockResearchAndWritingLink
            | RawBlockResearchAndWritingLink[]
        secondary?:
            | RawBlockResearchAndWritingLink
            | RawBlockResearchAndWritingLink[]
        more?: RawBlockResearchAndWritingRow
        rows?: RawBlockResearchAndWritingRow[]
        latest?: RawBlockLatestWork
    }
}

export type EnrichedBlockResearchAndWritingLink = {
    value: {
        url: string
        authors?: string[]
        title?: string
        subtitle?: string
        filename?: string
        date?: string
    }
}

export type EnrichedBlockResearchAndWritingRow = {
    heading: string
    articles: EnrichedBlockResearchAndWritingLink[]
}

export type EnrichedBlockLatestWork = {
    heading?: string
    articles?: EnrichedBlockResearchAndWritingLink[]
}

export type EnrichedBlockResearchAndWriting = {
    type: "research-and-writing"
    heading?: string
    "hide-authors": boolean
    "hide-date": boolean
    primary: EnrichedBlockResearchAndWritingLink[]
    secondary: EnrichedBlockResearchAndWritingLink[]
    more?: EnrichedBlockResearchAndWritingRow
    rows: EnrichedBlockResearchAndWritingRow[]
    latest?: EnrichedBlockLatestWork
} & EnrichedBlockWithParseErrors

export type RawBlockSDGToc = {
    type: "sdg-toc"
    value?: Record<string, never>
}

export type EnrichedBlockSDGToc = {
    type: "sdg-toc"
    value?: Record<string, never>
} & EnrichedBlockWithParseErrors

export type RawBlockMissingData = {
    type: "missing-data"
    value?: Record<string, never>
}

export type EnrichedBlockMissingData = {
    type: "missing-data"
    value?: Record<string, never>
} & EnrichedBlockWithParseErrors

export type RawBlockAdditionalCharts = {
    type: "additional-charts"
    value: {
        list?: string[]
    }
}

export type EnrichedBlockAdditionalCharts = {
    type: "additional-charts"
    items: Span[][]
} & EnrichedBlockWithParseErrors

export type RawBlockExpandableParagraph = {
    type: "expandable-paragraph"
    value: OwidRawGdocBlock[]
}

export type EnrichedBlockExpandableParagraph = {
    type: "expandable-paragraph"
    items: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockAlign = {
    type: "align"
    value: {
        alignment: string
        content: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockAlign = {
    type: "align"
    alignment: HorizontalAlign
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockEntrySummaryItem = {
    text?: string
    slug?: string
}

// This block renders via the TableOfContents component, same as the sdg-toc block.
// Because the summary headings can differ from the actual headings in the document,
// we need to serialize the text and slug explicitly, instead of programmatically generating them
// by analyzing the document (like we do for the sdg-toc block)
export type RawBlockEntrySummary = {
    type: "entry-summary"
    value: {
        items?: RawBlockEntrySummaryItem[]
    }
}

export type EnrichedBlockEntrySummaryItem = {
    text: string
    slug: string
}

export type EnrichedBlockEntrySummary = {
    type: "entry-summary"
    items: EnrichedBlockEntrySummaryItem[]
} & EnrichedBlockWithParseErrors

export const tableTemplates = [
    "header-column",
    "header-row",
    "header-column-row",
] as const

export type TableTemplate = (typeof tableTemplates)[number]

export const tableSizes = ["narrow", "wide"] as const

export type TableSize = (typeof tableSizes)[number]

export type RawBlockTable = {
    type: "table"
    value?: {
        template?: TableTemplate
        size?: TableSize
        rows?: RawBlockTableRow[]
    }
}

export interface RawBlockTableRow {
    type: "table-row"
    value: {
        cells?: RawBlockTableCell[]
    }
}

export interface RawBlockTableCell {
    type: "table-cell"
    value?: OwidRawGdocBlock[]
}

export type EnrichedBlockTable = {
    type: "table"
    // template is optional because it can be inferred from the table size
    template: TableTemplate
    size: TableSize
    rows: EnrichedBlockTableRow[]
} & EnrichedBlockWithParseErrors

export interface EnrichedBlockTableRow {
    type: "table-row"
    cells: EnrichedBlockTableCell[]
}

export interface EnrichedBlockTableCell {
    type: "table-cell"
    content: OwidEnrichedGdocBlock[]
}

export type RawBlockBlockquote = {
    type: "blockquote"
    value: {
        text?: RawBlockText[]
        citation?: string
    }
}

export type EnrichedBlockBlockquote = {
    type: "blockquote"
    text: EnrichedBlockText[]
    citation?: string
} & EnrichedBlockWithParseErrors

export type RawBlockExplorerTiles = {
    type: "explorer-tiles"
    value: {
        title?: string
        subtitle?: string
        explorers?: { url: string }[]
    }
}

export type EnrichedBlockExplorerTiles = {
    type: "explorer-tiles"
    title: string
    subtitle: string
    explorers: { url: string }[]
} & EnrichedBlockWithParseErrors

export type Ref = {
    id: string
    // Can be -1
    index: number
    content: OwidEnrichedGdocBlock[]
    parseErrors: ParseError[]
}

export type RefDictionary = {
    [refId: string]: Ref
}

export type RawBlockPillRow = {
    type: "pill-row"
    value: {
        title?: string
        pills?: {
            text?: string
            url?: string
        }[]
    }
}

export type EnrichedBlockPillRow = {
    type: "pill-row"
    title: string
    pills: {
        // optional because when linking to a gdoc we can use that title
        text?: string
        url: string
    }[]
} & EnrichedBlockWithParseErrors

export type RawBlockHomepageSearch = {
    type: "homepage-search"
    value: Record<string, never>
}

export type EnrichedBlockHomepageSearch = {
    type: "homepage-search"
} & EnrichedBlockWithParseErrors

export type RawBlockHomepageIntroPost = {
    type: "primary" | "secondary" | "tertiary"
    value: {
        url?: string
        title?: string
        description?: string
        kicker?: string
        authors?: string
        filename?: string
        isNew?: string
    }
}

export type RawBlockHomepageIntro = {
    type: "homepage-intro"
    value: {
        ["featured-work"]?: RawBlockHomepageIntroPost[]
    }
}

export type EnrichedBlockHomepageIntroPost = {
    type: "primary" | "secondary" | "tertiary"
    url: string
    // the rest are optional because if this is a gdoc, we resolve metadata automatically
    title?: string
    description?: string
    kicker?: string
    authors?: string[]
    filename?: string
    isNew?: boolean
}

export type EnrichedBlockHomepageIntro = {
    type: "homepage-intro"
    featuredWork: EnrichedBlockHomepageIntroPost[]
} & EnrichedBlockWithParseErrors

export type RawBlockLatestDataInsights = {
    type: "latest-data-insights"
    value: Record<string, never>
}

export type EnrichedBlockLatestDataInsights = {
    type: "latest-data-insights"
} & EnrichedBlockWithParseErrors

export type RawBlockCookieNotice = {
    type: "cookie-notice"
    value: Record<string, never>
}

export type EnrichedBlockCookieNotice = {
    type: "cookie-notice"
} & EnrichedBlockWithParseErrors

export type RawBlockCta = {
    type: "cta"
    value: {
        text?: string
        url?: string
    }
}

export type EnrichedBlockCta = {
    type: "cta"
    text: string
    url: string
} & EnrichedBlockWithParseErrors

export enum SocialLinkType {
    X = "x",
    Facebook = "facebook",
    Instagram = "instagram",
    Youtube = "youtube",
    Linkedin = "linkedin",
    Threads = "threads",
    Mastodon = "mastodon",
    Bluesky = "bluesky",
    Email = "email",
    Link = "link",
}

export type RawSocialLink = {
    text?: string
    url?: string
    type?: SocialLinkType
}

export type RawBlockSocials = {
    type: "socials"
    value: RawSocialLink[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedSocialLink = {
    text: string
    url: string
    type?: SocialLinkType
} & EnrichedBlockWithParseErrors

export type EnrichedBlockSocials = {
    type: "socials"
    links: EnrichedSocialLink[]
} & EnrichedBlockWithParseErrors

export type OwidRawGdocBlock =
    | RawBlockAllCharts
    | RawBlockAside
    | RawBlockCallout
    | RawBlockChart
    | RawBlockExpander
    | RawBlockNarrativeChart
    | RawBlockCode
    | RawBlockDonorList
    | RawBlockScroller
    | RawBlockChartStory
    | RawBlockExplorerTiles
    | RawBlockImage
    | RawBlockVideo
    | RawBlockList
    | RawBlockPeople
    | RawBlockPeopleRows
    | RawBlockPerson
    | RawBlockPullQuote
    | RawBlockGuidedChart
    | RawBlockRecirc
    | RawBlockResearchAndWriting
    | RawBlockText
    | RawBlockUrl
    | RawBlockResourcePanel
    | RawBlockPosition
    | RawBlockHeading
    | RawBlockHtml
    | RawBlockScript
    | RawBlockHorizontalRule
    | RawBlockSDGGrid
    | RawBlockStickyRightContainer
    | RawBlockStickyLeftContainer
    | RawBlockSideBySideContainer
    | RawBlockGraySection
    | RawBlockProminentLink
    | RawBlockSDGToc
    | RawBlockMissingData
    | RawBlockAdditionalCharts
    | RawBlockNumberedList
    | RawBlockExpandableParagraph
    | RawBlockTopicPageIntro
    | RawBlockKeyInsights
    | RawBlockAlign
    | RawBlockEntrySummary
    | RawBlockTable
    | RawBlockBlockquote
    | RawBlockKeyIndicator
    | RawBlockKeyIndicatorCollection
    | RawBlockPillRow
    | RawBlockHomepageSearch
    | RawBlockHomepageIntro
    | RawBlockLatestDataInsights
    | RawBlockCookieNotice
    | RawBlockCta
    | RawBlockSocials

export type OwidEnrichedGdocBlock =
    | EnrichedBlockAllCharts
    | EnrichedBlockText
    | EnrichedBlockAside
    | EnrichedBlockCallout
    | EnrichedBlockChart
    | EnrichedBlockExpander
    | EnrichedBlockNarrativeChart
    | EnrichedBlockCode
    | EnrichedBlockDonorList
    | EnrichedBlockScroller
    | EnrichedBlockChartStory
    | EnrichedBlockExplorerTiles
    | EnrichedBlockImage
    | EnrichedBlockVideo
    | EnrichedBlockList
    | EnrichedBlockPeople
    | EnrichedBlockPeopleRows
    | EnrichedBlockPerson
    | EnrichedBlockPullQuote
    | EnrichedBlockGuidedChart
    | EnrichedBlockRecirc
    | EnrichedBlockResearchAndWriting
    | EnrichedBlockHeading
    | EnrichedBlockHtml
    | EnrichedBlockScript
    | EnrichedBlockHorizontalRule
    | EnrichedBlockSDGGrid
    | EnrichedBlockStickyRightContainer
    | EnrichedBlockStickyLeftContainer
    | EnrichedBlockSideBySideContainer
    | EnrichedBlockGraySection
    | EnrichedBlockProminentLink
    | EnrichedBlockSDGToc
    | EnrichedBlockMissingData
    | EnrichedBlockAdditionalCharts
    | EnrichedBlockNumberedList
    | EnrichedBlockSimpleText
    | EnrichedBlockResourcePanel
    | EnrichedBlockExpandableParagraph
    | EnrichedBlockTopicPageIntro
    | EnrichedBlockKeyInsights
    | EnrichedBlockResearchAndWriting
    | EnrichedBlockAlign
    | EnrichedBlockEntrySummary
    | EnrichedBlockTable
    | EnrichedBlockBlockquote
    | EnrichedBlockKeyIndicator
    | EnrichedBlockKeyIndicatorCollection
    | EnrichedBlockPillRow
    | EnrichedBlockHomepageSearch
    | EnrichedBlockHomepageIntro
    | EnrichedBlockLatestDataInsights
    | EnrichedBlockCookieNotice
    | EnrichedBlockCta
    | EnrichedBlockSocials

/**
 * A map of all possible block types, with the type as the key and the block type as the value
 * e.g.
 * {
 *   "text": EnrichedBlockText,
 *   "aside": EnrichedBlockAside,
 *    ...
 * }
 */
export type OwidEnrichedGdocBlockTypeMap = {
    [K in OwidEnrichedGdocBlock as K["type"]]: K
}
