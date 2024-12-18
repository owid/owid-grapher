import { DbPlainUser } from "@ourworldindata/types"
import { DeployQueueServer } from "../../baker/DeployQueueServer.js"
import { BAKE_ON_CHANGE } from "../../settings/serverSettings.js"
import { References } from "../../adminSiteClient/AbstractChartEditor.js"
import { ChartViewMinimalInformation } from "../../adminSiteClient/ChartEditor.js"
import * as db from "../../db/db.js"
import {
    getWordpressPostReferencesByChartId,
    getGdocsPostReferencesByChartId,
} from "../../db/model/Post.js"

// Call this to trigger build and deployment of static charts on change
export const triggerStaticBuild = async (
    user: DbPlainUser,
    commitMessage: string
) => {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    return new DeployQueueServer().enqueueChange({
        timeISOString: new Date().toISOString(),
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage,
    })
}

export const enqueueLightningChange = async (
    user: DbPlainUser,
    commitMessage: string,
    slug: string
) => {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    return new DeployQueueServer().enqueueChange({
        timeISOString: new Date().toISOString(),
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage,
        slug,
    })
}
