import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import * as z from "zod"

const RESPONSE_HEADERS: HeadersInit = {
    "Content-Type": "application/json",
}

const allowedSurveyNames = ["user-role-v1"] as const

const roleAnswerSchema = z.discriminatedUnion("experimentArm", [
    z.object({
        experimentArm: z.literal("free-form"),
        freeFormInput: z.string().min(1).max(200),
    }),
    z.object({
        experimentArm: z.literal("long-list"),
        optionId: z.string().min(1).max(200),
        optionLabel: z.string().min(1).max(200),
        optionIndex: z.number().int().nonnegative(),
        freeFormInput: z.string().trim().min(1).max(200).optional(),
    }),
    z.object({
        experimentArm: z.literal("short-list"),
        optionId: z.string().min(1).max(200),
        optionLabel: z.string().min(1).max(200),
        optionIndex: z.number().int().nonnegative(),
        freeFormInput: z.string().trim().min(1).max(200).optional(),
    }),
])

const userSurveyPayloadSchema = z.object({
    surveyName: z.enum(allowedSurveyNames),
    responseId: z.uuid(),
    feedbackAnswer: z.string().trim().min(1).max(2000),
    roleAnswer: roleAnswerSchema,
})

type UserSurveyPayload = z.infer<typeof userSurveyPayloadSchema>

function buildStorageKey(surveyName: string, responseId: string): string {
    return `responses/${surveyName}/${responseId}.json`
}

function getRequestMetadata(request: Request): Record<string, string> {
    return {
        cfIpCountry: request.headers.get("cf-ipcountry") ?? "",
        referer: request.headers.get("referer") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
    }
}

function buildRecord({
    payload,
    request,
    receivedAtIso,
}: {
    payload: UserSurveyPayload
    request: Request
    receivedAtIso: string
}): Record<string, unknown> {
    return {
        ...payload,
        receivedAt: receivedAtIso,
        requestMetadata: getRequestMetadata(request),
    }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    if (!env.USER_SURVEYS_R2) {
        return new Response(
            JSON.stringify({
                error: "Failed to store user survey response",
            }),
            {
                headers: RESPONSE_HEADERS,
                status: 500,
            }
        )
    }

    let rawPayload: unknown
    try {
        rawPayload = await request.json()
    } catch {
        return new Response(
            JSON.stringify({
                error: "Malformed JSON payload",
            }),
            {
                headers: RESPONSE_HEADERS,
                status: 400,
            }
        )
    }

    const parsedPayload = userSurveyPayloadSchema.safeParse(rawPayload)
    if (!parsedPayload.success) {
        return new Response(
            JSON.stringify({
                error: "Invalid request payload",
                details: z.prettifyError(parsedPayload.error),
            }),
            {
                headers: RESPONSE_HEADERS,
                status: 400,
            }
        )
    }

    try {
        const receivedAtIso = new Date().toISOString()
        const storageKey = buildStorageKey(
            parsedPayload.data.surveyName,
            parsedPayload.data.responseId
        )
        const record = buildRecord({
            payload: parsedPayload.data,
            request,
            receivedAtIso,
        })

        await env.USER_SURVEYS_R2.put(storageKey, JSON.stringify(record), {
            httpMetadata: {
                contentType: "application/json",
            },
        })

        return new Response(JSON.stringify({ ok: true }), {
            headers: RESPONSE_HEADERS,
            status: 200,
        })
    } catch (error) {
        Sentry.captureException(error)
        return new Response(
            JSON.stringify({
                error: "Failed to store user survey response",
            }),
            {
                headers: RESPONSE_HEADERS,
                status: 500,
            }
        )
    }
}
