import { DbPlainDonor, DonorsTableName } from "@ourworldindata/types"
import * as db from "../db"

export async function getPublicDonorNames(
    knex: db.KnexReadonlyTransaction
): Promise<string[]> {
    const donors = await knex<DbPlainDonor>(DonorsTableName)
        .select("name")
        .where({ shouldPublish: true })
        .orderBy("name")
        .distinct()
    return donors.map((donor) => donor.name)
}
