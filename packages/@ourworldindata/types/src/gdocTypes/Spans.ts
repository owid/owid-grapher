export type SpanSimpleText = {
    spanType: "span-simple-text"
    text: string
}

export type SpanFallback = {
    spanType: "span-fallback"
    children: Span[]
}

export type SpanLink = {
    spanType: "span-link"
    children: Span[]
    url: string
}

export type SpanRef = {
    spanType: "span-ref"
    children: Span[]
    url: string
}

export type SpanDod = {
    spanType: "span-dod"
    children: Span[]
    id: string
}

export type SpanGuidedChartLink = {
    spanType: "span-guided-chart-link"
    children: Span[]
    url: string
}

export const CALLOUT_FUNCTIONS = ["latestTime", "latestValue"] as const
export type CalloutFunction = (typeof CALLOUT_FUNCTIONS)[number]

export type SpanCallout = {
    spanType: "span-callout"
    functionName: CalloutFunction
    parameters: string[] // e.g., ["Consumption-based emissions"]
    children: Span[] // placeholder text from the gdoc link
}

export type SpanNewline = {
    spanType: "span-newline"
}

export type SpanItalic = {
    spanType: "span-italic"
    children: Span[]
}

export type SpanBold = {
    spanType: "span-bold"
    children: Span[]
}

export type SpanUnderline = {
    spanType: "span-underline"
    children: Span[]
}

export type SpanSubscript = {
    spanType: "span-subscript"
    children: Span[]
}

export type SpanSuperscript = {
    spanType: "span-superscript"
    children: Span[]
}

export type SpanQuote = {
    spanType: "span-quote"
    children: Span[]
}
export type UnformattedSpan = SpanSimpleText | SpanNewline

export type Span =
    | SpanSimpleText
    | SpanCallout
    | SpanDod
    | SpanGuidedChartLink
    | SpanLink
    | SpanRef
    | SpanNewline
    | SpanItalic
    | SpanBold
    | SpanUnderline
    | SpanSubscript
    | SpanSuperscript
    | SpanQuote
    | SpanFallback
