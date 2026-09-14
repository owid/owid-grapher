import { afterAll, afterEach, describe, expect, it, vi } from "vitest"
import * as Sentry from "@sentry/node"
import {
    runSentryScript,
    sampleServerTrace,
    traceJob,
} from "./sentryTracing.js"

// Keep the SDK implementation, but make exports spyable for shutdown tests.
vi.mock(import("@sentry/node"), async (importOriginal) => ({
    ...(await importOriginal()),
}))

// Exercise the real SDK so we catch changes to when the sampler runs and which
// attributes it receives. No DSN/transport: these tests never send telemetry.
Sentry.init({
    dsn: "",
    integrations: [],
    tracesSampler: (context) =>
        sampleServerTrace({ ...context, inheritOrSampleWith: () => 1 }),
})
afterAll(async () => {
    await Sentry.close()
})

describe("server tracing", () => {
    it("does not record standalone SQL transactions", () => {
        for (const op of ["db", "db.sql.query"]) {
            Sentry.startNewTrace(() =>
                Sentry.startSpan({ name: "COMMIT;", op }, (span) => {
                    expect(span.isRecording()).toBe(false)
                })
            )
        }
    })

    it("retains database children of sampled jobs", async () => {
        await traceJob("test-job", async () => {
            const job = Sentry.getActiveSpan()!
            expect(job.isRecording()).toBe(true)
            Sentry.startSpan({ name: "SELECT 1", op: "db" }, (sql) => {
                expect(sql.isRecording()).toBe(true)
                expect(Sentry.spanToJSON(sql).parent_span_id).toBe(
                    job.spanContext().spanId
                )
            })
        })
    })

    it("samples jobs independently and restores the calling context", async () => {
        await Sentry.startSpan(
            { name: "request", op: "http.server" },
            async (parent) => {
                const result = await traceJob("test-job", async () => {
                    expect(
                        Sentry.getActiveSpan()!.spanContext().traceId
                    ).not.toBe(parent.spanContext().traceId)
                    return 42
                })
                expect(result).toBe(42)
                expect(Sentry.getActiveSpan()).toBe(parent)
            }
        )
    })

    it("keeps concurrently baked pages in separate traces with their own attributes", async () => {
        const spans = await Promise.all(
            ["first-page", "second-page"].map((slug) =>
                traceJob(
                    "bake-grapher-page",
                    async () => {
                        const span = Sentry.getActiveSpan()!
                        await Promise.resolve()
                        expect(Sentry.getActiveSpan()).toBe(span)
                        expect(Sentry.spanToJSON(span).data["page.slug"]).toBe(
                            slug
                        )
                        return span
                    },
                    { "page.slug": slug }
                )
            )
        )
        expect(spans[0].spanContext().traceId).not.toBe(
            spans[1].spanContext().traceId
        )
        for (const span of spans) expect(span.isRecording()).toBe(false)
        expect(Sentry.getActiveSpan()).toBeUndefined()
    })

    it("preserves job errors and closes their spans", async () => {
        let job: Sentry.Span | undefined
        const error = new Error("job failed")
        await expect(
            traceJob("failed-job", async () => {
                job = Sentry.getActiveSpan()
                throw error
            })
        ).rejects.toBe(error)
        expect(job!.isRecording()).toBe(false)
        expect(Sentry.spanToJSON(job!).status).toBe("internal_error")
    })

    it("keeps the 10% fallback and honors incoming sampling decisions", () => {
        for (const inherited of [undefined, 0, 1]) {
            expect(
                sampleServerTrace({
                    name: "request",
                    attributes: { "sentry.op": "http.server" },
                    inheritOrSampleWith: (fallback) => inherited ?? fallback,
                })
            ).toBe(inherited ?? 0.1)
        }
    })
})

describe("script shutdown", () => {
    afterEach(() => vi.restoreAllMocks())

    it.each([
        { fail: false, trace: true },
        { fail: true, trace: true },
        { fail: false, trace: false },
        { fail: true, trace: false },
    ])(
        "drains telemetry before exiting (failure: $fail, trace: $trace)",
        async ({ fail, trace }) => {
            const error = new Error("script failed")
            const exited = new Error("process exited")
            let job: Sentry.Span | undefined
            let drained = false
            const capture = vi
                .spyOn(Sentry, "captureException")
                .mockReturnValue("event-id")
            vi.spyOn(console, "error").mockImplementation(() => undefined)
            vi.spyOn(Sentry, "close").mockImplementation(async () => {
                if (trace) expect(job!.isRecording()).toBe(false)
                else expect(job).toBeUndefined()
                await Promise.resolve()
                drained = true
                return true
            })
            const exit = vi.spyOn(process, "exit").mockImplementation(() => {
                expect(drained).toBe(true)
                throw exited
            })
            await expect(
                runSentryScript(
                    "test-script",
                    async () => {
                        job = Sentry.getActiveSpan()
                        if (trace) expect(job?.isRecording()).toBe(true)
                        else expect(job).toBeUndefined()
                        if (fail) throw error
                    },
                    { trace }
                )
            ).rejects.toBe(exited)
            expect(exit).toHaveBeenCalledWith(fail ? 1 : 0)
            if (fail) expect(capture).toHaveBeenCalledWith(error)
            else expect(capture).not.toHaveBeenCalled()
        }
    )
})
