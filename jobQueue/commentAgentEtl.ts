import { execFile } from "child_process"
import { promisify } from "util"

import {
    ANTHROPIC_API_KEY,
    COMMENT_AGENT_ETL_DIR,
} from "../settings/serverSettings.js"
import {
    CommentAgentContext,
    CommentAgentResult,
} from "./commentAgentProcessor.js"

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

export function buildEtlPrompt(context: CommentAgentContext): string {
    const target =
        context.targetType === "multiDim"
            ? `multi-dimensional chart ${context.targetKey ?? context.targetId}`
            : `chart ${context.targetKey ?? context.targetId}`
    const view = context.viewState
        ? `\nView: ${Object.entries(context.viewState)
              .map(([key, value]) => `${key} = ${value}`)
              .join(", ")}`
        : ""
    const field = context.anchor
        ? `\nField commented on: ${context.anchor}`
        : "\nThe comment is on the chart as a whole, not one field."

    return `A comment was left on ${target}.${view}${field}

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
    const args = [
        "--print",
        buildEtlPrompt(context),
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
        const message =
            error instanceof Error ? error.message : String(error)
        throw new Error(`Claude in ${COMMENT_AGENT_ETL_DIR} failed: ${message}`)
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
