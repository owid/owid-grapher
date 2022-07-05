import { mdParser } from "./parser.js"

describe("mdast parsers", () => {
    it("mdParser works for non-link brackets", () => {
        expect(mdParser.markupTokens.parse("[some text]")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "text",
                        value: "[some",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "text",
                        value: "text]",
                    },
                ],
            },
        })
    })
    it("mdParser works for funky characters in dod texts", () => {
        expect(
            mdParser.markupTokens.parse(
                "[int.$ *?=😛§&/%ü€](hover::test::term)"
            )
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "detailOnDemand",
                        children: [
                            {
                                type: "text",
                                value: "int.$",
                            },
                            {
                                type: "whitespace",
                            },
                            {
                                type: "text",
                                value: "*?=😛§&/%ü€",
                            },
                        ],
                        category: "test",
                        term: "term",
                    },
                ],
            },
        })
    })
    it("mdParser can parse a word", () => {
        expect(mdParser.markupTokens.parse("word")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "text",
                        value: "word",
                    },
                ],
            },
        })
    })
    it("mdParser can parse words with punctuation", () => {
        expect(mdParser.markupTokens.parse("can't?")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "text",
                        value: "can't?",
                    },
                ],
            },
        })

        expect(mdParser.markupTokens.parse("'mid-west'")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "text",
                        value: "'mid-west'",
                    },
                ],
            },
        })
    })
    it("mdParser can parse a word with bold", () => {
        expect(mdParser.markupTokens.parse("**I'm bold as brass**")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "bold",
                        children: [
                            { type: "text", value: "I'm" },
                            { type: "whitespace" },
                            { type: "text", value: "bold" },
                            { type: "whitespace" },
                            { type: "text", value: "as" },
                            { type: "whitespace" },
                            { type: "text", value: "brass" },
                        ],
                    },
                ],
            },
        })
    })
    it("mdParser can parse a phrase with italics", () => {
        expect(mdParser.markupTokens.parse("_Mamma mia!_")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "italic",
                        children: [
                            { type: "text", value: "Mamma" },
                            { type: "whitespace" },
                            { type: "text", value: "mia!" },
                        ],
                    },
                ],
            },
        })
    })
    it("mdParser can parse URLs", () => {
        expect(mdParser.markupTokens.parse("www.google.com")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "plainUrl",
                        href: "www.google.com",
                    },
                ],
            },
        })
        expect(mdParser.markupTokens.parse("[test](www.google.com)")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "markdownLink",
                        children: [{ type: "text", value: "test" }],
                        href: "www.google.com",
                    },
                ],
            },
        })
    })

    it("mdParser can parse detail on demand syntax", () => {
        expect(
            mdParser.markupTokens.parse("[**dod**](hover::general::thing)")
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "detailOnDemand",
                        children: [
                            {
                                type: "plainBold",
                                children: [
                                    {
                                        type: "text",
                                        value: "dod",
                                    },
                                ],
                            },
                        ],
                        category: "general",
                        term: "thing",
                    },
                ],
            },
        })
        expect(
            mdParser.markupTokens.parse(
                "[a dod with multiple words](hover::general::thing)"
            )
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "detailOnDemand",
                        children: [
                            {
                                type: "text",
                                value: "a",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                value: "dod",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                value: "with",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                value: "multiple",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                value: "words",
                            },
                        ],
                        category: "general",
                        term: "thing",
                    },
                ],
            },
        })
    })
    it("mdParser can parse words and newlines", () => {
        expect(
            mdParser.markupTokens.parse(`hello

how **are** you?`)
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "text",
                        value: "hello",
                    },
                    {
                        type: "newline",
                    },
                    {
                        type: "newline",
                    },
                    {
                        type: "text",
                        value: "how",
                    },
                    { type: "whitespace" },
                    {
                        children: [
                            {
                                type: "text",
                                value: "are",
                            },
                        ],
                        type: "bold",
                    },
                    { type: "whitespace" },
                    {
                        type: "text",
                        value: "you?",
                    },
                ],
            },
        })
    })

    it("mdParser can parse nested bold and italics", () => {
        expect(
            mdParser.markupTokens.parse(
                "Hello _I am italicized and **I am bolded and italicized**_"
            )
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "text",
                        value: "Hello",
                    },
                    { type: "whitespace" },
                    {
                        children: [
                            {
                                type: "text",
                                value: "I",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                value: "am",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                value: "italicized",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                value: "and",
                            },
                            { type: "whitespace" },
                            {
                                children: [
                                    {
                                        type: "text",
                                        value: "I",
                                    },
                                    { type: "whitespace" },
                                    {
                                        type: "text",
                                        value: "am",
                                    },
                                    { type: "whitespace" },
                                    {
                                        type: "text",
                                        value: "bolded",
                                    },
                                    { type: "whitespace" },
                                    {
                                        type: "text",
                                        value: "and",
                                    },
                                    { type: "whitespace" },
                                    {
                                        type: "text",
                                        value: "italicized",
                                    },
                                ],
                                type: "boldWithoutItalic",
                            },
                        ],
                        type: "italic",
                    },
                ],
            },
        })
    })

    it("mdParser can parse links inside bold and italics", () => {
        expect(
            mdParser.markupTokens.parse(
                "**_[bold and italic](www.ourworldindata.org)_**"
            )
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        children: [
                            {
                                children: [
                                    {
                                        children: [
                                            {
                                                type: "text",
                                                value: "bold",
                                            },
                                            { type: "whitespace" },
                                            {
                                                type: "text",
                                                value: "and",
                                            },
                                            { type: "whitespace" },
                                            {
                                                type: "text",
                                                value: "italic",
                                            },
                                        ],
                                        href: "www.ourworldindata.org",
                                        type: "markdownLink",
                                    },
                                ],
                                type: "italicWithoutBold",
                            },
                        ],
                        type: "bold",
                    },
                ],
            },
        })

        expect(
            mdParser.markupTokens.parse(
                "_**[italic and bold](www.google.com)**_"
            )
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        children: [
                            {
                                children: [
                                    {
                                        children: [
                                            {
                                                type: "text",
                                                value: "italic",
                                            },
                                            {
                                                type: "whitespace",
                                            },
                                            {
                                                type: "text",
                                                value: "and",
                                            },
                                            {
                                                type: "whitespace",
                                            },
                                            {
                                                type: "text",
                                                value: "bold",
                                            },
                                        ],
                                        href: "www.google.com",
                                        type: "markdownLink",
                                    },
                                ],
                                type: "boldWithoutItalic",
                            },
                        ],
                        type: "italic",
                    },
                ],
            },
        })
    })

    it("mdParser can parse details on demand inside bold", () => {
        expect(
            mdParser.markupTokens.parse(
                "**[an _italicized_ detail on demand](hover::fp::monad)**"
            )
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        children: [
                            {
                                category: "fp",
                                children: [
                                    {
                                        type: "text",
                                        value: "an",
                                    },
                                    {
                                        type: "whitespace",
                                    },
                                    {
                                        children: [
                                            {
                                                type: "text",
                                                value: "italicized",
                                            },
                                        ],
                                        type: "plainItalic",
                                    },
                                    {
                                        type: "whitespace",
                                    },
                                    {
                                        type: "text",
                                        value: "detail",
                                    },
                                    {
                                        type: "whitespace",
                                    },
                                    {
                                        type: "text",
                                        value: "on",
                                    },
                                    {
                                        type: "whitespace",
                                    },
                                    {
                                        type: "text",
                                        value: "demand",
                                    },
                                ],
                                term: "monad",
                                type: "detailOnDemand",
                            },
                        ],
                        type: "bold",
                    },
                ],
            },
        })
    })

    it("mdParser can parse words adjacent to bold", () => {
        expect(mdParser.markupTokens.parse("**bold**-word")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "bold",
                        children: [{ type: "text", value: "bold" }],
                    },
                    { type: "text", value: "-word" },
                ],
            },
        })
    })

    it.only("Parser can parse bold starting and stopping inside a word", () => {
        expect(mdParser.markupTokens.parse("test**some**postfix")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "words",
                        children: [
                            {
                                type: "text",
                                value: "test",
                            },
                            {
                                type: "plainBold",
                                children: [
                                    {
                                        type: "text",
                                        value: "some",
                                    },
                                ],
                            },
                            {
                                type: "text",
                                value: "postfix",
                            },
                        ],
                    },
                ],
            },
        })
    })

    it("parses unfinished bold correctly as text", () => {
        expect(mdParser.markupTokens.parse("** unfinished bold")).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "text",
                        value: "**",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "text",
                        value: "unfinished",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "text",
                        value: "bold",
                    },
                ],
            },
        })
    })

    it("parses unfinished bold with finished italic correctly", () => {
        expect(
            mdParser.markupTokens.parse("** unfinished bold _ italic _")
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "text",
                        value: "**",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "text",
                        value: "unfinished",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "text",
                        value: "bold",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "italic",
                        children: [
                            {
                                type: "whitespace",
                            },
                            {
                                type: "text",
                                value: "italic",
                            },
                            {
                                type: "whitespace",
                            },
                        ],
                    },
                ],
            },
        })
    })

    it("parses markdown links with just bold or just italic correctly and ignores nested bold/italic", () => {
        expect(
            mdParser.markupTokens.parse(
                "[A **bold** _italic **nonnested**_ link](https://owid.io/test)"
            )
        ).toEqual({
            status: true,
            value: {
                type: "DodMarkupRoot",
                children: [
                    {
                        type: "markdownLink",
                        children: [
                            {
                                type: "text",
                                value: "A",
                            },
                            {
                                type: "whitespace",
                            },
                            {
                                type: "plainBold",
                                children: [
                                    {
                                        type: "text",
                                        value: "bold",
                                    },
                                ],
                            },
                            {
                                type: "whitespace",
                            },
                            {
                                type: "plainItalic",
                                children: [
                                    {
                                        type: "text",
                                        value: "italic",
                                    },
                                    {
                                        type: "whitespace",
                                    },
                                    {
                                        type: "text",
                                        value: "**nonnested**",
                                    },
                                ],
                            },
                            {
                                type: "whitespace",
                            },
                            {
                                type: "text",
                                value: "link",
                            },
                        ],
                        href: "https://owid.io/test",
                    },
                ],
            },
        })
    })
})
