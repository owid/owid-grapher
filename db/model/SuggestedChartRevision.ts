import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm"

import {
    GrapherInterface,
    SuggestedChartRevisionStatus,
    SuggestedChartRevisionsRowEnriched,
    SuggestedChartRevisionsRowRaw,
    SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched,
    SuggestedChartRevisionsRowWithUsersAndExistingConfigRaw,
    parseChartConfig,
    parseNullableChartConfig,
    parseSuggestedChartRevisionsRowWithUsersAndExistingConfig,
} from "@ourworldindata/utils"
import * as db from "../db.js"
import { Knex } from "knex"

@Entity("suggested_chart_revisions")
export class SuggestedChartRevisionClass extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() chartId!: number
    @Column({ type: "json" }) suggestedConfig: any
    @Column({ type: "json" }) originalConfig: any
    @Column() createdBy!: number
    @Column() updatedBy!: number

    @Column({
        type: "enum",
        enum: SuggestedChartRevisionStatus,
        default: SuggestedChartRevisionStatus.pending,
    })
    status!: SuggestedChartRevisionStatus

    @Column({ default: "" }) suggestedReason!: string
    @Column({ default: "" }) changesInDataSummary!: string
    @Column({ default: "" }) decisionReason!: string
    @Column() createdAt!: Date
    @Column() updatedAt!: Date

    canApprove?: boolean
    canReject?: boolean
    canFlag?: boolean
    canPending?: boolean

    @Column({ type: "json" }) experimental?: any
}

export function isValidStatus(
    status: any
): status is SuggestedChartRevisionStatus {
    return Object.values(SuggestedChartRevisionStatus).includes(status)
}

export function checkCanApprove(
    suggestedChartRevision: Pick<
        SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched,
        "status" | "originalConfig" | "existingConfig"
    >
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
        ].includes(status) &&
        originalVersionExists &&
        existingVersionExists &&
        originalVersion === existingVersion
    ) {
        return true
    }
    return false
}

export function checkCanReject(
    suggestedChartRevision: Pick<
        SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched,
        "status" | "suggestedConfig" | "existingConfig"
    >
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
        ].includes(status)
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
    suggestedChartRevision: Pick<
        SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched,
        "status"
    >
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
        ].includes(status)
    ) {
        return true
    }
    return false
}

export function checkCanPending(
    _suggestedChartRevision: Pick<
        SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched,
        "status"
    >
): boolean {
    // note: a suggestion cannot be altered to pending from another status
    return false
}

export async function getAllSuggestedChartRevisionsWithStatus(
    knex: Knex<any, any[]>,
    limit: number,
    offset: number,
    orderBy: string,
    sortOrder: string,
    status: SuggestedChartRevisionStatus | null
): Promise<SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched[]> {
    const rawRows = await knex.raw(
        `-- sql
            SELECT scr.id,
                scr.chartId,
                scr.updatedAt,
                scr.createdAt,
                scr.suggestedReason,
                scr.decisionReason,
                scr.status,
                scr.suggestedConfig,
                scr.originalConfig,
                scr.changesInDataSummary,
                scr.experimental,
                scr.createdBy,
                scr.updatedBy,
                createdByUser.fullName as createdByFullName,
                updatedByUser.fullName as updatedByFullName,
                c.config as existingConfig,
                c.updatedAt as chartUpdatedAt,
                c.createdAt as chartCreatedAt
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
    return rawRows.map(
        parseSuggestedChartRevisionsRowWithUsersAndExistingConfig
    )
}
export async function getSuggestedChartRevisionsById(
    knex: Knex<any, any[]>,
    id: number
): Promise<
    SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched | undefined
> {
    const suggestedChartRevision: SuggestedChartRevisionsRowWithUsersAndExistingConfigRaw[] =
        await knex.raw(
            `-- sql
            SELECT scr.id,
                scr.chartId,
                scr.updatedAt,
                scr.createdAt,
                scr.suggestedReason, scr.decisionReason,
                scr.status,
                scr.suggestedConfig, scr.changesInDataSummary,
                scr.originalConfig,
                scr.createdBy,
                scr.updatedBy,
                createdByUser.fullName as createdByFullName,
                updatedByUser.fullName as updatedByFullName,
                c.config as existingConfig,
                c.updatedAt as chartUpdatedAt,
                c.createdAt as chartCreatedAt
            FROM suggested_chart_revisions as scr
            LEFT JOIN charts c on c.id = scr.chartId
            LEFT JOIN users createdByUser on createdByUser.id = scr.createdBy
            LEFT JOIN users updatedByUser on updatedByUser.id = scr.updatedBy
            WHERE scr.id = ?
        `,
            [id]
        )
    if (suggestedChartRevision.length === 0) return undefined
    return parseSuggestedChartRevisionsRowWithUsersAndExistingConfig(
        suggestedChartRevision[0]
    )
}

export async function getReducedSuggestedChartRevisionById(
    knex: Knex<any, any[]>,
    id: number
): Promise<
    | Pick<
          SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched,
          "id" | "chartId" | "suggestedConfig" | "originalConfig" | "status"
      >
    | undefined
> {
    const rowRaw: Pick<
        SuggestedChartRevisionsRowWithUsersAndExistingConfigRaw,
        "id" | "chartId" | "suggestedConfig" | "originalConfig" | "status"
    >[] = await knex.raw(
        `SELECT id, chartId, suggestedConfig, originalConfig, status FROM suggested_chart_revisions WHERE id=?`,
        [id]
    )
    if (rowRaw.length === 0) return undefined
    const rowEnriched: Pick<
        SuggestedChartRevisionsRowWithUsersAndExistingConfigEnriched,
        "id" | "chartId" | "suggestedConfig" | "originalConfig" | "status"
    > = {
        ...rowRaw[0],
        suggestedConfig: parseChartConfig(rowRaw[0].suggestedConfig),
        originalConfig: parseChartConfig(rowRaw[0].originalConfig),
    }
    return rowEnriched
}

export async function getNumSuggestedChartRevisionsWithStatus(
    knex: Knex<any, any[]>,
    status: string | null
): Promise<number> {
    const numTotalRows = (
        await knex.raw(
            `
                SELECT COUNT(*) as count
                FROM suggested_chart_revisions
                ${status ? "WHERE status = ?" : ""}
            `,
            status ? [status] : []
        )
    )[0].count
    return numTotalRows ? parseInt(numTotalRows) : numTotalRows
}

export async function getConfigFromChartsOrChartRevisionsPrioritized(
    knex: Knex<any, any[]>,
    whereCond1: string,
    whereCond2: string
): Promise<
    {
        id: number
        config: GrapherInterface
        priority: number
    }[]
> {
    const rawRows: { id: number; config: string; priority: number }[] =
        await knex.raw(
            `
                SELECT id, config, 1 as priority
                FROM charts
                WHERE ${whereCond1}

                UNION

                SELECT chartId as id, config, 2 as priority
                FROM chart_revisions
                WHERE ${whereCond2}

                ORDER BY priority
                `
        )

    const rows: {
        id: number
        config: GrapherInterface
        priority: number
    }[] = rawRows.map((row) => ({
        ...row,
        config: parseChartConfig(row.config),
    }))

    return rows
}
