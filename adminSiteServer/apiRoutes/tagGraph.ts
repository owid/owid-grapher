import { JsonError, FlatTagGraph } from "@ourworldindata/types"
import { checkIsPlainObjectWithGuard } from "@ourworldindata/utils"
import * as db from "../../db/db.js"
import * as lodash from "lodash"
import e, { Request } from "express"

export async function handleGetFlatTagGraph(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const flatTagGraph = await db.getFlatTagGraph(trx)
    return flatTagGraph
}

export async function handlePostTagGraph(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const tagGraph = req.body?.tagGraph as unknown
    if (!tagGraph) {
        throw new JsonError("No tagGraph provided", 400)
    }

    function validateFlatTagGraph(
        tagGraph: Record<any, any>
    ): tagGraph is FlatTagGraph {
        if (lodash.isObject(tagGraph)) {
            for (const [key, value] of Object.entries(tagGraph)) {
                if (!lodash.isString(key) && isNaN(Number(key))) {
                    return false
                }
                if (!lodash.isArray(value)) {
                    return false
                }
                for (const tag of value) {
                    if (
                        !(
                            checkIsPlainObjectWithGuard(tag) &&
                            lodash.isNumber(tag.weight) &&
                            lodash.isNumber(tag.parentId) &&
                            lodash.isNumber(tag.childId)
                        )
                    ) {
                        return false
                    }
                }
            }
        }

        return true
    }

    const isValid = validateFlatTagGraph(tagGraph)
    if (!isValid) {
        throw new JsonError("Invalid tag graph provided", 400)
    }
    await db.updateTagGraph(trx, tagGraph)
    res.send({ success: true })
}
