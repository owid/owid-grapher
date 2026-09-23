// Plain-JSON representations of ProseMirror documents. The serialization layer
// operates on these instead of prosemirror-model classes so that it can run in
// any environment (browser, node scripts, vitest) without an editor instance.

export interface PmMarkJson {
    type: string
    attrs?: Record<string, unknown>
}

export interface PmNodeJson {
    type: string
    attrs?: Record<string, unknown>
    content?: PmNodeJson[]
    marks?: PmMarkJson[]
    text?: string
}

// Node type names shared between the serializers and the TipTap extensions.
export const pmNodeNames = {
    doc: "doc",
    paragraph: "paragraph",
    heading: "heading",
    bulletList: "bulletList",
    orderedList: "orderedList",
    listItem: "listItem",
    blockquote: "blockquote",
    callout: "callout",
    horizontalRule: "horizontalRule",
    image: "image",
    cta: "cta",
    rawBlock: "rawBlock",
    hardBreak: "hardBreak",
    spanCallout: "spanCallout",
    text: "text",
    // atoms whose `props` attr carries the enriched block verbatim
    chart: "chart",
    narrativeChart: "narrativeChart",
    video: "video",
    prominentLink: "prominentLink",
    recirc: "recirc",
    researchAndWriting: "researchAndWriting",
    allCharts: "allCharts",
    explorerTiles: "explorerTiles",
    pillRow: "pillRow",
    html: "html",
    codeBlock: "codeBlock",
    staticViz: "staticViz",
    resourcePanel: "resourcePanel",
    entrySummary: "entrySummary",
    sdgGrid: "sdgGrid",
    additionalCharts: "additionalCharts",
    socials: "socials",
    homepageIntro: "homepageIntro",
    countryProfileSelector: "countryProfileSelector",
    subscribeBanner: "subscribeBanner",
    bespokeComponent: "bespokeComponent",
    chartStory: "chartStory",
    chartRows: "chartRows",
    people: "people",
    peopleRows: "peopleRows",
    person: "person",
    keyIndicator: "keyIndicator",
    keyIndicatorCollection: "keyIndicatorCollection",
    sdgToc: "sdgToc",
    ltpToc: "ltpToc",
    missingData: "missingData",
    donorList: "donorList",
    latestDataInsights: "latestDataInsights",
    featuredDataInsights: "featuredDataInsights",
    featuredMetrics: "featuredMetrics",
    homepageSearch: "homepageSearch",
    cookieNotice: "cookieNotice",
    // editable containers
    pullQuote: "pullQuote",
    tableBlock: "tableBlock",
    tableRow: "tableRow",
    tableCell: "tableCell",
    aside: "aside",
    graySection: "graySection",
    expandableParagraph: "expandableParagraph",
    stickyRight: "stickyRight",
    stickyLeft: "stickyLeft",
    sideBySide: "sideBySide",
    layoutColumn: "layoutColumn",
    expander: "expander",
    guidedChart: "guidedChart",
    align: "align",
    dataCallout: "dataCallout",
    dataCalloutGroup: "dataCalloutGroup",
    exploreDataSection: "exploreDataSection",
    conditionalSection: "conditionalSection",
    topicPageIntro: "topicPageIntro",
    pullChart: "pullChart",
    keyInsights: "keyInsights",
    keyInsightSlide: "keyInsightSlide",
} as const

/** The enriched block types that map to a uniform props-carrying atom node */
export const propsAtomBlockTypes = {
    chart: pmNodeNames.chart,
    "narrative-chart": pmNodeNames.narrativeChart,
    video: pmNodeNames.video,
    "prominent-link": pmNodeNames.prominentLink,
    recirc: pmNodeNames.recirc,
    "research-and-writing": pmNodeNames.researchAndWriting,
    "all-charts": pmNodeNames.allCharts,
    "explorer-tiles": pmNodeNames.explorerTiles,
    "pill-row": pmNodeNames.pillRow,
    html: pmNodeNames.html,
    code: pmNodeNames.codeBlock,
    "static-viz": pmNodeNames.staticViz,
    "resource-panel": pmNodeNames.resourcePanel,
    "entry-summary": pmNodeNames.entrySummary,
    "sdg-grid": pmNodeNames.sdgGrid,
    "additional-charts": pmNodeNames.additionalCharts,
    socials: pmNodeNames.socials,
    "homepage-intro": pmNodeNames.homepageIntro,
    "country-profile-selector": pmNodeNames.countryProfileSelector,
    "subscribe-banner": pmNodeNames.subscribeBanner,
    "bespoke-component": pmNodeNames.bespokeComponent,
    "chart-story": pmNodeNames.chartStory,
    "chart-rows": pmNodeNames.chartRows,
    people: pmNodeNames.people,
    "people-rows": pmNodeNames.peopleRows,
    person: pmNodeNames.person,
    "key-indicator": pmNodeNames.keyIndicator,
    "key-indicator-collection": pmNodeNames.keyIndicatorCollection,
    "sdg-toc": pmNodeNames.sdgToc,
    "ltp-toc": pmNodeNames.ltpToc,
    "missing-data": pmNodeNames.missingData,
    donors: pmNodeNames.donorList,
    "latest-data-insights": pmNodeNames.latestDataInsights,
    "featured-data-insights": pmNodeNames.featuredDataInsights,
    "featured-metrics": pmNodeNames.featuredMetrics,
    "homepage-search": pmNodeNames.homepageSearch,
    "cookie-notice": pmNodeNames.cookieNotice,
} as const

/**
 * The single-hole editable containers, all shaped {content: block[]} in the
 * enriched model. Like the props atoms, their remaining fields travel
 * verbatim in a `props` attr; their content is edited in the canvas.
 * (key-insights nests one more level — slides — and is handled separately.)
 */
export const propsContainerBlockTypes = {
    expander: pmNodeNames.expander,
    "guided-chart": pmNodeNames.guidedChart,
    align: pmNodeNames.align,
    "data-callout": pmNodeNames.dataCallout,
    "data-callout-group": pmNodeNames.dataCalloutGroup,
    "explore-data-section": pmNodeNames.exploreDataSection,
    "conditional-section": pmNodeNames.conditionalSection,
    "topic-page-intro": pmNodeNames.topicPageIntro,
    "pull-chart": pmNodeNames.pullChart,
} as const

/** The two-column layout containers, all shaped {left, right} */
export const twoColumnBlockTypes = {
    "sticky-right": pmNodeNames.stickyRight,
    "sticky-left": pmNodeNames.stickyLeft,
    "side-by-side": pmNodeNames.sideBySide,
} as const

/**
 * The node types that carry a stable block identity (`blockId` attr ↔
 * enriched `id`): every node type that maps to a full enriched block,
 * including plain text-flow nodes (paragraph, heading, lists, hr) — the AI
 * assistant and block comments address any block by id, and positional
 * addressing is unsafe while collaborators edit concurrently. Structural
 * children (list items, table rows/cells, layout columns) stay unidentified;
 * they are addressed via their parent block.
 */
export const identifiedNodeNames: string[] = [
    pmNodeNames.paragraph,
    pmNodeNames.heading,
    pmNodeNames.bulletList,
    pmNodeNames.orderedList,
    pmNodeNames.horizontalRule,
    pmNodeNames.image,
    pmNodeNames.cta,
    pmNodeNames.rawBlock,
    ...Object.values(propsAtomBlockTypes),
    ...Object.values(propsContainerBlockTypes),
    pmNodeNames.keyInsights,
    pmNodeNames.aside,
    pmNodeNames.pullQuote,
    pmNodeNames.tableBlock,
    pmNodeNames.blockquote,
    pmNodeNames.callout,
    pmNodeNames.graySection,
    pmNodeNames.expandableParagraph,
    pmNodeNames.stickyRight,
    pmNodeNames.stickyLeft,
    pmNodeNames.sideBySide,
]

const identifiedNodeNameSet = new Set(identifiedNodeNames)

export function isIdentifiedNodeName(name: string): boolean {
    return identifiedNodeNameSet.has(name)
}

export const pmMarkNames = {
    bold: "bold",
    italic: "italic",
    underline: "underline",
    subscript: "subscript",
    superscript: "superscript",
    spanQuote: "spanQuote",
    spanFallback: "spanFallback",
    link: "link",
    ref: "ref",
    dod: "dod",
    guidedChartLink: "guidedChartLink",
} as const
