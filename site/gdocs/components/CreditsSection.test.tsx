import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Contributor, EnrichedBlockText } from "@ourworldindata/types"
import { Attachments, AttachmentsContext } from "../AttachmentsContext.js"
import CreditsSection from "./CreditsSection.js"

const attachments: Attachments = {
    linkedAuthors: [],
    linkedDocuments: {},
    imageMetadata: {},
    linkedCharts: {},
    linkedIndicators: {},
    relatedCharts: [],
    linkedNarrativeCharts: {},
    linkedStaticViz: {},
    tags: [],
}

function stripTags(html: string): string {
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
}

const contributors: Contributor[] = [
    { name: "Max Roser", role: "Editorial feedback" },
    { name: "Edouard Mathieu", role: "Editorial feedback" },
    { name: "Marwa Boukarim", role: "Design and visualization" },
]

const acknowledgements: EnrichedBlockText[] = [
    {
        type: "text",
        value: [
            {
                spanType: "span-simple-text",
                text: "Many thanks to Marcel Gerber for his help in building this interactive visualization.",
            },
        ],
        parseErrors: [],
    },
]

function renderCreditsSection(
    props: Partial<Parameters<typeof CreditsSection>[0]> = {}
): string {
    return renderToStaticMarkup(
        <AttachmentsContext.Provider value={attachments}>
            <CreditsSection
                contributors={[]}
                acknowledgements={[]}
                {...props}
            />
        </AttachmentsContext.Provider>
    )
}

describe(CreditsSection, () => {
    it("renders the authors sentence with the Oxford comma and conjunction", () => {
        const text = stripTags(
            renderCreditsSection({
                authors: [
                    "Sophia Mersmann",
                    "Daniel Bachler",
                    "Hannah Ritchie",
                ],
                authorRoles: {
                    "Sophia Mersmann": "Data visualization",
                    "Daniel Bachler": "Concept & modeling",
                    "Hannah Ritchie": "Writing",
                },
            })
        )
        expect(text).toContain(
            "By Sophia Mersmann (Data visualization), Daniel Bachler (Concept & modeling), and Hannah Ritchie (Writing)."
        )
    })

    it("omits the authors paragraph when no authors are given", () => {
        const html = renderCreditsSection()
        expect(html).not.toContain("By ")
    })

    it("renders the contributors sentence without a conjunction before the last name", () => {
        const text = stripTags(renderCreditsSection({ contributors }))
        expect(text).toContain(
            "Max Roser (Editorial feedback), Edouard Mathieu (Editorial feedback), Marwa Boukarim (Design and visualization)."
        )
        expect(text).not.toContain("and Marwa Boukarim")
    })

    it("omits the contributors paragraph when no contributors are given", () => {
        const text = stripTags(renderCreditsSection({ acknowledgements }))
        expect(text).not.toContain("Roser")
    })

    it("renders the acknowledgement prose as its own paragraph", () => {
        const text = stripTags(renderCreditsSection({ acknowledgements }))
        expect(text).toContain(
            "Many thanks to Marcel Gerber for his help in building this interactive visualization."
        )
    })
})
