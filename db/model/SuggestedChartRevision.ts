import {
    DbEnrichedSuggestedChartRevision,
    DbRawSuggestedChartRevision,
    GrapherInterface,
    SuggestedChartRevisionStatus,
} from "@ourworldindata/utils"
import { KnexReadonlyTransaction, knexRaw, knexRawFirst } from "../db.js"

export function isValidStatus(status: SuggestedChartRevisionStatus): boolean {
    return Object.values(SuggestedChartRevisionStatus).includes(status)
}

type DbRawQuerySuggestedChartRevisions = Pick<
    DbRawSuggestedChartRevision,
    | "id"
    | "chartId"
    | "updatedAt"
    | "createdAt"
    | "suggestedReason"
    | "decisionReason"
    | "status"
    | "suggestedConfig"
    | "originalConfig"
    | "changesInDataSummary"
    | "experimental"
> & {
    createdById: number
    updatedById: number
    createdByFullName: string
    updatedByFullName: string
    existingConfig: string
    chartUpdatedAt: Date
    chartCreatedAt: Date
}

type DbSemiEnrichedQuerySuggestedChartRevisions = Pick<
    DbEnrichedSuggestedChartRevision,
    | "id"
    | "chartId"
    | "updatedAt"
    | "createdAt"
    | "suggestedReason"
    | "decisionReason"
    | "status"
    | "suggestedConfig"
    | "originalConfig"
    | "changesInDataSummary"
    | "experimental"
> & {
    createdById: number
    updatedById: number
    createdByFullName: string
    updatedByFullName: string
    existingConfig: GrapherInterface
    chartUpdatedAt: Date
    chartCreatedAt: Date
}

type DbEnrichedQuerySuggestedChartRevisions =
    DbSemiEnrichedQuerySuggestedChartRevisions & {
        canApprove: boolean
        canReject: boolean
        canFlag: boolean
        canPending: boolean
    }

function parseQuerySuggestedChartRevision(
    row: DbRawQuerySuggestedChartRevisions
): DbEnrichedQuerySuggestedChartRevisions {
    const suggestedConfig = JSON.parse(row.suggestedConfig)
    const existingConfig = JSON.parse(row.existingConfig)
    const originalConfig = JSON.parse(row.originalConfig)
    const experimental = row.experimental ? JSON.parse(row.experimental) : null
    const semiEnriched = {
        ...row,
        suggestedConfig,
        existingConfig,
        originalConfig,
        experimental,
    }
    const canApprove = checkCanApprove(semiEnriched)
    const canReject = checkCanReject(semiEnriched)
    const canFlag = checkCanFlag(semiEnriched)
    const canPending = checkCanPending(semiEnriched)
    return {
        ...semiEnriched,
        canApprove,
        canReject,
        canFlag,
        canPending,
    }
}

const selectFields = `scr.id, scr.chartId, scr.updatedAt, scr.createdAt,
                scr.suggestedReason, scr.decisionReason, scr.status,
                scr.suggestedConfig, scr.originalConfig, scr.changesInDataSummary,
                scr.experimental,
                createdByUser.id as createdById,
                updatedByUser.id as updatedById,
                createdByUser.fullName as createdByFullName,
                updatedByUser.fullName as updatedByFullName,
                c.config as existingConfig, c.updatedAt as chartUpdatedAt,
                c.createdAt as chartCreatedAt
`

export async function getQueryEnrichedSuggestedChartRevisions(
    trx: KnexReadonlyTransaction,
    orderBy: string,
    sortOrder: string,
    status: string | null,
    limit: number,
    offset: number
): Promise<DbEnrichedQuerySuggestedChartRevisions[]> {
    const rawSuggestedChartRevisions =
        await knexRaw<DbRawQuerySuggestedChartRevisions>(
            trx,
            `-- sql
            SELECT ${selectFields}
            FROM suggested_chart_revisions as scr
            LEFT JOIN charts c on c.id = scr.chartId
            LEFT JOIN users createdByUser on createdByUser.id = scr.createdBy
            LEFT JOIN users updatedByUser on updatedByUser.id = scr.updatedBy
            ${status ? "WHERE scr.status = ?" : ""}
            ORDER BY ${orderBy} ${sortOrder}
            LIMIT ? OFFSET ?
        `,
            status ? [status, limit, offset] : [limit, offset]
        )

    const enrichedSuggestedChartRevisions = rawSuggestedChartRevisions.map(
        parseQuerySuggestedChartRevision
    )
    return enrichedSuggestedChartRevisions
}

export async function getQueryEnrichedSuggestedChartRevision(
    trx: KnexReadonlyTransaction,
    id: number
): Promise<DbEnrichedQuerySuggestedChartRevisions | null> {
    const rawSuggestedChartRevisions =
        await knexRawFirst<DbRawQuerySuggestedChartRevisions>(
            trx,
            `-- sql
            SELECT ${selectFields}
            FROM suggested_chart_revisions as scr
            LEFT JOIN charts c on c.id = scr.chartId
            LEFT JOIN users createdByUser on createdByUser.id = scr.createdBy
            LEFT JOIN users updatedByUser on updatedByUser.id = scr.updatedBy
            WHERE scr.id = ?
        `,
            [id]
        )

    if (!rawSuggestedChartRevisions) return null

    const enrichedSuggestedChartRevisions = parseQuerySuggestedChartRevision(
        rawSuggestedChartRevisions
    )
    return enrichedSuggestedChartRevisions
}

export function checkCanApprove(
    suggestedChartRevision: DbSemiEnrichedQuerySuggestedChartRevisions
): boolean {
    // note: a suggestion can be approved if status == "rejected" |
    // "flagged" | "pending" AND the original config version equals
    // the existing config version (i.e. the existing chart has not
    // been changed since the suggestion was created).
    const status = suggestedChartRevision.status
    const originalVersion = suggestedChartRevision.originalConfig?.version
    const existingVersion = suggestedChartRevision.existingConfig?.version
    const originalVersionExists =
        originalVersion !== null && originalVersion !== undefined
    const existingVersionExists =
        existingVersion !== null && existingVersion !== undefined
    if (
        [
            SuggestedChartRevisionStatus.rejected,
            SuggestedChartRevisionStatus.flagged,
            SuggestedChartRevisionStatus.pending,
        ].includes(status as any) &&
        originalVersionExists &&
        existingVersionExists &&
        originalVersion === existingVersion
    ) {
        return true
    }
    return false
}

export function checkCanReject(
    suggestedChartRevision: DbSemiEnrichedQuerySuggestedChartRevisions
): boolean {
    // note: a suggestion can be rejected if: (1) status ==
    // "pending" | "flagged"; or (2) status == "approved" and the
    // suggested config version equals the existing chart version
    // (i.e. the existing chart has not changed since the suggestion
    // was approved).
    const status = suggestedChartRevision.status
    const suggestedVersion = suggestedChartRevision.suggestedConfig?.version
    const existingVersion = suggestedChartRevision.existingConfig?.version
    const suggestedVersionExists =
        suggestedVersion !== null && suggestedVersion !== undefined
    const existingVersionExists =
        existingVersion !== null && existingVersion !== undefined
    if (
        [
            SuggestedChartRevisionStatus.flagged,
            SuggestedChartRevisionStatus.pending,
        ].includes(status as any)
    ) {
        return true
    }
    if (
        status === "approved" &&
        suggestedVersionExists &&
        existingVersionExists &&
        suggestedVersion === existingVersion
    ) {
        return true
    }
    return false
}

export function checkCanFlag(
    suggestedChartRevision: DbSemiEnrichedQuerySuggestedChartRevisions
): boolean {
    // note: a suggestion can be flagged if status == "pending" or
    // if it is already flagged. Flagging a suggestion that is
    // already flagged is a hack for updating the decisionReason
    // column in the SuggestedChartRevisionApproverPage UI without
    // changing the status column.
    const status = suggestedChartRevision.status
    if (
        [
            SuggestedChartRevisionStatus.flagged,
            SuggestedChartRevisionStatus.pending,
        ].includes(status as any)
    ) {
        return true
    }
    return false
}

export function checkCanPending(
    _suggestedChartRevision: DbSemiEnrichedQuerySuggestedChartRevisions
): boolean {
    // note: a suggestion cannot be altered to pending from another status
    return false
}
