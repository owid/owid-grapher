import { DbPlainEntity, EntitiesTableName } from "@ourworldindata/types"
import * as db from "../db"

export async function mapEntityNamesToEntityIds(
    knex: db.KnexReadonlyTransaction
): Promise<Map<string, number>> {
    const entities = (await knex(EntitiesTableName).select(
        "id",
        "name"
    )) as Pick<DbPlainEntity, "id" | "name">[]
    const entityNameToIdMap = new Map<string, number>(
        entities.map((entity) => [entity.name, entity.id])
    )

    return entityNameToIdMap
}
