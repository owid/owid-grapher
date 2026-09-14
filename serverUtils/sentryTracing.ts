import * as Sentry from "@sentry/node"

export function sampleServerTrace({
    attributes,
    inheritOrSampleWith,
}: Parameters<NonNullable<Sentry.NodeOptions["tracesSampler"]>>[0]): number {
    // The sampler runs for trace roots, not their local child spans. Unparented
    // SQL must not start a trace (and the profiler) for every BEGIN/COMMIT.
    const op = attributes?.[Sentry.SEMANTIC_ATTRIBUTE_SENTRY_OP]
    if (typeof op === "string" && (op === "db" || op.startsWith("db.")))
        return 0
    return inheritOrSampleWith(0.1)
}

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
