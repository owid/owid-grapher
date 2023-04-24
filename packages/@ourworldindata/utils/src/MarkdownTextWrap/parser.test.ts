import { mdParser } from "./parser"

describe("mdast parsers", () => {
    it("mdParser works for non-link brackets", () => {
        expect(mdParser.markdown.parse("[some text]")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
            mdParser.markdown.parse("[int.$ *?=😛§&/%ü€](hover::test::term)")
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
        expect(mdParser.markdown.parse("word")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
        expect(mdParser.markdown.parse("can't?")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        type: "text",
                        value: "can't?",
                    },
                ],
            },
        })

        expect(mdParser.markdown.parse("'mid-west'")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
        expect(mdParser.markdown.parse("**I'm bold as brass**")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
        expect(mdParser.markdown.parse("_Mamma mia!_")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
        expect(mdParser.markdown.parse("www.google.com")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        type: "plainUrl",
                        href: "www.google.com",
                    },
                ],
            },
        })
        expect(mdParser.markdown.parse("[test](www.google.com)")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
    it("can parse markdown links with relative URLs", () => {
        expect(mdParser.markdown.parse("[about us](/about-us)")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        children: [
                            {
                                type: "text",
                                value: "about",
                            },
                            {
                                type: "whitespace",
                            },
                            {
                                type: "text",
                                value: "us",
                            },
                        ],
                        href: "/about-us",
                        type: "markdownLink",
                    },
                ],
            },
        })
        expect(mdParser.markdown.parse("[test](www.google.com)")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
        expect(mdParser.markdown.parse("[**dod**](#dod:thing)")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
                        term: "thing",
                    },
                ],
            },
        })
        expect(
            mdParser.markdown.parse("[a dod with multiple words](#dod:thing)")
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
            mdParser.markdown.parse(`hello

how **are** you?`)
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
            mdParser.markdown.parse(
                "Hello _I am italicized and **I am bolded and italicized**_"
            )
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
            mdParser.markdown.parse(
                "**_[bold and italic](www.ourworldindata.org)_**"
            )
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
            mdParser.markdown.parse("_**[italic and bold](www.google.com)**_")
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
            mdParser.markdown.parse(
                "**[an _italicized_ detail on demand](hover::fp::monad)**"
            )
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
        expect(mdParser.markdown.parse("**bold**-word")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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

    it("Parser can parse bold starting and stopping inside a word", () => {
        expect(mdParser.markdown.parse("test**some**postfix")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        type: "text",
                        value: "test",
                    },
                    {
                        type: "bold",
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
        })
    })

    it("parses unfinished bold correctly as text", () => {
        expect(mdParser.markdown.parse("** unfinished bold")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
            mdParser.markdown.parse("** unfinished bold _ italic _")
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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

    it("parses nested-in-bold, non-spaced italics", () => {
        expect(mdParser.markdown.parse("**one-_two_-three**")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        children: [
                            {
                                type: "text",
                                value: "one-",
                            },
                            {
                                children: [
                                    {
                                        type: "text",
                                        value: "two",
                                    },
                                ],
                                type: "italicWithoutBold",
                            },
                            {
                                type: "text",
                                value: "-three",
                            },
                        ],
                        type: "bold",
                    },
                ],
            },
        })
    })

    it("parses nested-in-italic, non-spaced bold", () => {
        expect(mdParser.markdown.parse("_one-**two**-three_")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        children: [
                            {
                                type: "text",
                                value: "one-",
                            },
                            {
                                children: [
                                    {
                                        type: "text",
                                        value: "two",
                                    },
                                ],
                                type: "boldWithoutItalic",
                            },
                            {
                                type: "text",
                                value: "-three",
                            },
                        ],
                        type: "italic",
                    },
                ],
            },
        })
    })

    it("parses markdown links with just bold or just italic correctly and ignores nested bold/italic", () => {
        expect(
            mdParser.markdown.parse(
                "[A **bold** _italic **nonnested**_ link](https://owid.io/test)"
            )
        ).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
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
    it("Parses nonbreaking spaces as text", () => {
        expect(mdParser.markdown.parse("text with nonbreaking space")).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        type: "text",
                        value: "text",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "text",
                        value: "with",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "text",
                        value: "nonbreaking",
                    },
                    {
                        type: "text",
                        value: " ",
                    },
                    {
                        type: "text",
                        value: "space",
                    },
                ],
            },
        })
    })
    it("Parses whitespace preceding a newline", () => {
        const input =
            "this-line-ends-with-a-space" +
            " " +
            "\n" +
            "but-the-newline-should-be-tracked-separately"
        expect(mdParser.markdown.parse(input)).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        type: "text",
                        value: "this-line-ends-with-a-space",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "newline",
                    },
                    {
                        type: "text",
                        value: "but-the-newline-should-be-tracked-separately",
                    },
                ],
            },
        })
    })
    it("Parses newlines surrounded by whitespace", () => {
        const input =
            "this-line-ends-with-a-space" +
            " " +
            "\n\n" +
            " " +
            "but-the-newline-should-be-tracked-separately"
        expect(mdParser.markdown.parse(input)).toEqual({
            status: true,
            value: {
                type: "MarkdownRoot",
                children: [
                    {
                        type: "text",
                        value: "this-line-ends-with-a-space",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "newline",
                    },
                    {
                        type: "newline",
                    },
                    {
                        type: "whitespace",
                    },
                    {
                        type: "text",
                        value: "but-the-newline-should-be-tracked-separately",
                    },
                ],
            },
        })
    })
})
