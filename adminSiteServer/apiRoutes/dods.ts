import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import * as db from "../../db/db.js"
import * as dodDb from "../../db/model/Dod.js"
import { Request } from "../authentication.js"
import e from "express"
import {
    DbInsertDodLink,
    DodLinksTableName,
    DodsTableName,
} from "@ourworldindata/types"
import { extractLinksFromMarkdown, Url } from "@ourworldindata/utils"
import { getLinkType } from "@ourworldindata/components"

async function updateLinksFromInsertedDod(
    trx: db.KnexReadWriteTransaction,
    id: number
): Promise<void> {
    const dod = await trx(DodsTableName).select("*").where({ id }).first()
    if (!dod) {
        throw new Error(`Can't track dod links - dod with id ${id} not found`)
    }
    // Remove existing links
    await trx(DodLinksTableName).delete().where({ sourceId: id })

    // Insert new links
    const links = extractLinksFromMarkdown(dod.content)
    for (const link of links) {
        const [text] = link
        const url = Url.fromURL(link[1])
        const linkType = getLinkType(url.fullUrl)
        const dodLink: DbInsertDodLink = {
            sourceId: dod.id,
            target: url.fullUrl,
            queryString: url.queryStr,
            hash: url.hash,
            text,
            linkType,
            componentType: "dod",
        }
        await trx(DodLinksTableName).insert(dodLink)
    }
}

export async function getDods(
    _: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    try {
        const dods = await dodDb.getDods(trx)
        res.set("Cache-Control", "no-store")
        return { dods }
    } catch (error) {
        console.error("Error fetching dods", error)
        return {
            error: { message: String(error) },
        }
    }
}

/**
 * The same as the mockSiteRouter "dods.json" endpoint, but accessible from prod/staging admin clients
 * grep "shouldFetchFromAdminApi" for more information
 */
export async function getParsedDods(
    _: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    try {
        const dods = await dodDb.getParsedDodsDictionary(trx)
        res.set("Cache-Control", "no-store")
        return dods
    } catch (error) {
        console.error("Error fetching parsed dods", error)
        return {
            error: { message: String(error) },
        }
    }
}

export async function getDodsUsage(
    _: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    try {
        const usage = await dodDb.getDodsUsage(trx)
        res.set("Cache-Control", "no-store")
        return usage
    } catch (error) {
        console.error("Error fetching dods usage", error)
        return {
            error: { message: String(error) },
        }
    }
}

export async function updateDod(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = Number(req.params.id)
    const { content } = req.body

    try {
        if (!id || !content) {
            return {
                error: { message: "Missing id or content" },
            }
        }

        await trx(DodsTableName)
            .update({
                content,
                updatedAt: new Date(),
                lastUpdatedUserId: res.locals.user.id,
            })
            .where({ id })

        const dod = await trx(DodsTableName).first().where({ id })

        await updateLinksFromInsertedDod(trx, id)
        await triggerStaticBuild(res.locals.user, `Dod ${id} updated`)

        return { success: true, dod }
    } catch (error) {
        console.error("Error updating dod", error)
        return {
            error: { message: String(error) },
        }
    }
}

export async function deleteDod(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { id } = req.params

    try {
        if (!id) {
            return {
                error: { message: "Missing id" },
            }
        }

        // dod links are deleted automatically by ON DELETE CASCADE
        await trx(DodsTableName).delete().where({ id })
        await triggerStaticBuild(res.locals.user, `Dod ${id} deleted`)

        return { success: true }
    } catch (error) {
        console.error("Error deleting dod", error)
        return {
            error: { message: String(error) },
        }
    }
}

export async function createDod(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { content, name } = req.body

    try {
        if (!content) {
            return {
                error: { message: "Missing content" },
            }
        }
        if (!name) {
            return {
                error: { message: "Missing name" },
            }
        }

        const result = await trx(DodsTableName).insert({
            name,
            content,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastUpdatedUserId: res.locals.user.id,
        })

        const id = result[0]
        await updateLinksFromInsertedDod(trx, id)
        await triggerStaticBuild(res.locals.user, `Dod ${name} created`)

        return { success: true, id }
    } catch (error) {
        console.error("Error creating dod", error)
        return {
            error: { message: String(error) },
        }
    }
}
