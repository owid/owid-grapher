import { JsonError } from "@ourworldindata/types"
import { apiRouter } from "../apiRouter.js"
import {
    postRouteWithRWTransaction,
    deleteRouteWithRWTransaction,
} from "../functionalRouterHelpers.js"

postRouteWithRWTransaction(
    apiRouter,
    "/explorer/:slug/tags",
    async (req, res, trx) => {
        const { slug } = req.params
        const { tagIds } = req.body
        const explorer = await trx.table("explorers").where({ slug }).first()
        if (!explorer)
            throw new JsonError(`No explorer found for slug ${slug}`, 404)

        await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
        for (const tagId of tagIds) {
            await trx
                .table("explorer_tags")
                .insert({ explorerSlug: slug, tagId })
        }

        return { success: true }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/explorer/:slug/tags",
    async (req, res, trx) => {
        const { slug } = req.params
        await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
        return { success: true }
    }
)
