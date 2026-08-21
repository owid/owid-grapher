interface MysqlServerError {
    sqlState: string
    code?: string
    errno?: number
}

/**
 * mysql2 sets `sqlState` only on errors the MySQL server itself sent back, which
 * is what distinguishes them from client-side failures (ECONNREFUSED and friends
 * carry a `code` too, but no `sqlState`).
 */
function isMysqlServerError(error: unknown): error is MysqlServerError {
    return (
        typeof error === "object" &&
        error !== null &&
        typeof (error as { sqlState?: unknown }).sqlState === "string"
    )
}

/**
 * A Sentry fingerprint that groups MySQL errors by what actually went wrong.
 *
 * mysql2 raises every server-side error from one place — `Packet.asError`, deep
 * in its packet parser — and by the time the promise rejects, the app frames
 * that led there are gone. So Sentry has nothing but that one stack to group on,
 * and unrelated failures pile into a single issue: a container whose MySQL
 * account went missing, a staging branch whose code is ahead of its schema, and
 * a genuine deadlock in the production admin all land together. Whichever is
 * loudest hides the rest — and a crash-looping staging container is much louder
 * than production.
 *
 * The MySQL error code plus the route splits them into issues that each mean one
 * thing. Returns undefined for anything that isn't a MySQL server error, leaving
 * Sentry's default grouping alone.
 */
export function mysqlErrorFingerprint(error: unknown): string[] | undefined {
    if (!isMysqlServerError(error)) return undefined

    // `code` is mysql2's name for the errno, looked up in a table it bundles, so
    // it is missing for errnos newer than the mysql2 version we run.
    const label =
        error.code ??
        (error.errno !== undefined ? `errno-${error.errno}` : error.sqlState)

    // `{{ transaction }}` is substituted server-side by Sentry, and is empty for
    // errors thrown outside a request — which groups all of a process's startup
    // failures together, as intended.
    return ["mysql", label, "{{ transaction }}"]
}
