import * as R from "remeda"
import { match } from "ts-pattern"

import { articulateEntity } from "@ourworldindata/utils"

import type {
    SankeyColumnHeadingPart,
    SankeyLink,
    SankeyNode,
} from "../../../../components/Sankey/Sankey.js"
import {
    DEFAULT_MAX_NODES,
    DEFAULT_MAX_NODES_TO_SHRINK_OTHER,
    DEFAULT_MIN_NODE_SHARE,
    getEntityShortLabel,
    makeValueLabel,
    OTHER_KEY,
    type EntityTotal,
    type Flow,
} from "../../../../components/Sankey/SankeyHelpers.js"
import { selectTopEntities } from "../../../../components/Sankey/SplitFlowSankey.js"
import type { TradeRow, View } from "./types.js"

/** The country the chart is about; the left or right column of a country graph */
export const FOCUS_NODE_ID = "focus"

/** Partner key for the country's own, non-traded production */
export const DOMESTIC_KEY = "__domestic__"

const PARTNER_PREFIX = "partner:"
const GROUP_PREFIX = "group:"

const OTHER_LABEL = "Other countries"

export const makePartnerId = (name: string): string =>
    `${PARTNER_PREFIX}${name}`

export const makeGroupId = (name: string): string => `${GROUP_PREFIX}${name}`

/** The column-entry key of a partner-column node — a partner name, `OTHER_KEY`
 *  or `DOMESTIC_KEY` — or `undefined` for the focus and group nodes. It is what
 *  the focus layer's `SankeyLink.category` carries. */
export function getPartnerKeyFromNodeId(id: string): string | undefined {
    return id.startsWith(PARTNER_PREFIX)
        ? id.slice(PARTNER_PREFIX.length)
        : undefined
}

/** The partner country of a node, or `undefined` for focus/group/Other/Domestic */
export function getPartnerFromNodeId(id: string): string | undefined {
    if (!id.startsWith(PARTNER_PREFIX)) return undefined
    const partner = id.slice(PARTNER_PREFIX.length)
    if (partner === OTHER_KEY || partner === DOMESTIC_KEY) return undefined
    return partner
}

/** The commodity group of a node, or `undefined` for any other node */
export function getGroupFromNodeId(id: string): string | undefined {
    if (!id.startsWith(GROUP_PREFIX)) return undefined
    return id.slice(GROUP_PREFIX.length)
}

export const isOtherNodeId = (id: string): boolean =>
    id === makePartnerId(OTHER_KEY)

export const isDomesticNodeId = (id: string): boolean =>
    id === makePartnerId(DOMESTIC_KEY)

export const isFocusNodeId = (id: string): boolean => id === FOCUS_NODE_ID

export type SankeyGraph = {
    nodes: SankeyNode[]
    links: SankeyLink[]
    /** Short column headings left → right, for when space is tight */
    headings: [string, string, string]
    /** The headings as one sentence across the three columns, its key words
     *  emphasised: "Germany cleared forest to produce · commodities · that were
     *  consumed in" */
    headingSentence: [
        SankeyColumnHeadingPart[],
        SankeyColumnHeadingPart[],
        SankeyColumnHeadingPart[],
    ]
    /** Total flow through the middle column (= sum of link values in one layer) */
    total: number
    /** Partners folded into the "Other" node on each side, largest first; empty when there is none */
    otherBreakdown: { left: EntityTotal[]; right: EntityTotal[] }
}

type Limits = {
    maxNodes: number
    maxNodesToShrinkOther: number
    minNodeShare: number
    /** Groups below this share of the commodity column get no label */
    minLabelledGroupShare: number
}

/** One entry of a partner column, in drawing order */
type PartnerEntry = {
    /** A partner name, or `OTHER_KEY` / `DOMESTIC_KEY` */
    key: string
    label: string
    total: number
}

type PartnerColumn = {
    entries: PartnerEntry[]
    /** Which column entry a row's partner belongs to */
    keyForPartner: (partner: string) => string
    other: EntityTotal[]
    total: number
}

/** A column is either the country the chart is about, or a set of partners */
type ColumnInput =
    | { kind: "focus" }
    | {
          kind: "partners"
          rows: TradeRow[]
          /** Rows whose partner is this country are its domestic production
           *  and are routed to a Domestic node */
          domesticCountry?: string
      }

const plain = (text: string): SankeyColumnHeadingPart => ({ text })
const emphasis = (text: string): SankeyColumnHeadingPart => ({
    text,
    emphasis: true,
})

const EMPTY_BREAKDOWN = (): { left: EntityTotal[]; right: EntityTotal[] } => ({
    left: [],
    right: [],
})

const isUsableRow = (row: TradeRow): boolean =>
    Number.isFinite(row.value) && row.value > 0

const cleanRows = (rows: TradeRow[]): TradeRow[] => rows.filter(isUsableRow)

const sumRows = (rows: TradeRow[]): number => R.sumBy(rows, (r) => r.value)

/** Total per commodity group, largest first, ties broken by name */
function groupTotals(rows: TradeRow[]): Map<string, number> {
    const totals = new Map<string, number>()
    for (const row of rows)
        totals.set(row.group, (totals.get(row.group) ?? 0) + row.value)
    return totals
}

/**
 * Split a column's partners into the ones big enough to be drawn as their own
 * node and an "Other" bucket, keeping Domestic out of the bucketing entirely.
 */
function buildPartnerColumn({
    rows,
    domesticCountry,
    getPartnerLabel,
    limits,
}: {
    rows: TradeRow[]
    domesticCountry: string | undefined
    getPartnerLabel: (partner: string) => string
    limits: Limits
}): PartnerColumn {
    const isDomestic = (partner: string): boolean =>
        domesticCountry !== undefined && partner === domesticCountry

    const domesticTotal = sumRows(rows.filter((r) => isDomestic(r.partner)))
    const foreignRows = rows.filter((r) => !isDomestic(r.partner))

    const flows: Flow[] = foreignRows.map((r) => ({
        source: r.partner,
        target: r.group,
        value: r.value,
    }))

    const { top, other } = selectTopEntities({
        flows,
        side: "source",
        maxNodes: limits.maxNodes,
        maxNodesToShrinkOther: limits.maxNodesToShrinkOther,
        minNodeShare: limits.minNodeShare,
        showAllOtherBelow: 1,
    })

    const topKeys = new Set(top.map((d) => d.entity))
    const otherTotal = R.sumBy(other, (d) => d.total)

    const entries: PartnerEntry[] = [
        ...(domesticCountry !== undefined && domesticTotal > 0
            ? [
                  // The country's own production is labelled with its name,
                  // like any other partner; its colour sets it apart
                  {
                      key: DOMESTIC_KEY,
                      label: getPartnerLabel(domesticCountry),
                      total: domesticTotal,
                  },
              ]
            : []),
        ...top.map((d) => ({
            key: d.entity,
            label: getPartnerLabel(d.entity),
            total: d.total,
        })),
        ...(other.length > 0
            ? [{ key: OTHER_KEY, label: OTHER_LABEL, total: otherTotal }]
            : []),
    ]

    const keyForPartner = (partner: string): string => {
        if (isDomestic(partner)) return DOMESTIC_KEY
        return topKeys.has(partner) ? partner : OTHER_KEY
    }

    return {
        entries,
        keyForPartner,
        other,
        total: R.sumBy(entries, (e) => e.total),
    }
}

function makePartnerNodes({
    column,
    formatValue,
}: {
    column: PartnerColumn
    formatValue: (v: number) => string
}): SankeyNode[] {
    return column.entries.map((entry) => ({
        id: makePartnerId(entry.key),
        label: entry.label,
        valueLabel: makeValueLabel({
            value: entry.total,
            total: column.total,
            formatValue,
        }),
    }))
}

/** Flow per (column entry, commodity group), the cells both link layers draw from */
type Cells = Map<string, Map<string, number>>

function computeCells(rows: TradeRow[], column: PartnerColumn): Cells {
    const cells: Cells = new Map()
    for (const row of rows) {
        const partnerKey = column.keyForPartner(row.partner)
        const byGroup = cells.get(partnerKey) ?? new Map<string, number>()
        byGroup.set(row.group, (byGroup.get(row.group) ?? 0) + row.value)
        cells.set(partnerKey, byGroup)
    }
    return cells
}

/**
 * Links between the partner column and the commodity column, one per
 * (column entry, group), emitted in source-then-target node order.
 */
function makePartnerLinks({
    cells,
    column,
    groupOrder,
    direction,
}: {
    cells: Cells
    column: PartnerColumn
    groupOrder: string[]
    direction: "partnerToGroup" | "groupToPartner"
}): SankeyLink[] {
    const links: SankeyLink[] = []
    const push = (partnerKey: string, group: string): void => {
        const value = cells.get(partnerKey)?.get(group)
        if (value === undefined || value <= 0) return
        const partnerId = makePartnerId(partnerKey)
        const groupId = makeGroupId(group)
        links.push(
            direction === "partnerToGroup"
                ? { source: partnerId, target: groupId, value }
                : { source: groupId, target: partnerId, value }
        )
    }

    // Domestic is the first column entry, so its band sits at the top of both
    // the partner node and the group node
    if (direction === "partnerToGroup")
        for (const entry of column.entries)
            for (const group of groupOrder) push(entry.key, group)
    else
        for (const group of groupOrder)
            for (const entry of column.entries) push(entry.key, group)

    return links
}

/**
 * Links between the commodity column and the focus node: one per (group,
 * column entry), tagged with the entry's key, so a partner's share can be
 * followed through the commodity node and lit up as one path. Emitted per
 * group in the partners' order, which is the order their bands arrive in on
 * the other side of the group node, so the two layers line up.
 */
function makeFocusLinks({
    cells,
    column,
    groupOrder,
    direction,
}: {
    cells: Cells
    column: PartnerColumn
    groupOrder: string[]
    direction: "toGroup" | "fromGroup"
}): SankeyLink[] {
    const links: SankeyLink[] = []
    for (const group of groupOrder)
        for (const entry of column.entries) {
            const value = cells.get(entry.key)?.get(group)
            if (value === undefined || value <= 0) continue
            const groupId = makeGroupId(group)
            const category = entry.key
            links.push(
                direction === "toGroup"
                    ? {
                          source: FOCUS_NODE_ID,
                          target: groupId,
                          value,
                          category,
                      }
                    : {
                          source: groupId,
                          target: FOCUS_NODE_ID,
                          value,
                          category,
                      }
            )
        }
    return links
}

/**
 * The shared shape of both views: a partner column or the focus node on the
 * left, the commodity groups in the middle, and the other one on the right.
 */
function buildThreeColumnGraph({
    left,
    right,
    headings,
    headingSentence,
    total,
    formatValue,
    getGroupLabel,
    getPartnerLabel,
    limits,
}: {
    left: ColumnInput
    right: ColumnInput
    headings: SankeyGraph["headings"]
    headingSentence: SankeyGraph["headingSentence"]
    total: number
    formatValue: (v: number) => string
    getGroupLabel: (group: string) => string
    getPartnerLabel: (partner: string) => string
    limits: Limits
}): SankeyGraph {
    const partnerSides = [left, right].filter(
        (side): side is Extract<ColumnInput, { kind: "partners" }> =>
            side.kind === "partners"
    )

    // The partner column carries the whole flow volume per group; the focus
    // layer mirrors it
    const groupValues = new Map<string, number>()
    for (const side of partnerSides)
        for (const [group, value] of groupTotals(side.rows))
            groupValues.set(group, value)

    const groupOrder = R.pipe(
        [...groupValues.entries()],
        R.filter(([, value]) => value > 0),
        R.sortBy([([, value]) => value, "desc"], [([group]) => group, "asc"]),
        R.map(([group]) => group)
    )

    if (groupOrder.length === 0)
        return {
            nodes: [],
            links: [],
            headings,
            headingSentence,
            total: 0,
            otherBreakdown: EMPTY_BREAKDOWN(),
        }

    const groupColumnTotal = R.sumBy(groupOrder, (g) => groupValues.get(g) ?? 0)
    // Groups too small for a readable label are left unlabelled in the chart
    const isLabelled = (group: string): boolean =>
        groupColumnTotal > 0 &&
        (groupValues.get(group) ?? 0) / groupColumnTotal >=
            limits.minLabelledGroupShare
    const groupNodes: SankeyNode[] = groupOrder.map((group) =>
        isLabelled(group)
            ? {
                  id: makeGroupId(group),
                  label: getGroupLabel(group),
                  valueLabel: makeValueLabel({
                      value: groupValues.get(group) ?? 0,
                      total: groupColumnTotal,
                      formatValue,
                  }),
              }
            : { id: makeGroupId(group), label: "" }
    )

    // The focus node is named by its column heading, so it carries no label
    const focusNode: SankeyNode = { id: FOCUS_NODE_ID, label: "" }

    // Both layers draw from the same partner × group cells, so a partner's
    // band can be followed from its node through the commodity node to the
    // focus node
    const partnerInput = partnerSides[0]
    const column = buildPartnerColumn({
        rows: partnerInput.rows,
        domesticCountry: partnerInput.domesticCountry,
        getPartnerLabel,
        limits,
    })
    const cells = computeCells(partnerInput.rows, column)

    const buildSide = (
        input: ColumnInput,
        side: "left" | "right"
    ): {
        nodes: SankeyNode[]
        links: SankeyLink[]
        other: EntityTotal[]
    } => {
        if (input.kind === "focus")
            return {
                nodes: [focusNode],
                links: makeFocusLinks({
                    cells,
                    column,
                    groupOrder,
                    direction: side === "left" ? "toGroup" : "fromGroup",
                }),
                other: [],
            }
        return {
            nodes: makePartnerNodes({ column, formatValue }),
            links: makePartnerLinks({
                cells,
                column,
                groupOrder,
                direction:
                    side === "left" ? "partnerToGroup" : "groupToPartner",
            }),
            other: column.other,
        }
    }

    const leftSide = buildSide(left, "left")
    const rightSide = buildSide(right, "right")

    return {
        nodes: [...leftSide.nodes, ...groupNodes, ...rightSide.nodes],
        links: [...leftSide.links, ...rightSide.links],
        headings,
        headingSentence,
        total,
        otherBreakdown: { left: leftSide.other, right: rightSide.other },
    }
}

/**
 * One country's imports (producing partners → commodity → the country) or
 * exports (the country → commodity → consuming partners). A row whose partner
 * is the country itself is domestic production, never folded into "Other".
 */
export function buildCountryGraph({
    rows,
    country,
    view,
    formatValue,
    getGroupLabel,
    getPartnerLabel = getEntityShortLabel,
    maxNodes = DEFAULT_MAX_NODES,
    maxNodesToShrinkOther = DEFAULT_MAX_NODES_TO_SHRINK_OTHER,
    minNodeShare = DEFAULT_MIN_NODE_SHARE,
    minLabelledGroupShare = 0,
}: {
    rows: TradeRow[]
    country: string
    view: View
    formatValue: (v: number) => string
    getGroupLabel: (group: string) => string
    getPartnerLabel?: (partner: string) => string
    maxNodes?: number
    maxNodesToShrinkOther?: number
    minNodeShare?: number
    /** Groups below this share of the commodity column get no label; 0
     *  labels every group, anything above 1 labels none */
    minLabelledGroupShare?: number
}): SankeyGraph {
    const countryLabel = getPartnerLabel(country)
    // "the United States", and "The United States" when it opens the sentence;
    // decided on the full name, since the article list knows no short names
    const needsArticle = articulateEntity(country) !== country
    const countryInSentence = needsArticle
        ? `the ${countryLabel}`
        : countryLabel
    const countryAtStart = needsArticle ? `The ${countryLabel}` : countryLabel
    const headings = match(view)
        .returnType<SankeyGraph["headings"]>()
        .with("consumption", () => [
            "Producing countries",
            "Commodity",
            countryLabel,
        ])
        .with("production", () => [
            countryLabel,
            "Commodity",
            "Consuming countries",
        ])
        .exhaustive()
    const headingSentence = match(view)
        .returnType<SankeyGraph["headingSentence"]>()
        .with("consumption", () => [
            [emphasis("These countries"), plain(" cleared forest to produce")],
            [emphasis("commodities")],
            [plain("that were consumed in "), emphasis(countryInSentence)],
        ])
        .with("production", () => [
            [emphasis(countryAtStart), plain(" cleared forest to produce")],
            [emphasis("commodities")],
            [plain("that were "), emphasis("consumed in")],
        ])
        .exhaustive()

    const usableRows = cleanRows(rows)
    const partners: ColumnInput = {
        kind: "partners",
        rows: usableRows,
        domesticCountry: country,
    }

    return buildThreeColumnGraph({
        left: view === "consumption" ? partners : { kind: "focus" },
        right: view === "consumption" ? { kind: "focus" } : partners,
        headings,
        headingSentence,
        total: sumRows(usableRows),
        formatValue,
        getGroupLabel,
        getPartnerLabel,
        limits: {
            maxNodes,
            maxNodesToShrinkOther,
            minNodeShare,
            minLabelledGroupShare,
        },
    })
}
