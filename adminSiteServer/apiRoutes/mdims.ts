import { JsonError, MultiDimDataPageConfigRaw } from "@ourworldindata/types"
import { isMultiDimDataPagePublished } from "../../db/model/MultiDimDataPage.js"
import { isValidSlug } from "../../serverUtils/serverUtil.js"
import {
    FEATURE_FLAGS,
    FeatureFlagFeature,
} from "../../settings/clientSettings.js"
import { apiRouter } from "../apiRouter.js"
import { putRouteWithRWTransaction } from "../functionalRouterHelpers.js"
import { createMultiDimConfig } from "../multiDim.js"
import { triggerStaticBuild } from "./routeUtils.js"

putRouteWithRWTransaction(
    apiRouter,
    "/multi-dim/:slug",
    async (req, res, trx) => {
        const { slug } = req.params
        if (!isValidSlug(slug)) {
            throw new JsonError(`Invalid multi-dim slug ${slug}`)
        }
        const rawConfig = req.body as MultiDimDataPageConfigRaw
        const id = await createMultiDimConfig(trx, slug, rawConfig)
        if (
            FEATURE_FLAGS.has(FeatureFlagFeature.MultiDimDataPage) &&
            (await isMultiDimDataPagePublished(trx, slug))
        ) {
            await triggerStaticBuild(
                res.locals.user,
                `Publishing multidimensional chart ${slug}`
            )
        }
        return { success: true, id }
    }
)
