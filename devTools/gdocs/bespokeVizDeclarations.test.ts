/*
 * What the bespoke viz registry accepts from a bundle's declarations: one
 * test per way of getting them wrong, plus the docs.md happy path. Reading
 * the declarations out of src/index.tsx (bespokeVizReferences.ts) is
 * exercised by `yarn generateGdocsReferences` on the real bundles.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/bespokeVizDeclarations.test.ts
 */

import { describe, expect, test } from "vitest"
import {
    buildBundleReference,
    type BundleDeclarations,
    type DeclaredVariant,
} from "./bespokeVizDeclarations.js"

const ENTRY = "bespoke/projects/demo/src/index.tsx"
const DOCS = "bespoke/projects/demo/docs.md"
const FENCE = "```"

function declarations(
    overrides: Partial<BundleDeclarations> = {}
): BundleDeclarations {
    return {
        id: "demo",
        entryFile: ENTRY,
        variants: [
            { name: "map", description: "A map" },
            { name: "chart", description: "A chart", defaultSize: "narrow" },
        ],
        config: [
            {
                name: "region",
                type: "string",
                default: "World",
                description: "Region shown first",
            },
            {
                name: "flow",
                type: "enum",
                values: ["both", "import", "export"],
                default: "both",
                description: "Trade direction",
            },
        ],
        ...overrides,
    }
}

function docs(text: string): BundleDeclarations["docs"] {
    return { file: DOCS, text }
}

const block = (lines: string): string =>
    FENCE + "archie\n{.bespoke-component}\n" + lines + "\n{}\n" + FENCE

function failureOf(input: BundleDeclarations): string {
    try {
        buildBundleReference(input)
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
    throw new Error("expected buildBundleReference to throw")
}

describe("a bundle without docs.md", () => {
    test("has empty prose and no examples", () => {
        const reference = buildBundleReference(declarations())
        expect(reference).toMatchObject({
            id: "demo",
            entryFile: ENTRY,
            prose: { intro: "" },
            examples: [],
        })
        expect(reference).not.toHaveProperty("sidecarFile")
    })

    test("keeps variants and config in source order, with defaults filled in", () => {
        const reference = buildBundleReference(declarations())
        expect(reference.variants.map((v) => [v.name, v.defaultSize])).toEqual([
            ["map", "wide"],
            ["chart", "narrow"],
        ])
        expect(reference.config.map((field) => field.name)).toEqual([
            "region",
            "flow",
        ])
        expect(reference.config[1].values).toEqual(["both", "import", "export"])
    })

    test("gives each variant a default block with no config", () => {
        const reference = buildBundleReference(declarations())
        expect(reference.variants[0].archie).toBe(
            "{.bespoke-component}\nbundle: demo\nvariant: map\nsize: wide\n{}\n"
        )
    })
})

describe("a declaration the reference would get wrong", () => {
    test("a variant without a description", () => {
        const message = failureOf(
            declarations({ variants: [{ name: "map", description: " " }] })
        )
        expect(message).toContain(ENTRY)
        expect(message).toContain('variant "map" has no description')
    })

    test("a config field without a description", () => {
        const message = failureOf(
            declarations({ config: [{ name: "region", type: "string" }] })
        )
        expect(message).toContain(ENTRY)
        expect(message).toContain("CONFIG_SPEC.region has no description")
    })

    test("a duplicate variant", () => {
        const message = failureOf(
            declarations({
                variants: [
                    { name: "map", description: "A map" },
                    { name: "map", description: "Another map" },
                ],
            })
        )
        expect(message).toContain(ENTRY)
        expect(message).toContain('duplicate variant "map"')
    })

    test("a blank config default", () => {
        const message = failureOf(
            declarations({
                config: [
                    {
                        name: "region",
                        type: "string",
                        default: "",
                        description: "Region",
                    },
                ],
            })
        )
        expect(message).toContain(ENTRY)
        expect(message).toContain("CONFIG_SPEC.region has a blank default")
    })

    test("an enum default outside its values", () => {
        const message = failureOf(
            declarations({
                config: [
                    {
                        name: "flow",
                        type: "enum",
                        values: ["both", "import"],
                        default: "export",
                        description: "Trade direction",
                    },
                ],
            })
        )
        expect(message).toContain(ENTRY)
        expect(message).toContain("CONFIG_SPEC.flow.default")
        expect(message).toContain("both, import")
    })

    test("a default block that does not parse", () => {
        // The size is only checked by the bespoke typecheck, so a bad one
        // reaches the block parser.
        const message = failureOf(
            declarations({
                variants: [
                    {
                        name: "map",
                        description: "A map",
                        defaultSize: "huge" as DeclaredVariant["defaultSize"],
                    },
                ],
            })
        )
        expect(message).toContain(ENTRY)
        expect(message).toContain('variant "map" default block is invalid')
    })

    test("lists every failure at once", () => {
        const message = failureOf(
            declarations({
                variants: [
                    { name: "map" },
                    { name: "chart", description: "A chart" },
                    { name: "chart", description: "Another chart" },
                ],
            })
        )
        expect(message).toContain("2 problem(s)")
    })
})

describe("docs.md", () => {
    const valid = [
        "Explore the demo.",
        "",
        block("bundle: demo\nvariant: chart\n{.config}\nflow: import\n{}"),
        "",
        "## Notes",
        "",
        "Data is updated yearly.",
    ].join("\n")

    test("supplies the prose, examples and sidecar file", () => {
        const reference = buildBundleReference(
            declarations({ docs: docs(valid) })
        )
        expect(reference.sidecarFile).toBe(DOCS)
        expect(reference.prose.intro).toContain("Explore the demo.")
        expect(reference.prose.notes).toBe("Data is updated yearly.")
        expect(reference.examples).toHaveLength(1)
        expect(reference.examples[0]).toMatchObject({
            flavour: "archie",
            section: "intro",
            position: 0,
        })
    })

    const docsFailure = (text: string): string => {
        const message = failureOf(declarations({ docs: docs(text) }))
        expect(message).toContain(DOCS)
        return message
    }

    test("any front matter", () => {
        expect(docsFailure("---\ntitle: Demo\n---\nIntro.")).toContain(
            "takes no front matter"
        )
    })

    test("no intro", () => {
        expect(docsFailure("## Notes\n\nSome notes.")).toContain("no intro")
    })

    test("a misspelled heading", () => {
        expect(docsFailure("Intro.\n\n## Note\n\nSome notes.")).toContain(
            'did you mean "## Notes"'
        )
    })

    const exampleFailure = (example: string): string => {
        const message = docsFailure("Intro.\n\n" + example)
        expect(message).toContain("example #1")
        return message
    }

    test("an example that fails validation", () => {
        expect(
            exampleFailure(FENCE + "archie\n{.bespoke-component}\n{}\n" + FENCE)
        ).toContain("Bundle property is required")
    })

    test("a whole-document example", () => {
        expect(
            exampleFailure(
                FENCE +
                    "archie-document\ntitle: T\ntype: article\n[+body]\nText.\n[]\n" +
                    FENCE
            )
        ).toContain("archie-document")
    })

    test("an example that is not a single bespoke-component", () => {
        expect(
            exampleFailure(
                FENCE +
                    "archie\nA paragraph.\n\n{.bespoke-component}\nbundle: demo\nvariant: map\n{}\n" +
                    FENCE
            )
        ).toContain("exactly one {.bespoke-component}")
    })

    test("an example of another bundle", () => {
        expect(exampleFailure(block("bundle: other\nvariant: map"))).toContain(
            'bundle is "other", not "demo"'
        )
    })

    test("an unknown variant", () => {
        expect(exampleFailure(block("bundle: demo\nvariant: globe"))).toContain(
            'unknown variant "globe"'
        )
    })

    test("an unknown config key", () => {
        expect(
            exampleFailure(
                block("bundle: demo\nvariant: map\n{.config}\ncolour: red\n{}")
            )
        ).toContain('unknown config key "colour"')
    })

    test("a disallowed enum value", () => {
        expect(
            exampleFailure(
                block("bundle: demo\nvariant: map\n{.config}\nflow: up\n{}")
            )
        ).toContain('"up" is not one of the allowed values: both, import')
    })
})
