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
    tableBlock: "tableBlock",
    recirc: "recirc",
    researchAndWriting: "researchAndWriting",
    allCharts: "allCharts",
    pullQuote: "pullQuote",
    // editable containers
    aside: "aside",
    graySection: "graySection",
    expandableParagraph: "expandableParagraph",
    stickyRight: "stickyRight",
    stickyLeft: "stickyLeft",
    sideBySide: "sideBySide",
    layoutColumn: "layoutColumn",
} as const

/** The enriched block types that map to a uniform props-carrying atom node */
export const propsAtomBlockTypes = {
    chart: pmNodeNames.chart,
    "narrative-chart": pmNodeNames.narrativeChart,
    video: pmNodeNames.video,
    "prominent-link": pmNodeNames.prominentLink,
    table: pmNodeNames.tableBlock,
    recirc: pmNodeNames.recirc,
    "research-and-writing": pmNodeNames.researchAndWriting,
    "all-charts": pmNodeNames.allCharts,
    "pull-quote": pmNodeNames.pullQuote,
} as const

/** The two-column layout containers, all shaped {left, right} */
export const twoColumnBlockTypes = {
    "sticky-right": pmNodeNames.stickyRight,
    "sticky-left": pmNodeNames.stickyLeft,
    "side-by-side": pmNodeNames.sideBySide,
} as const

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
