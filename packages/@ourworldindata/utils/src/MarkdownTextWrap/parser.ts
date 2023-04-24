import P from "parsimmon"
import { detailOnDemandRegex } from "../GdocsUtils.js"
// An AST inspired by MDAST
// Deviates because we want to track individual words, whitespace, and newlines to use with MarkdownTextWrap and our SVG exporter

// How this parser works

// This parser uses the parsimmon javascript library that implements a monadic parser combinator.
// We considered forking simple-markdown, but went with combinators for easier maintenance.
// You can think of a parser in this context as a generic class that parses an object of the type
// that is specified as the type parameter of the class. parser combinators build up more complex
// parsers by combining smaller parsers, mostly by specifying either sequences or alternatives.
// Alternatives (P.alt()) try a list of given parsers one at a time, backtracking when parsing with
// a given parser doesn't work and trying the next one.

// Because of this it is important to consider the order of parsers in alternatives and to make
// sure that nested parsers fail when they should (e.g. when you have an opening ** for bold it
// is important that you make sure that you find a matching ** at the end in instead of
//  accidentally consuming ** with a very generic parser that takes any token and that would
// then not let you match this end string fragment and close the bold tag).

// By and large this parser tries to define a special type for every individual parser plus a
// parsing function. We don't really care about some of the differences (e.g. Text and NonBracketWord
// have to be parsed differently but result in the same shape of data). To make things more
// consistent though, every parser has it's own type name, even if they rather often just alias
// to Text. This should make it easy in the future to switch more parsed types to actual concrete
//  types if we need a richer AST for some reason.

// Parsing bold and italic in markdown is a bit more involved than most parsing jobs for actual
// programming languages that try harder to be parseable with a context free grammar. Consider
// that bold and italic can be nested in each other but it doesn't really make sense to nest
// bold in italic in bold (and this would create annoying ambiguity). For this reason this parser
// is quite explicit and has 3 different kinds of bold and italic:
// * one that can contain only contain text, whitespace and newlines
// * one that can also contain Urls, markdown links and Details on Demand but not other italic or bold
// * and finally one for the top level that can also contain the other one (bold that can have
//     italic or italic that can have bold content) but in a non-nestable way

// This might be overkill for our current needs but I wanted to err on the side of making the
// parser strict and precisise now to avoid weird ambiguities in the future.

//#region Parser types

// The default interface for nodes that (for now) we don't want to track as a special type
interface Text {
    type: "text"
    value: string
}

// A special literal that we use when building lines with TextWrap
interface Newline {
    type: "newline"
}

// Another literal that's needed to know when to reinsert spaces (e.g. "**one**-two" versus "**one** -two")
interface Whitespace {
    type: "whitespace"
}

interface PlainUrl {
    type: "plainUrl"
    href: string
}

type NonBracketWord = Text

type NonParensWord = Text

type NonSingleUnderscoreWord = Text

type NonDoubleColonOrParensWord = Text

type NonDoubleStarWord = Text

type MarkdownLinkContent = Whitespace | Newline | NonBracketWord

type DodCategory = Text

type DodTerm = Text

interface MarkdownLink {
    type: "markdownLink"
    children: MarkdownLinkContent[]
    href: string
}

type DetailsOnDemandContent =
    | Whitespace
    | Newline
    | PlainItalic
    | PlainBold
    | NonBracketWord

interface DetailOnDemand {
    type: "detailOnDemand"
    term: string
    children: DetailsOnDemandContent[]
}

type BoldWithoutItalicContent =
    | Whitespace
    | Newline
    | PlainUrl
    | MarkdownLink
    | DetailOnDemand
    | NonDoubleStarWord

interface BoldWithoutItalic {
    type: "boldWithoutItalic"
    children: BoldWithoutItalicContent[]
}

type BoldContent =
    | ItalicWithoutBold
    | Whitespace
    | Newline
    | PlainUrl
    | MarkdownLink
    | DetailOnDemand
    | NonDoubleStarWord

interface Bold {
    type: "bold"
    children: BoldContent[]
}

type PlainBoldContent = Whitespace | Newline | NonDoubleStarWord

interface PlainBold {
    type: "plainBold"
    children: PlainBoldContent[]
}

type ItalicWithoutBoldContent =
    | Whitespace
    | Newline
    | PlainUrl
    | MarkdownLink
    | DetailOnDemand
    | NonSingleUnderscoreWord

interface ItalicWithoutBold {
    type: "italicWithoutBold"
    children: ItalicWithoutBoldContent[]
}
type ItalicContent =
    | BoldWithoutItalic
    | Whitespace
    | Newline
    | PlainUrl
    | MarkdownLink
    | DetailOnDemand
    | NonSingleUnderscoreWord

interface Italic {
    type: "italic"
    children: ItalicContent[]
}

type PlainItalicContent = Whitespace | Newline | NonSingleUnderscoreWord

interface PlainItalic {
    type: "plainItalic"
    children: PlainItalicContent[]
}

// TextSegment is used when we need to break up a string of non-whitespace characters
// into multiple segments because it may have "formatting tmesis"
// e.g. abso_freaking_lutely
type TextSegment = Bold | Italic | Text

interface TextSegments {
    type: "textSegments"
    children: TextSegment[]
}

export interface MarkdownRoot {
    type: "MarkdownRoot"
    children: Array<
        | Newline
        | Whitespace
        | DetailOnDemand
        | MarkdownLink
        | PlainUrl
        | Bold
        | PlainBold
        | Italic
        | PlainItalic
        | TextSegments
        | Text
    >
}

type languagePartsType = typeof languageParts

type MdParser = {
    [P in keyof languagePartsType]: ReturnType<languagePartsType[P]>
}

// Every possible child of a MarkdownRoot node
export type EveryMarkdownNode =
    | TextSegments
    | NonSingleUnderscoreWord
    | Bold
    | BoldContent
    | PlainBold
    | Italic
    | ItalicContent
    | PlainItalic

// #endregion

//#region Terminal parsers
const fallbackTextParser = (): P.Parser<Text> =>
    P.regex(/[^\s]+/).map((val) => ({ type: "text", value: val }))

const newlineParser = (): P.Parser<Newline> =>
    P.regex(/\n/).result({ type: "newline" })

const nonbreakingSpaceParser = (): P.Parser<Text> =>
    // According to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Character_Classes
    // the \s character class includes the following codepoints: [ \f\n\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
    // We want to treat newlines and nonbreaking spaces specially. Out of the list above, the codepoints u+00a0 and u+202f look like
    // they should be treated as non-breaking whitespace
    P.regex(/[\u00a0\ufeff]+/).map((val) => ({ type: "text", value: val }))

// Also based on that MDN article, we don't want to consume newlines when we're looking for spaces and tabs
// "  \n" should turn into [{ type: "whitespace" }, { type: "newline" }]
const nonNewlineWhitespaceParser = (): P.Parser<Whitespace> =>
    P.regex(
        /[\r\t\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/
    ).result({ type: "whitespace" })

const plainUrlParser = (): P.Parser<PlainUrl> =>
    P.regex(urlRegex).map((result) => ({
        type: "plainUrl",
        href: result,
    }))

// https://urlregex.com
const urlRegex =
    /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w\-]*))?)/

const nonBracketWordParser: (r: MdParser) => P.Parser<NonBracketWord> = () =>
    P.regex(/[^\[\]\s]+/).map((val) => ({ type: "text", value: val })) //  no brackets, no WS

const nonParensWordParser: (r: MdParser) => P.Parser<NonParensWord> = () =>
    P.regex(/[^\(\)\s]+/).map((val) => ({ type: "text", value: val })) // no parens, no WS

const nonDoubleColonOrParensWordParser: (
    r: MdParser
) => P.Parser<NonDoubleColonOrParensWord> = () =>
    P.regex(/([^\(\):\s]|:(?!:))+/).map((val) => ({ type: "text", value: val })) // no parens, no WS, no ::

const nonSingleUnderscoreWordParser: (
    r: MdParser
) => P.Parser<NonSingleUnderscoreWord> = () =>
    P.regex(/[^_\s]+/).map((val) => ({ type: "text", value: val })) // no WS, no _

const nonDoubleStarWordParser: (
    r: MdParser
) => P.Parser<NonDoubleStarWord> = () =>
    P.regex(/([^*\s]|\*(?!\*))+/).map((val) => ({ type: "text", value: val })) // no WS, no **

const nonStylingCharactersParser: (r: MdParser) => P.Parser<Text> = () =>
    P.regex(/[^\s*_]+/).map((value) => ({ type: "text", value })) // Consume up to * or _

const dodCategoryParser: (r: MdParser) => P.Parser<DodCategory> = () =>
    P.regex(/([^\(\):\s]|:(?!:))+/).map((val) => ({
        type: "text",
        value: val,
    })) // no WS, no parens, no ::

const dodTermParser: (r: MdParser) => P.Parser<DodTerm> = () =>
    P.regex(/([^\(\):\s]|:(?!:))+/).map((val) => ({
        type: "text",
        value: val,
    })) // no WS, no parens, no ::

//#endregion

//#region Higher level parsers

const markdownLinkContentParser: (
    r: MdParser
) => P.Parser<MarkdownLinkContent> = (r: MdParser) =>
    P.alt(
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.plainBold,
        r.plainItalic,
        r.nonBracketWord
    )

const markdownLinkParser: (r: MdParser) => P.Parser<MarkdownLink> = (
    r: MdParser
) =>
    P.seqObj<{ children: MarkdownLinkContent[]; href: string }>(
        P.string("["),
        [
            "children",
            r.markdownLinkContent /* as P.Parser<MarkdownLinkContent> */
                .atLeast(1),
        ],
        P.string("]("),
        ["href", P.alt(P.regex(/\/[\w\-]+/), P.regex(urlRegex))],
        P.string(")")
    ).map(({ children, href }) => ({
        type: "markdownLink",
        children,
        href,
    }))

const detailOnDemandContentParser: (
    r: MdParser
) => P.Parser<DetailsOnDemandContent> = (r: MdParser) =>
    P.alt(
        // In TS 4.7 parsimmon could type the parser as Covariant on its type parameter which would remove the need for these casts
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.plainBold,
        r.plainItalic,
        r.nonBracketWord
    )

export function extractDetailsFromSyntax(str: string): string[] {
    return [...str.matchAll(new RegExp(detailOnDemandRegex, "g"))].map(
        ([_, term]) => term
    )
}

const detailOnDemandParser: (r: MdParser) => P.Parser<DetailOnDemand> = (
    r: MdParser
) =>
    P.seqObj<{
        category: Text
        term: Text
        children: DetailsOnDemandContent[]
    }>(
        P.string("["),
        ["children", r.detailOnDemandContent.atLeast(1)],
        P.string("](#dod:"),
        ["term", r.dodTerm],
        P.string(")")
    ).map(({ children, term }) => ({
        type: "detailOnDemand",
        term: term.value,
        children,
    }))

const boldWithoutItalicContentParser: (
    r: MdParser
) => P.Parser<BoldWithoutItalicContent> = (r: MdParser) =>
    P.alt(
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.nonDoubleStarWord
    )

const boldWithoutItalicParser: (r: MdParser) => P.Parser<BoldWithoutItalic> = (
    r: MdParser
) =>
    P.seqObj<{ children: BoldWithoutItalicContent[] }>(
        P.string("**"),
        ["children", r.boldWithoutItalicContent.atLeast(1)],
        P.string("**")
    ).map(({ children }) => ({
        type: "boldWithoutItalic",
        children,
    }))

const boldContentParser: (r: MdParser) => P.Parser<BoldContent> = (
    r: MdParser
) =>
    P.alt(
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.italicWithoutBold,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.nonStylingCharacters
    )

const boldParser: (r: MdParser) => P.Parser<Bold> = (r: MdParser) =>
    P.seqObj<{ children: BoldContent[] }>(
        P.string("**"),
        ["children", r.boldContent.atLeast(1)],
        P.string("**")
    ).map(({ children }) => ({
        type: "bold",
        children,
    }))

const plainBoldContentParser: (r: MdParser) => P.Parser<PlainBoldContent> = (
    r: MdParser
) =>
    P.alt(
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.nonDoubleStarWord
    )

const plainBoldParser: (r: MdParser) => P.Parser<PlainBold> = (r: MdParser) =>
    P.seqObj<PlainBold>(
        P.string("**"),
        ["children", r.plainBoldContent.atLeast(1)],
        P.string("**")
    ).map(({ children }) => ({
        type: "plainBold",
        children,
    }))

const italicWithoutBoldContentParser: (
    r: MdParser
) => P.Parser<ItalicWithoutBoldContent> = (r: MdParser) =>
    P.alt(
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.newline,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.nonStylingCharacters
    )

const italicWithoutBoldParser: (r: MdParser) => P.Parser<ItalicWithoutBold> = (
    r: MdParser
) =>
    P.seqObj<{ children: ItalicWithoutBoldContent[] }>(
        P.string("_"),
        ["children", r.italicWithoutBoldContent.atLeast(1)],
        P.string("_")
    ).map(({ children }) => ({
        type: "italicWithoutBold",
        children,
    }))
const italicContentParser: (r: MdParser) => P.Parser<ItalicContent> = (
    r: MdParser
) =>
    P.alt(
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.boldWithoutItalic,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.nonStylingCharacters
    )

const italicParser: (r: MdParser) => P.Parser<Italic> = (r: MdParser) =>
    P.seqObj<Italic>(
        P.string("_"),
        ["children", r.italicContent.atLeast(1)],
        P.string("_")
    ).map(({ children }) => ({
        type: "italic",
        children,
    }))

const plainItalicContentParser: (
    r: MdParser
) => P.Parser<PlainItalicContent> = (r: MdParser) =>
    P.alt(
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.nonSingleUnderscoreWord
    )

const plainItalicParser: (r: MdParser) => P.Parser<PlainItalic> = (
    r: MdParser
) =>
    P.seqObj<PlainItalic>(
        P.string("_"),
        ["children", r.plainItalicContent.atLeast(1)],
        P.string("_")
    ).map(({ children }) => ({
        type: "plainItalic",
        children,
    }))

//#endregion

//#region Top level language construction

const markdownParser: (r: MdParser) => P.Parser<MarkdownRoot> = (r) =>
    // The order is crucial here!
    P.alt(
        r.newline,
        r.nonbreakingSpace,
        r.nonNewlineWhitespace,
        r.detailOnDemand,
        r.markdownLink,
        r.plainUrl,
        r.bold,
        r.italic,
        // Consume up to ** or _, if possible
        r.nonStylingCharacters,
        // Otherwise consume everything
        r.fallbackText
    )
        .atLeast(1)
        .map(
            (tokens): MarkdownRoot => ({
                type: "MarkdownRoot",
                children: tokens,
            })
        )

const languageParts = {
    markdown: markdownParser,
    newline: newlineParser,
    nonbreakingSpace: nonbreakingSpaceParser,
    nonNewlineWhitespace: nonNewlineWhitespaceParser,
    detailOnDemand: detailOnDemandParser,
    markdownLink: markdownLinkParser,
    plainUrl: plainUrlParser,
    bold: boldParser,
    italic: italicParser,
    plainBold: plainBoldParser,
    plainItalic: plainItalicParser,
    fallbackText: fallbackTextParser,
    // Utility parsers below - these will never be tried on the top level because text covers everything else
    detailOnDemandContent: detailOnDemandContentParser,
    markdownLinkContent: markdownLinkContentParser,
    boldContent: boldContentParser,
    plainBoldContent: plainBoldContentParser,
    boldWithoutItalic: boldWithoutItalicParser,
    boldWithoutItalicContent: boldWithoutItalicContentParser,
    plainItalicContent: plainItalicContentParser,
    italicContent: italicContentParser,
    italicWithoutBold: italicWithoutBoldParser,
    italicWithoutBoldContent: italicWithoutBoldContentParser,
    nonBracketWord: nonBracketWordParser,
    nonParensWord: nonParensWordParser,
    nonDoubleColonOrParensWord: nonDoubleColonOrParensWordParser,
    nonDoubleStarWord: nonDoubleStarWordParser,
    nonStylingCharacters: nonStylingCharactersParser,
    nonSingleUnderscoreWord: nonSingleUnderscoreWordParser,
    dodCategory: dodCategoryParser,
    dodTerm: dodTermParser,
} as const

export const mdParser: MdParser = P.createLanguage(languageParts)

//#endregion
