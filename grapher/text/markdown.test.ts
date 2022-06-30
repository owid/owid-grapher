import { mdParse } from "./markdown.js"

describe("mdast parsers", () => {
    it("mdParser.text can parse a word", () => {
        expect(mdParse("word")).toEqual([{ type: "text", content: "word" }])
    })
    it("mdParser.text can parse words with punctuation", () => {
        expect(mdParse("can't?")).toEqual([
            {
                type: "text",
                content: "can",
            },
            {
                type: "text",
                content: "'t",
            },
            {
                type: "text",
                content: "?",
            },
        ])

        expect(mdParse("'mid-west'")).toEqual([
            {
                type: "text",
                content: "'mid",
            },
            {
                type: "text",
                content: "-west",
            },
            {
                type: "text",
                content: "'",
            },
        ])
    })
    it("mdParser.bold can parse a word with bold", () => {
        expect(mdParse("**I'm bold as brass**")).toEqual([
            {
                type: "strong",
                content: [
                    { type: "text", content: "I" },
                    { type: "text", content: "'m" },
                    { type: "whitespace" },
                    { type: "text", content: "bold" },
                    { type: "whitespace" },
                    { type: "text", content: "as" },
                    { type: "whitespace" },
                    { type: "text", content: "brass" },
                ],
            },
        ])
    })
    it("mdParser.italic can parse a phrase with italics", () => {
        expect(mdParse("_Mamma mia!_")).toEqual([
            {
                type: "em",
                content: [
                    { type: "text", content: "Mamma" },
                    { type: "whitespace" },
                    { type: "text", content: "mia" },
                    { type: "text", content: "!" },
                ],
            },
        ])
    })
    it("mdParser.url can parse URLs", () => {
        // expect(mdParse("www.google.com")).toEqual([
        //     {
        //         type: "link",
        //         content: [
        //             { type: "text", content: "www" },
        //             { type: "text", content: ".google" },
        //             { type: "text", content: ".com" },
        //         ],
        //         target: "www.google.com",
        //         title: undefined,
        //     },
        // ])
        expect(mdParse("[test](www.google.com)")).toEqual([
            {
                type: "link",
                content: [{ type: "text", content: "test" }],
                target: "www.google.com",
                title: undefined,
            },
        ])
    })

    //     it("mdParser.detailOnDemand can parse detail on demand syntax", () => {
    //         expect(
    //             mdParser.detailOnDemand.parse("[**dod**](hover::general::thing)")
    //         ).toEqual({
    //             status: true,
    //             value: {
    //                 type: "detailOnDemand",
    //                 children: [
    //                     {
    //                         type: "bold",
    //                         children: [
    //                             {
    //                                 type: "text",
    //                                 value: "dod",
    //                             },
    //                         ],
    //                     },
    //                 ],
    //                 category: "general",
    //                 term: "thing",
    //             },
    //         })
    //         expect(
    //             mdParser.detailOnDemand.parse(
    //                 "[a dod with multiple words](hover::general::thing)"
    //             )
    //         ).toEqual({
    //             status: true,
    //             value: {
    //                 type: "detailOnDemand",
    //                 children: [
    //                     {
    //                         type: "text",
    //                         value: "a",
    //                     },
    //                     { type: "whitespace" },
    //                     {
    //                         type: "text",
    //                         value: "dod",
    //                     },
    //                     { type: "whitespace" },
    //                     {
    //                         type: "text",
    //                         value: "with",
    //                     },
    //                     { type: "whitespace" },
    //                     {
    //                         type: "text",
    //                         value: "multiple",
    //                     },
    //                     { type: "whitespace" },
    //                     {
    //                         type: "text",
    //                         value: "words",
    //                     },
    //                 ],
    //                 category: "general",
    //                 term: "thing",
    //             },
    //         })
    //     })
    it("mdParser.value can parse words and newlines", () => {
        expect(
            mdParse(`hello

    how **are** you?`)
        ).toEqual([
            {
                type: "text",
                content: "hello",
            },
            {
                type: "br",
            },
            {
                type: "br",
            },
            { type: "whitespace" },
            {
                type: "text",
                content: "how",
            },
            { type: "whitespace" },
            {
                content: [
                    {
                        type: "text",
                        content: "are",
                    },
                ],
                type: "strong",
            },
            { type: "whitespace" },
            {
                type: "text",
                content: "you",
            },
            {
                type: "text",
                content: "?",
            },
        ])
    })

    it("mdParser can parse nested bold and italics", () => {
        expect(
            mdParse(
                "Hello _I am italicized and **I am bolded and italicized**_"
            )
        ).toEqual([
            {
                type: "text",
                content: "Hello",
            },
            { type: "whitespace" },
            {
                content: [
                    {
                        type: "text",
                        content: "I",
                    },
                    { type: "whitespace" },
                    {
                        type: "text",
                        content: "am",
                    },
                    { type: "whitespace" },
                    {
                        type: "text",
                        content: "italicized",
                    },
                    { type: "whitespace" },
                    {
                        type: "text",
                        content: "and",
                    },
                    { type: "whitespace" },
                    {
                        type: "strong",
                        content: [
                            {
                                type: "text",
                                content: "I",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                content: "am",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                content: "bolded",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                content: "and",
                            },
                            { type: "whitespace" },
                            {
                                type: "text",
                                content: "italicized",
                            },
                        ],
                    },
                ],
                type: "em",
            },
        ])
    })

    it("mdParser.value can parse links inside bold and italics", () => {
        expect(
            mdParse("**_[bold and italic](www.ourworldindata.org)_**")
        ).toEqual([
            {
                content: [
                    {
                        content: [
                            {
                                content: [
                                    {
                                        type: "text",
                                        content: "bold",
                                    },
                                    { type: "whitespace" },
                                    {
                                        type: "text",
                                        content: "and",
                                    },
                                    { type: "whitespace" },
                                    {
                                        type: "text",
                                        content: "italic",
                                    },
                                ],
                                target: "www.ourworldindata.org",
                                title: undefined,
                                type: "link",
                            },
                        ],
                        type: "em",
                    },
                ],
                type: "strong",
            },
        ])

        expect(mdParse("_**[italic and bold](www.google.com)**_")).toEqual([
            {
                content: [
                    {
                        content: [
                            {
                                content: [
                                    {
                                        type: "text",
                                        content: "italic",
                                    },
                                    {
                                        type: "whitespace",
                                    },
                                    {
                                        type: "text",
                                        content: "and",
                                    },
                                    {
                                        type: "whitespace",
                                    },
                                    {
                                        type: "text",
                                        content: "bold",
                                    },
                                ],
                                target: "www.google.com",
                                title: undefined,
                                type: "link",
                            },
                        ],
                        type: "strong",
                    },
                ],
                type: "em",
            },
        ])
    })

    // it("mdParser.value can parse details on demand inside bold", () => {
    //     expect(
    //         mdParser.value.parse(
    //             "**[an _italicized_ detail on demand](hover::fp::monad)**"
    //         )
    //     ).toEqual({
    //         status: true,
    //         value: [
    //             {
    //                 children: [
    //                     {
    //                         category: "fp",
    //                         children: [
    //                             {
    //                                 type: "text",
    //                                 value: "an",
    //                             },
    //                             {
    //                                 type: "whitespace",
    //                             },
    //                             {
    //                                 children: [
    //                                     {
    //                                         type: "text",
    //                                         value: "italicized",
    //                                     },
    //                                 ],
    //                                 type: "italic",
    //                             },
    //                             {
    //                                 type: "whitespace",
    //                             },
    //                             {
    //                                 type: "text",
    //                                 value: "detail",
    //                             },
    //                             {
    //                                 type: "whitespace",
    //                             },
    //                             {
    //                                 type: "text",
    //                                 value: "on",
    //                             },
    //                             {
    //                                 type: "whitespace",
    //                             },
    //                             {
    //                                 type: "text",
    //                                 value: "demand",
    //                             },
    //                         ],
    //                         term: "monad",
    //                         type: "detailOnDemand",
    //                     },
    //                 ],
    //                 type: "bold",
    //             },
    //         ],
    //     })
    // })

    it("mdParser.value can parse words adjacent to bold", () => {
        expect(mdParse("**bold**-word")).toEqual([
            {
                type: "strong",
                content: [{ type: "text", content: "bold" }],
            },
            { type: "text", content: "-word" },
        ])
    })
})
