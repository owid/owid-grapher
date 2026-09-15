import * as Sentry from "@sentry/node"

/** Each unit of batch work gets an independent sampling decision. */
export function traceJob<T>(
    name: string,
    run: () => Promise<T>,
    attributes?: Parameters<typeof Sentry.startSpan>[0]["attributes"]
): Promise<T> {
    return Sentry.startNewTrace(() =>
        Sentry.startSpan({ name, op: "job", attributes }, run)
    )
}

/** For CLI entry points only: finish spans and drain telemetry before exiting. */
export async function runSentryScript(
    name: string,
    run: () => Promise<unknown>,
    { trace = true }: { trace?: boolean } = {}
): Promise<never> {
    let exitCode = 0
    try {
        // Long-running orchestrators should trace their individual work units,
        // without keeping the profiler active for the entire script.
        if (trace) await traceJob(name, run)
        else await run()
    } catch (error) {
        console.error(`Error in ${name}:`, error)
        Sentry.captureException(error)
        exitCode = 1
    } finally {
        await Sentry.close(2000)
    }
    process.exit(exitCode)
}
