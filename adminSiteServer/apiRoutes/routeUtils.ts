import * as _ from "lodash-es"

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
