import { expect, it, describe } from "vitest"
import {
    GuideReference,
    OwidGdocType,
    TemplateReference,
} from "@ourworldindata/types"
import {
    sortGuides,
    sortTemplatesByUsage,
    stepHighlight,
} from "./gdocsReferenceNav.js"

const guide = (
    id: string,
    category: GuideReference["category"]
): GuideReference => ({
    id,
    title: id,
    category,
    sidecarFile: `guides/${id}.md`,
    description: "",
    prose: { intro: "" },
    examples: [],
})

describe(sortGuides, () => {
    it("orders by category in presentation order, then by title", () => {
        const sorted = sortGuides([
            guide("sticky-nav", "Structure"),
            guide("refs", "Writing"),
            guide("deprecating-an-article", "Publishing"),
            guide("headings-and-structure", "Structure"),
            guide("details-on-demand", "Writing"),
        ])
        expect(sorted.map((g) => g.id)).toEqual([
            "details-on-demand",
            "refs",
            "headings-and-structure",
            "sticky-nav",
            "deprecating-an-article",
        ])
    })
})

const template = (id: string): TemplateReference => ({
    id,
    contentTypeName: id,
    sidecarFile: `templates/${id}.md`,
    title: id,
    prose: { intro: "" },
    fields: [],
    adminManagedFields: [],
    skeleton: [],
})

describe(sortTemplatesByUsage, () => {
    const totalDocsByType = {
        [OwidGdocType.Article]: 900,
        [OwidGdocType.DataInsight]: 400,
        [OwidGdocType.TopicPage]: 60,
    }

    it("orders by published count desc, then title alphabetically", () => {
        const sorted = sortTemplatesByUsage(
            [
                template(OwidGdocType.TopicPage),
                template(OwidGdocType.Article),
                template(OwidGdocType.DataInsight),
                template(OwidGdocType.Homepage),
                template(OwidGdocType.AboutPage),
            ],
            totalDocsByType
        )
        expect(sorted.map((t) => t.id)).toEqual([
            OwidGdocType.Article,
            OwidGdocType.DataInsight,
            OwidGdocType.TopicPage,
            OwidGdocType.AboutPage,
            OwidGdocType.Homepage,
        ])
    })

    it("sorts alphabetically when the usage totals are undefined", () => {
        const sorted = sortTemplatesByUsage(
            [
                template(OwidGdocType.TopicPage),
                template(OwidGdocType.Article),
                template(OwidGdocType.DataInsight),
            ],
            undefined
        )
        expect(sorted.map((t) => t.id)).toEqual([
            OwidGdocType.Article,
            OwidGdocType.DataInsight,
            OwidGdocType.TopicPage,
        ])
    })
})

describe(stepHighlight, () => {
    it("steps from undefined to the first index", () => {
        expect(stepHighlight(undefined, 1, 5)).toBe(0)
    })

    it("wraps from the last index back to the first", () => {
        expect(stepHighlight(4, 1, 5)).toBe(0)
    })

    it("wraps from the first index back to the last", () => {
        expect(stepHighlight(0, -1, 5)).toBe(4)
    })

    it("stays undefined when there is nothing to highlight", () => {
        expect(stepHighlight(undefined, 1, 0)).toBeUndefined()
        expect(stepHighlight(2, -1, 0)).toBeUndefined()
    })
})
