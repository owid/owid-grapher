import * as z from "zod"
import { Env } from "../../_common/env.js"

const feedbackSchema = z.object({
    runId: z.uuid(),
    feedback: z.enum(["up", "down"]),
})

/** 👍/👎 on a "Configure with AI" answer, logged next to the run it rates */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    if (env.ENV === "production" || !env.ANTHROPIC_API_KEY)
        return Response.json({ error: "Not available" }, { status: 404 })
    let rawBody: unknown
    try {
        rawBody = await request.json()
    } catch {
        return Response.json(
            { error: "Malformed JSON payload" },
            { status: 400 }
        )
    }
    const parsed = feedbackSchema.safeParse(rawBody)
    if (!parsed.success)
        return Response.json(
            { error: "Invalid request payload" },
            { status: 400 }
        )
    console.log(
        JSON.stringify({ event: "configure-with-ai-feedback", ...parsed.data })
    )
    return Response.json({ ok: true })
}
