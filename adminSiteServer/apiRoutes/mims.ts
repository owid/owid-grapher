import { JsonError, TagsTableName, MimsTableName } from "@ourworldindata/types"
import { Request } from "express"
import * as e from "express"
import * as db from "../../db/db.js"

export async function createMim(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    _trx: db.KnexReadonlyTransaction
) {
    const { url, parentTagName, ranking, incomeGroup } = req.body

    if (!url || !parentTagName || !ranking || !incomeGroup) {
        throw new JsonError("Missing required fields", 400)
    }

    const { isValid, reason } = await db.validateChartSlug(_trx, url)

    if (!isValid) {
        throw new JsonError(`Invalid MIM URL. ${reason}`, 400)
    }

    // Get the parentTagId from the parentTagName
    const parentTag = await _trx(TagsTableName)
        .select("id")
        .where({
            name: parentTagName,
        })
        .first()

    if (!parentTag) {
        throw new JsonError(
            `No parent tag found with name '${parentTagName}'`,
            404
        )
    }
    const parentTagId = parentTag.id

    const duplicateMim = await _trx(MimsTableName)
        .where({
            url,
            parentTagId,
            incomeGroup,
        })
        .first()

    if (duplicateMim) {
        throw new JsonError(
            `MIM with URL "${url}", income group "${incomeGroup}", and parentTagName "${parentTagName}" already exists`,
            400
        )
    }

    await db.knexRaw(
        _trx,
        `INSERT INTO mims (url, parentTagId, ranking, incomeGroup)
         VALUES (?, ?, ?, ?)`,
        [url, parentTagId, ranking, incomeGroup]
    )

    return { success: true }
}

export async function rerankMims(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    _trx: db.KnexReadonlyTransaction
) {
    const mims = req.body

    if (!mims || !Array.isArray(mims)) {
        throw new JsonError("Invalid payload signature", 400)
    }

    for (const { id, ranking } of mims) {
        if (id === undefined || ranking === undefined) {
            throw new JsonError("Missing required fields", 400)
        }

        await db.knexRaw(_trx, `UPDATE mims SET ranking = ? WHERE id = ?`, [
            ranking,
            id,
        ])
    }

    return { success: true }
}

export async function deleteMim(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    _trx: db.KnexReadonlyTransaction
) {
    const { id } = req.params

    const mim = await _trx(MimsTableName).where({ id }).first()
    if (!mim) {
        throw new JsonError(`No mim found with id '${id}'`, 404)
    }

    await _trx(MimsTableName).where({ id }).delete()

    await _trx(MimsTableName)
        .where({
            parentTagId: mim.parentTagId,
            incomeGroup: mim.incomeGroup,
        })
        .andWhere("ranking", ">", mim.ranking)
        .decrement("ranking", 1)

    return { success: true }
}

export async function fetchMims(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const mims = await db.getMimsByParentTagName(trx)

    return { mims }
}
