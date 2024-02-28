import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm"
import {
    DbEnrichedSource,
    DbRawSource,
    SourcesTableName,
    parseSourcesRow,
} from "@ourworldindata/types"
import { KnexReadonlyTransaction } from "../db.js"

@Entity("sources")
export class Source extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() datasetId!: number
    @Column() name!: string
    @Column({ default: "{}", type: "json" }) description!: any
}

export async function getSourceById(
    knex: KnexReadonlyTransaction,
    sourceId: number
): Promise<DbEnrichedSource | undefined> {
    const rawSource: DbRawSource | undefined = await knex<DbRawSource>(
        SourcesTableName
    )
        .where({ id: sourceId })
        .first()
    if (!rawSource) return undefined
    const source = parseSourcesRow({
        ...rawSource,
        // for backwards compatibility
        description: rawSource.description ?? "{}",
    })
    return source
}

export async function getSourcesForDataset(
    knex: KnexReadonlyTransaction,
    datasetId: number
): Promise<DbEnrichedSource[]> {
    const rawSources: DbRawSource[] = await knex<DbRawSource>(
        SourcesTableName
    ).where({
        datasetId,
    })
    const sources = rawSources.map((rawSource) =>
        parseSourcesRow({
            ...rawSource,
            // for backwards compatibility
            description: rawSource.description ?? "{}",
        })
    )
    return sources
}

export function sourceToDatapackage(
    source: DbEnrichedSource
): Record<string, any> {
    return Object.assign({}, { name: source.name }, source.description)
}
