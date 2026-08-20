import { execFile } from "child_process"
import { promisify } from "util"

import {
    ANTHROPIC_API_KEY,
    COMMENT_AGENT_ETL_DIR,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import {
    CommentAgentContext,
    CommentAgentResult,
} from "./commentAgentProcessor.js"
import {
    CommentTargetMetadata,
    readCommentTargetMetadata,
} from "./commentAgentMetadata.js"

const execFileAsync = promisify(execFile)

const MODEL = "claude-opus-5"
/**
 * Long enough to read metadata and think, short enough that a thread doesn't
 * wait on a run that has lost its way. There is no turn limit in the installed
 * CLI, so this and the read-only tool list are what bound a run.
 */
const TIMEOUT_MS = 180_000
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024

/**
 * Read-only on purpose. The checkout this runs in is the one staging's own ETL
 * processes use, so an agent that edited files would be changing state out from
 * under them. Producing a change means a checkout of its own and somewhere to
 * push it, which is the next step rather than this one.
 */
const ALLOWED_TOOLS = ["Read", "Grep", "Glob"]

const AGENT_INSTRUCTIONS = `You are answering an internal comment left by Our World in Data staff on a chart's metadata, from inside a checkout of the ETL.

You have no database access and cannot reach the network, so the chart is not something you can look up. Everything the grapher database holds about it is given to you in the prompt, including the indicator's catalog path. That path is your way into this repo: it names the step that produced the indicator, so it is what to search the DAG and the *.meta.yml files for. Don't ask for the slug or title - they are already there.

You can read the ETL to find out how the metadata is produced - which step writes it, what the YAML says, how it is derived. Use that.

You cannot change anything: this checkout is shared with running processes and you have no way to push. Never say or imply that you have made a change, edited a file, or opened a pull request. If asked for a change, say what you would change and in which file, and that you can't do it yet.

Reply as a comment in a thread: address the person, prose, 1-3 sentences unless more is genuinely needed. No headings, no bullet lists, no "Thanks for flagging". Name the file and field you mean when it helps.`

/** The comment thread, as text, since this goes to a CLI rather than an API */
function threadTranscript(context: CommentAgentContext): string {
    return context.thread
        .map((entry) => {
            const who = entry.isAgent ? "You (Claude)" : entry.author
            const marker = entry.isInvocation ? " [the comment asking you]" : ""
            return `${who}${marker}: ${entry.content}`
        })
        .join("\n\n")
}

export function buildEtlPrompt(
    context: CommentAgentContext,
    metadata: CommentTargetMetadata
): string {
    const target =
        context.targetType === "multiDim"
            ? "a multi-dimensional chart"
            : "a chart"
    const view = context.viewState
        ? `\nView: ${Object.entries(context.viewState)
              .map(([key, value]) => `${key} = ${value}`)
              .join(", ")}`
        : ""
    const field = context.anchor
        ? `\nField commented on: ${context.anchor}`
        : "\nThe comment is on the chart as a whole, not one field."

    // Everything the checkout cannot find out for itself. Without this the agent
    // has only a config UUID, which resolves to an indicator solely through the
    // grapher database - so it asks for the slug instead of answering, which is
    // exactly what it did before this was passed.
    return `A comment was left on ${target}.${view}${field}

What the grapher database holds about it (you cannot query for more):

${JSON.stringify(metadata, null, 2)}

Thread:

${threadTranscript(context)}

Answer the last comment.`
}

/**
 * Runs Claude in the ETL checkout, so it answers with the repo's own context -
 * its CLAUDE.md, its skills, its metadata conventions - rather than with
 * whatever we thought to paste into a prompt. That is the whole reason for
 * shelling out to the CLI instead of calling the API: the context comes from
 * the working directory, and it stays current as the team improves it.
 */
export async function runAgentInEtlCheckout(
    context: CommentAgentContext
): Promise<CommentAgentResult> {
    // Read first: the checkout has no way to reach the database, and the
    // indicator's catalog path is what turns a chart into a place in this repo.
    const metadata = await db.knexReadonlyTransaction((trx) =>
        readCommentTargetMetadata(trx, {
            targetType: context.targetType,
            targetId: context.targetId,
            viewState: context.viewState,
        })
    )

    const args = [
        "--print",
        buildEtlPrompt(context, metadata),
        "--output-format",
        "json",
        "--model",
        MODEL,
        "--append-system-prompt",
        AGENT_INSTRUCTIONS,
        "--allowed-tools",
        ...ALLOWED_TOOLS,
    ]

    let stdout: string
    try {
        const result = await execFileAsync("claude", args, {
            cwd: COMMENT_AGENT_ETL_DIR,
            timeout: TIMEOUT_MS,
            maxBuffer: MAX_OUTPUT_BYTES,
            env: { ...process.env, ANTHROPIC_API_KEY },
        })
        stdout = result.stdout
    } catch (error) {
        // Includes the timeout kill, a missing CLI and a non-zero exit. The
        // message reaches the thread, so it has to say which.
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
            `Claude in ${COMMENT_AGENT_ETL_DIR} failed: ${message}`,
            { cause: error }
        )
    }

    return { success: true, reply: parseCliResult(stdout) }
}

/**
 * The CLI's json output is one result object. Falls back to the raw output
 * rather than failing: a reply that reads oddly is worth more than none.
 */
export function parseCliResult(stdout: string): string {
    const trimmed = stdout.trim()
    try {
        const parsed = JSON.parse(trimmed) as {
            result?: string
            is_error?: boolean
            subtype?: string
        }
        if (parsed.is_error)
            throw new Error(
                `Claude reported an error (${parsed.subtype ?? "unknown"}): ${
                    parsed.result ?? "no detail"
                }`
            )
        const reply = parsed.result?.trim()
        if (reply) return reply
        throw new Error("Claude returned an empty result")
    } catch (error) {
        if (error instanceof SyntaxError) return trimmed
        throw error
    }
}

/** Whether an ETL checkout is configured for the agent to answer from */
export function hasEtlCheckout(): boolean {
    return COMMENT_AGENT_ETL_DIR !== ""
}
