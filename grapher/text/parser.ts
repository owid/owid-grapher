import P, { Language } from "parsimmon"

// An AST inspired by MDAST
// Deviates because we want to track individual words, whitespace, and newlines to use with TextWrap and our SVG exporter

// The root literal that should be the leaf of every branch that isn't a newline or whitespace
interface Text {
    type: "text"
    value: string
}

export const textParser = (): P.Parser<Text> =>
    P.regex(/[A-Za-z'\-":!?,.]+/).map((value) => ({ type: "text", value }))

// A special literal that we use when building lines with TextWrap
interface Newline {
    type: "newline"
}

const newlineParser = (): P.Parser<Newline> =>
    P.regex(/\n/).result({ type: "newline" })

// Another literal that's needed to know when to reinsert spaces (e.g. "**one**-two" versus "**one** -two")
interface Whitespace {
    type: "whitespace"
}

// A less greedy version of P.whitespace that doesn't consume newlines
const whitespaceParser = (): P.Parser<Whitespace> =>
    P.regex(/ +/).result({ type: "whitespace" })

//
interface MarkdownNode {
    type: string
    children: (Text | MarkdownNode)[]
}

const boldParser = (r: P.Language) =>
    P.seqObj<MarkdownNode>(
        P.string("**"),
        ["children", r.value],
        P.string("**")
    ).map(({ children }) => ({
        type: "bold",
        children,
    }))

const italicParser = (r: P.Language) =>
    P.seqObj<MarkdownNode>(
        P.string("_"),
        ["children", r.value],
        P.string("_")
    ).map(({ children }) => ({
        type: "italic",
        children,
    }))

// https://urlregex.com
const urlRegex =
    /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/

const markdownUrlParser = (r: Language) =>
    P.seqObj<{ children: MarkdownNode[]; href: string }>(
        P.string("["),
        ["children", r.phrasing.many()],
        P.string("]("),
        ["href", P.regex(urlRegex)],
        P.string(")")
    ).map(({ children, href }) => ({
        type: "url",
        children,
        href,
    }))

const plainURLParser = () =>
    P.regex(urlRegex).map((result) => ({
        type: "url",
        children: [{ type: "text", value: result }],
        href: result,
    }))

const urlParser = (r: Language) => P.alt(markdownUrlParser(r), plainURLParser())

const detailOnDemandParser = (r: Language) =>
    P.seqObj<{
        category: string
        term: string
        children: MarkdownNode[]
    }>(
        P.string("["),
        ["children", r.phrasing.many()],
        P.string("](hover::"),
        ["category", P.letters],
        P.string("::"),
        ["term", P.letters],
        P.string(")")
    ).map(({ children, category, term }) => ({
        type: "detailOnDemand",
        category,
        term,
        children,
    }))

export const mdParser = P.createLanguage({
    phrasing: (r) => P.alt(r.whitespace, r.bold, r.italic, r.text),
    wrappers: (r) => P.alt(r.detailOnDemand, r.url),
    newline: newlineParser,
    whitespace: whitespaceParser,
    text: textParser,
    bold: boldParser,
    italic: italicParser,
    detailOnDemand: detailOnDemandParser,
    url: urlParser,
    value: (r) => P.alt(r.newline, r.wrappers, r.phrasing).many(),
})
