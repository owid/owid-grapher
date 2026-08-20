import {
    CommentTargetType,
    CommentViewState,
    GrapherInterface,
} from "@ourworldindata/types"
import { dimensionsToViewId } from "@ourworldindata/utils"

import * as db from "../db/db.js"

/**
 * What the comment is about, as the database currently holds it.
 *
 * A comment records which field on which chart or view it hangs off, but not the
 * text it was left on - that is the whole point, since the text is what changes.
 * So an agent asked to act on one has to read the current values itself, and
 * this is that read: the chart's own title, subtitle and note, and the indicator
 * metadata the data page renders around it.
 */
export interface CommentTargetMetadata {
    /** The chart's authored text, as configured rather than as displayed */
    chart: {
        title?: string
        subtitle?: string
        note?: string
    }
    /**
     * The indicator behind the chart, or behind this view of a multi-dim. Only
     * the fields a data page shows, since those are the ones commentable.
     */
    indicator?: {
        catalogPath: string | null
        name: string | null
        titlePublic: string | null
        titleVariant: string | null
        unit: string | null
        shortUnit: string | null
        descriptionShort: string | null
        descriptionKey: string[] | null
        descriptionFromProducer: string | null
        descriptionProcessing: string | null
    }
    /** Set when the view a comment was left on no longer resolves to a chart */
    unresolved?: string
}

interface VariableMetadataRow {
    catalogPath: string | null
    name: string | null
    titlePublic: string | null
    titleVariant: string | null
    unit: string | null
    shortUnit: string | null
    descriptionShort: string | null
    descriptionFromProducer: string | null
    descriptionProcessing: string | null
    /** Stored as a JSON array of strings */
    descriptionKey: string | null
}

const VARIABLE_METADATA_COLUMNS = `
    catalogPath, name, titlePublic, titleVariant, unit, shortUnit,
    descriptionShort, descriptionKey, descriptionFromProducer,
    descriptionProcessing
`

function chartText(config: GrapherInterface | undefined): {
    title?: string
    subtitle?: string
    note?: string
} {
    if (!config) return {}
    return {
        title: config.title,
        subtitle: config.subtitle,
        note: config.note,
    }
}

function indicatorFrom(
    row: VariableMetadataRow | undefined
): CommentTargetMetadata["indicator"] {
    if (!row) return undefined
    let descriptionKey: string[] | null = null
    try {
        descriptionKey = row.descriptionKey
            ? (JSON.parse(row.descriptionKey) as string[])
            : null
    } catch {
        // Malformed JSON in the column shouldn't cost us the rest of the
        // metadata; the agent simply doesn't see this field.
        descriptionKey = null
    }
    return { ...row, descriptionKey }
}

async function chartMetadata(
    trx: db.KnexReadonlyTransaction,
    chartId: number
): Promise<CommentTargetMetadata> {
    const config = await db.knexRawFirst<{ full: string }>(
        trx,
        `-- sql
        SELECT cc.full
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE c.id = ?
        `,
        [chartId]
    )
    // The first dimension's indicator: a chart can draw several, and the
    // metadata a data page renders is the first one's.
    const variable = await db.knexRawFirst<VariableMetadataRow>(
        trx,
        `-- sql
        SELECT ${VARIABLE_METADATA_COLUMNS}
        FROM chart_dimensions cd
        JOIN variables v ON v.id = cd.variableId
        WHERE cd.chartId = ?
        ORDER BY cd.order
        LIMIT 1
        `,
        [chartId]
    )
    return {
        chart: chartText(
            config ? (JSON.parse(config.full) as GrapherInterface) : undefined
        ),
        indicator: indicatorFrom(variable),
    }
}

async function multiDimMetadata(
    trx: db.KnexReadonlyTransaction,
    multiDimId: number,
    viewState: CommentViewState | null
): Promise<CommentTargetMetadata> {
    if (!viewState) {
        return {
            chart: {},
            unresolved:
                "This comment records no view, so there is no single chart to read.",
        }
    }
    // The same identifier the multi-dim itself keys its views by, built from the
    // dimension choices the comment stored.
    const viewId = dimensionsToViewId(viewState)
    const row = await db.knexRawFirst<{ full: string; variableId: number }>(
        trx,
        `-- sql
        SELECT cc.full, mxcc.variableId
        FROM multi_dim_x_chart_configs mxcc
        JOIN chart_configs cc ON cc.id = mxcc.chartConfigId
        WHERE mxcc.multiDimId = ? AND mxcc.viewId = ?
        `,
        [multiDimId, viewId]
    )
    if (!row) {
        // The view was renamed or removed since the comment was left. Saying so
        // is better than answering about a different view.
        return {
            chart: {},
            unresolved: `No view "${viewId}" exists on this multi-dim any more.`,
        }
    }
    const variable = await db.knexRawFirst<VariableMetadataRow>(
        trx,
        `SELECT ${VARIABLE_METADATA_COLUMNS} FROM variables WHERE id = ?`,
        [row.variableId]
    )
    return {
        chart: chartText(JSON.parse(row.full) as GrapherInterface),
        indicator: indicatorFrom(variable),
    }
}

/** Reads the current state of what a comment is attached to */
export async function readCommentTargetMetadata(
    trx: db.KnexReadonlyTransaction,
    {
        targetType,
        targetId,
        viewState,
    }: {
        targetType: CommentTargetType
        targetId: number
        viewState: CommentViewState | null
    }
): Promise<CommentTargetMetadata> {
    return targetType === CommentTargetType.Chart
        ? await chartMetadata(trx, targetId)
        : await multiDimMetadata(trx, targetId, viewState)
}
