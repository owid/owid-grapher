import { mdParser } from "./parser.js"

describe("mdast parsers", () => {
    it("mdParser.text can parse a word", () => {
        expect(mdParser.text.parse("word")).toEqual({
            status: true,
            value: {
                type: "text",
                value: "word",
            },
        })
    })
    it("mdParser.text can parse words with punctuation", () => {
        expect(mdParser.text.parse("can't?")).toEqual({
            status: true,
            value: {
                type: "text",
                value: "can't?",
            },
        })

        expect(mdParser.text.parse("'mid-west'")).toEqual({
            status: true,
            value: {
                type: "text",
                value: "'mid-west'",
            },
        })
    })
    it("mdParser.bold can parse a word with bold", () => {
        expect(mdParser.bold.parse("**I'm bold as brass**")).toEqual({
            status: true,
            value: {
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
        })
    })
    it("mdParser.italic can parse a phrase with italics", () => {
        expect(mdParser.italic.parse("_Mamma mia!_")).toEqual({
            status: true,
            value: {
                type: "italic",
                children: [
                    { type: "text", value: "Mamma" },
                    { type: "whitespace" },
                    { type: "text", value: "mia!" },
                ],
            },
        })
    })
    it("mdParser.url can parse URLs", () => {
        expect(mdParser.url.parse("www.google.com")).toEqual({
            status: true,
            value: {
                type: "url",
                children: [{ type: "text", value: "www.google.com" }],
                href: "www.google.com",
            },
        })
        expect(mdParser.url.parse("[test](www.google.com)")).toEqual({
            status: true,
            value: {
                type: "url",
                children: [{ type: "text", value: "test" }],
                href: "www.google.com",
            },
        })
    })

    it("mdParser.detailOnDemand can parse detail on demand syntax", () => {
        expect(
            mdParser.detailOnDemand.parse("[**dod**](hover::general::thing)")
        ).toEqual({
            status: true,
            value: {
                type: "detailOnDemand",
                children: [
                    {
                        type: "bold",
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
        })
        expect(
            mdParser.detailOnDemand.parse(
                "[a dod with multiple words](hover::general::thing)"
            )
        ).toEqual({
            status: true,
            value: {
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
        })
    })
    it("mdParser.value can parse words and newlines", () => {
        expect(
            mdParser.value.parse(`hello

how **are** you?`)
        ).toEqual({
            status: true,
            value: [
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
        })
    })

    it("mdParser can parse nested bold and italics", () => {
        expect(
            mdParser.value.parse(
                "Hello _I am italicized and **I am bolded and italicized**_"
            )
        ).toEqual({
            status: true,
            value: [
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
                            type: "bold",
                        },
                    ],
                    type: "italic",
                },
            ],
        })
    })

    it("mdParser.value can parse links inside bold and italics", () => {
        expect(
            mdParser.value.parse(
                "**_[bold and italic](www.ourworldindata.org)_**"
            )
        ).toEqual({
            status: true,
            value: [
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
                                    type: "url",
                                },
                            ],
                            type: "italic",
                        },
                    ],
                    type: "bold",
                },
            ],
        })

        expect(
            mdParser.value.parse("_**[italic and bold](www.google.com)**_")
        ).toEqual({
            status: true,
            value: [
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
                                    type: "url",
                                },
                            ],
                            type: "bold",
                        },
                    ],
                    type: "italic",
                },
            ],
        })
    })

    it("mdParser.value can parse details on demand inside bold", () => {
        expect(
            mdParser.value.parse(
                "**[an _italicized_ detail on demand](hover::fp::monad)**"
            )
        ).toEqual({
            status: true,
            value: [
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
                                    type: "italic",
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
        })
    })

    it("mdParser.value can parse words adjacent to bold", () => {
        expect(mdParser.value.parse("**bold**-word")).toEqual({
            status: true,
            value: [
                {
                    type: "bold",
                    children: [{ type: "text", value: "bold" }],
                },
                { type: "text", value: "-word" },
            ],
        })
    })
})
