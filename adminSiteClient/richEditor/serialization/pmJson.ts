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
