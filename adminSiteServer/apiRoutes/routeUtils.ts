import * as _ from "lodash-es"
import { DbPlainUser } from "@ourworldindata/types"
import { DeployQueueServer } from "../../baker/DeployQueueServer.js"
import { BAKE_ON_CHANGE } from "../../settings/serverSettings.js"

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

/**
 * knex includes an `sql` property in its errors, which can be quite long
 * and causes the error to be truncated in Sentry. This function strips it from
 * the error object so that we can log the error without it being truncated.
 */
export function extractSqlError(error: unknown): Record<string, unknown> {
    if (!_.isObject(error))
        return {
            message: String(error),
        }

    if ("sql" in error) {
        const { code, errno, sqlState, sqlMessage } = error as any
        return { code, errno, sqlState, sqlMessage }
    }

    return error as Record<string, unknown>
}
