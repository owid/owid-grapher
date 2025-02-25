import { triggerStaticBuild } from "./routeUtils.js"
import * as db from "../../db/db.js"

import { Request } from "../authentication.js"
import e from "express"
import { DodsTableName } from "@ourworldindata/types"

export async function getDods(
    _: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    try {
        const dods = await db.getDods(trx)
        res.set("Cache-Control", "no-store")
        res.send({ dods })
    } catch (error) {
        console.error("Error fetching dods", error)
        res.status(500).json({
            error: { message: String(error), status: 500 },
        })
    }
}

export async function updateDod(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { id } = req.params
    const { content } = req.body

    try {
        if (!id || !content) {
            return res.status(400).json({
                error: { message: "Missing id or content", status: 400 },
            })
        }

        const dod = await trx(DodsTableName)
            .update({
                content,
                updatedAt: new Date(),
                lastUpdatedUserId: res.locals.user.id,
            })
            .where({ id })

        res.send({ dod })
    } catch (error) {
        console.error("Error updating dod", error)
        res.status(500).json({
            error: { message: String(error), status: 500 },
        })
    }

    await triggerStaticBuild(res.locals.user, `Dod ${id} updated`)
    return { success: true }
}
