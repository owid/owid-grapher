import { describe, it, expect } from "vitest"
import * as R from "remeda"

import { OTHER_KEY } from "../../../../components/Sankey/SankeyHelpers.js"
import type { SankeyLink } from "../../../../components/Sankey/Sankey.js"
import {
    buildCountryGraph,
    DOMESTIC_KEY,
    FOCUS_NODE_ID,
    getGroupFromNodeId,
    getPartnerFromNodeId,
    isDomesticNodeId,
    isFocusNodeId,
    isOtherNodeId,
    makeGroupId,
    makePartnerId,
    type SankeyGraph,
} from "./buildGraph.js"
import type { TradeRow, View } from "./types.js"

const COUNTRY = "Brazilia"

const formatValue = (v: number): string => `${v} ha`
const getGroupLabel = (group: string): string => `The ${group}`
const getPartnerLabel = (partner: string): string => `${partner}!`

const rows = (entries: [string, string, number][]): TradeRow[] =>
    entries.map(([partner, group, value]) => ({ partner, group, value }))

/** One row per partner, all in the same commodity group */
const partnerRows = (values: number[], group = "soy"): TradeRow[] =>
    values.map((value, i) => ({ partner: `P${i}`, group, value }))

const buildCountry = (
    tradeRows: TradeRow[],
    opts?: {
        view?: View
        maxNodes?: number
        maxNodesToShrinkOther?: number
    }
): SankeyGraph =>
    buildCountryGraph({
        rows: tradeRows,
        country: COUNTRY,
        view: opts?.view ?? "consumption",
        formatValue,
        getGroupLabel,
        getPartnerLabel,
        maxNodes: opts?.maxNodes,
        maxNodesToShrinkOther: opts?.maxNodesToShrinkOther,
    })

const nodeIds = (graph: SankeyGraph): string[] => graph.nodes.map((n) => n.id)

const groupNodeIds = (graph: SankeyGraph): string[] =>
    nodeIds(graph).filter((id) => getGroupFromNodeId(id) !== undefined)

/** Node ids of the partner column, in drawing order */
const partnerColumnIds = (graph: SankeyGraph): string[] =>
    nodeIds(graph).filter(
        (id) => !isFocusNodeId(id) && getGroupFromNodeId(id) === undefined
    )

const linkKey = (link: SankeyLink): string =>
    `${link.source}→${link.target}${link.category ? `#${link.category}` : ""}`

const sumLinks = (links: SankeyLink[]): number => R.sumBy(links, (l) => l.value)

/** Every commodity node must pass on exactly what it receives */
function expectGroupsBalanced(graph: SankeyGraph): void {
    const groupIds = groupNodeIds(graph)
    expect(groupIds.length).toBeGreaterThan(0)
    for (const id of groupIds) {
        const incoming = sumLinks(graph.links.filter((l) => l.target === id))
        const outgoing = sumLinks(graph.links.filter((l) => l.source === id))
        expect(incoming).toBeCloseTo(outgoing)
    }
}

function expectUniqueLinks(graph: SankeyGraph): void {
    const keys = graph.links.map(linkKey)
    expect(R.unique(keys)).toEqual(keys)
}

describe("node id helpers", () => {
    it("round-trips partner and group names", () => {
        expect(getPartnerFromNodeId(makePartnerId("Côte d'Ivoire"))).toBe(
            "Côte d'Ivoire"
        )
        expect(getGroupFromNodeId(makeGroupId("beef & leather"))).toBe(
            "beef & leather"
        )
    })

    it("returns undefined for nodes that are not a real partner or group", () => {
        expect(getPartnerFromNodeId(FOCUS_NODE_ID)).toBeUndefined()
        expect(getPartnerFromNodeId(makeGroupId("soy"))).toBeUndefined()
        expect(getPartnerFromNodeId(makePartnerId(OTHER_KEY))).toBeUndefined()
        expect(
            getPartnerFromNodeId(makePartnerId(DOMESTIC_KEY))
        ).toBeUndefined()
        expect(getGroupFromNodeId(makePartnerId("Peru"))).toBeUndefined()
    })

    it("recognizes the special nodes", () => {
        expect(isOtherNodeId(makePartnerId(OTHER_KEY))).toBe(true)
        expect(isDomesticNodeId(makePartnerId(DOMESTIC_KEY))).toBe(true)
        expect(isFocusNodeId(FOCUS_NODE_ID)).toBe(true)
        expect(isOtherNodeId(makePartnerId("Peru"))).toBe(false)
        expect(isDomesticNodeId(makePartnerId("Peru"))).toBe(false)
        expect(isFocusNodeId(makeGroupId("soy"))).toBe(false)
    })
})

describe(buildCountryGraph, () => {
    it("returns an empty graph, but real headings, for no rows", () => {
        const graph = buildCountry([])
        expect(graph.nodes).toEqual([])
        expect(graph.links).toEqual([])
        expect(graph.total).toBe(0)
        expect(graph.otherBreakdown).toEqual({ left: [], right: [] })
        expect(graph.headings).toEqual([
            "Producing countries",
            "Commodity",
            `${COUNTRY}!`,
        ])
    })

    it("reads the headings as one sentence with the key words emphasised", () => {
        const sentence = buildCountry(partnerRows([1]), {
            view: "production",
        }).headingSentence
        const text = sentence.map((parts) => parts.map((p) => p.text).join(""))
        const label = getPartnerLabel(COUNTRY)
        expect(text).toEqual([
            `${label} cleared forest to produce`,
            "commodities",
            "that were consumed in",
        ])
        expect(sentence[0][0]).toEqual({ text: label, emphasis: true })
        expect(sentence[2].at(-1)).toEqual({
            text: "consumed in",
            emphasis: true,
        })
    })

    it("gives countries that take an article one, capitalised at the start of the sentence", () => {
        const production = buildCountryGraph({
            rows: rows([["Peru", "soy", 1]]),
            country: "United States",
            view: "production",
            formatValue,
            getGroupLabel,
        }).headingSentence
        expect(production[0][0]).toEqual({
            text: "The United States",
            emphasis: true,
        })
        const consumption = buildCountryGraph({
            rows: rows([["Peru", "soy", 1]]),
            country: "United States",
            view: "consumption",
            formatValue,
            getGroupLabel,
        }).headingSentence
        expect(consumption[2].map((p) => p.text).join("")).toBe(
            "that were consumed in the United States"
        )
    })

    it("names the country in the heading of its own column", () => {
        expect(buildCountry(partnerRows([1])).headings).toEqual([
            "Producing countries",
            "Commodity",
            `${COUNTRY}!`,
        ])
        expect(
            buildCountry(partnerRows([1]), { view: "production" }).headings
        ).toEqual([`${COUNTRY}!`, "Commodity", "Consuming countries"])
    })

    it("drops zero, negative and non-finite rows", () => {
        const graph = buildCountry(
            rows([
                ["Peru", "soy", 10],
                ["Chad", "soy", 0],
                ["Mali", "soy", -5],
                ["Togo", "soy", NaN],
                ["Laos", "soy", Infinity],
            ])
        )
        expect(partnerColumnIds(graph)).toEqual([makePartnerId("Peru")])
        expect(graph.total).toBe(10)
    })

    it("returns an empty graph when every row is dropped", () => {
        const graph = buildCountry(
            rows([
                ["Peru", "soy", 0],
                ["Chad", "soy", -1],
            ])
        )
        expect(graph.nodes).toEqual([])
        expect(graph.links).toEqual([])
        expect(graph.total).toBe(0)
    })

    it("counts domestic production in the total", () => {
        const graph = buildCountry(
            rows([
                ["Peru", "soy", 10],
                [COUNTRY, "soy", 30],
            ])
        )
        expect(graph.total).toBe(40)
    })

    it("carries domestic production on its own node, and each partner's share on its own link to the focus", () => {
        const graph = buildCountry(
            rows([
                ["Peru", "soy", 40],
                [COUNTRY, "soy", 12],
                [COUNTRY, "beef", 5],
                ["Chad", "beef", 25],
            ])
        )
        const domesticId = makePartnerId(DOMESTIC_KEY)
        // First layer: Domestic → each group it produces
        expect(
            graph.links
                .filter((l) => l.source === domesticId)
                .map((l) => [l.target, l.value])
        ).toEqual([
            [makeGroupId("soy"), 12],
            [makeGroupId("beef"), 5],
        ])
        // Second layer: per group, one link per partner tagged with the
        // partner's key, Domestic first like in the partner column
        expect(
            graph.links
                .filter((l) => l.target === FOCUS_NODE_ID)
                .map((l) => [l.source, l.category, l.value])
        ).toEqual([
            [makeGroupId("soy"), DOMESTIC_KEY, 12],
            [makeGroupId("soy"), "Peru", 40],
            [makeGroupId("beef"), DOMESTIC_KEY, 5],
            [makeGroupId("beef"), "Chad", 25],
        ])
        expectUniqueLinks(graph)
        expectGroupsBalanced(graph)
    })

    it("puts Domestic first and never folds it into Other, however tiny", () => {
        const graph = buildCountry(
            [
                ...partnerRows([100, 50, 9, 5, 3]),
                { partner: COUNTRY, group: "soy", value: 0.0001 },
            ],
            { maxNodes: 2, maxNodesToShrinkOther: 2 }
        )
        const column = partnerColumnIds(graph)
        expect(column[0]).toBe(makePartnerId(DOMESTIC_KEY))
        expect(graph.nodes[0].label).toBe(getPartnerLabel(COUNTRY))
        expect(graph.otherBreakdown.left.map((d) => d.entity)).not.toContain(
            COUNTRY
        )
    })

    it("puts Other last and lists exactly the folded partners, largest first", () => {
        const graph = buildCountry(partnerRows([100, 50, 9, 5, 3]), {
            maxNodes: 2,
            maxNodesToShrinkOther: 2,
        })
        const column = partnerColumnIds(graph)
        expect(column).toEqual([
            makePartnerId("P0"),
            makePartnerId("P1"),
            makePartnerId(OTHER_KEY),
        ])
        expect(graph.otherBreakdown.left).toEqual([
            { entity: "P2", total: 9 },
            { entity: "P3", total: 5 },
            { entity: "P4", total: 3 },
        ])
        expect(graph.otherBreakdown.right).toEqual([])
        // The Other node carries the folded partners' flows
        const otherLinks = graph.links.filter(
            (l) => l.source === makePartnerId(OTHER_KEY)
        )
        expect(sumLinks(otherLinks)).toBe(17)
    })

    it("reports the Other bucket on the partner side of an export graph", () => {
        const graph = buildCountry(partnerRows([100, 50, 9, 5, 3]), {
            view: "production",
            maxNodes: 2,
            maxNodesToShrinkOther: 2,
        })
        expect(graph.otherBreakdown.left).toEqual([])
        expect(graph.otherBreakdown.right.map((d) => d.entity)).toEqual([
            "P2",
            "P3",
            "P4",
        ])
    })

    it("leaves groups below the labelling threshold unlabelled and lists them", () => {
        const graph = buildCountryGraph({
            rows: rows([
                ["Peru", "soy", 90],
                ["Peru", "beef", 8],
                ["Peru", "rice", 2],
            ]),
            country: COUNTRY,
            view: "production",
            formatValue,
            getGroupLabel,
            minLabelledGroupShare: 0.05,
        })
        const groupNodes = graph.nodes.filter(
            (n) => getGroupFromNodeId(n.id) !== undefined
        )
        expect(groupNodes.map((n) => n.label)).toEqual([
            getGroupLabel("soy"),
            getGroupLabel("beef"),
            "",
        ])
        expect(groupNodes[2].valueLabel).toBeUndefined()
    })

    it("orders the commodity column by total, largest first", () => {
        const graph = buildCountry(
            rows([
                ["Peru", "soy", 5],
                ["Peru", "beef", 30],
                ["Chad", "palm", 12],
                ["Chad", "soy", 4],
            ])
        )
        expect(groupNodeIds(graph)).toEqual([
            makeGroupId("beef"),
            makeGroupId("palm"),
            makeGroupId("soy"),
        ])
    })

    it("balances every commodity across the two layers, in both views", () => {
        const tradeRows = [
            ...rows([
                ["Peru", "soy", 40],
                ["Peru", "beef", 10],
                ["Chad", "soy", 7],
                ["Chad", "palm", 25],
                [COUNTRY, "beef", 18],
            ]),
            ...partnerRows([4, 3, 2, 1], "palm"),
        ]
        for (const view of ["consumption", "production"] as const) {
            const graph = buildCountry(tradeRows, {
                view,
                maxNodes: 2,
                maxNodesToShrinkOther: 2,
            })
            expectGroupsBalanced(graph)
            expectUniqueLinks(graph)
            // Each layer carries the whole flow
            const focusLinks = graph.links.filter(
                (l) => l.source === FOCUS_NODE_ID || l.target === FOCUS_NODE_ID
            )
            expect(sumLinks(focusLinks)).toBeCloseTo(graph.total)
            expect(
                sumLinks(graph.links.filter((l) => !focusLinks.includes(l)))
            ).toBeCloseTo(graph.total)
        }
    })

    it("labels partner and commodity nodes with a value and a share", () => {
        const graph = buildCountry(
            rows([
                ["Peru", "soy", 30],
                ["Chad", "soy", 10],
            ])
        )
        const peru = graph.nodes.find((n) => n.id === makePartnerId("Peru"))
        expect(peru?.valueLabel).toBe("30 ha (75%)")
        const soy = graph.nodes.find((n) => n.id === makeGroupId("soy"))
        expect(soy?.label).toBe("The soy")
        expect(soy?.valueLabel).toContain("%")
        expect(soy?.valueLabel).toContain("40 ha")
    })

    it("leaves the focus node unlabelled, since its heading names it", () => {
        const graph = buildCountry(partnerRows([10]))
        const focus = graph.nodes.find((n) => isFocusNodeId(n.id))
        expect(focus).toEqual({ id: FOCUS_NODE_ID, label: "" })
        expect(nodeIds(graph).at(-1)).toBe(FOCUS_NODE_ID)
        expect(
            nodeIds(buildCountry(partnerRows([10]), { view: "production" }))[0]
        ).toBe(FOCUS_NODE_ID)
    })

    it("mirrors the import view in the export view", () => {
        const tradeRows = [
            ...rows([
                ["Peru", "soy", 40],
                ["Chad", "beef", 25],
                [COUNTRY, "soy", 12],
            ]),
        ]
        const importGraph = buildCountry(tradeRows, { view: "consumption" })
        const exportGraph = buildCountry(tradeRows, { view: "production" })

        expect(R.sortBy(nodeIds(exportGraph), R.identity())).toEqual(
            R.sortBy(nodeIds(importGraph), R.identity())
        )
        // The focus node moves from the right column to the left
        expect(nodeIds(importGraph).at(-1)).toBe(FOCUS_NODE_ID)
        expect(nodeIds(exportGraph)[0]).toBe(FOCUS_NODE_ID)

        const describeLinks = (graph: SankeyGraph): string[] =>
            R.sortBy(
                graph.links.map((l) => `${linkKey(l)}=${l.value}`),
                R.identity()
            )
        const reversed = R.sortBy(
            exportGraph.links.map(
                (l) =>
                    `${l.target}→${l.source}${l.category ? `#${l.category}` : ""}=${l.value}`
            ),
            R.identity()
        )
        expect(reversed).toEqual(describeLinks(importGraph))
        expect(exportGraph.total).toBe(importGraph.total)
    })

    it("respects maxNodes: at most maxNodes named partners plus Other and Domestic", () => {
        const maxNodes = 3
        const graph = buildCountry(
            [
                ...partnerRows([100, 50, 25, 12, 6, 3, 2, 1.5, 1.2, 1.1]),
                { partner: COUNTRY, group: "soy", value: 60 },
            ],
            { maxNodes, maxNodesToShrinkOther: maxNodes }
        )
        const column = partnerColumnIds(graph)
        const named = column.filter(
            (id) => getPartnerFromNodeId(id) !== undefined
        )
        expect(named.length).toBeLessThanOrEqual(maxNodes)
        expect(column.length).toBeLessThanOrEqual(maxNodes + 2)
        expect(column[0]).toBe(makePartnerId(DOMESTIC_KEY))
        expect(column.at(-1)).toBe(makePartnerId(OTHER_KEY))
    })

    it("emits unique, node-ordered links", () => {
        const graph = buildCountry(
            rows([
                ["Peru", "soy", 30],
                ["Peru", "beef", 5],
                ["Chad", "soy", 20],
                ["Chad", "beef", 1],
            ])
        )
        expectUniqueLinks(graph)
        expect(graph.links.map(linkKey)).toEqual([
            `${makePartnerId("Peru")}→${makeGroupId("soy")}`,
            `${makePartnerId("Peru")}→${makeGroupId("beef")}`,
            `${makePartnerId("Chad")}→${makeGroupId("soy")}`,
            `${makePartnerId("Chad")}→${makeGroupId("beef")}`,
            `${makeGroupId("soy")}→${FOCUS_NODE_ID}#Peru`,
            `${makeGroupId("soy")}→${FOCUS_NODE_ID}#Chad`,
            `${makeGroupId("beef")}→${FOCUS_NODE_ID}#Peru`,
            `${makeGroupId("beef")}→${FOCUS_NODE_ID}#Chad`,
        ])
    })
})
