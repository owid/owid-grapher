import { execFile } from "child_process"
import { promisify } from "util"

import {
    ADMIN_BASE_URL,
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
 * Long enough to make a small fix, push it and open a draft PR, short enough
 * that a thread doesn't wait for ever on a run that has lost its way. There is
 * no turn limit in the installed CLI, so this and the tool list are what bound
 * a run.
 */
const TIMEOUT_MS = 900_000
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024

/**
 * The file tools are scoped to the ETL checkout, and Bash to the two commands
 * the change contract needs: git (status, branch, commit, push) and uv (to run
 * the repo's own GithubApiRepo helper). The checkout is shared with staging's
 * own ETL processes, which is why the prompt insists on a clean tree before
 * editing and on leaving the original branch checked out afterwards.
 */
function allowedTools(): string[] {
    // "//" makes a permission rule's path absolute from the filesystem root
    const checkoutGlob = `//${COMMENT_AGENT_ETL_DIR.replace(/^\/+/, "").replace(/\/+$/, "")}/**`
    return [
        "Read",
        "Grep",
        "Glob",
        `Edit(${checkoutGlob})`,
        `Write(${checkoutGlob})`,
        "Bash(git:*)",
        "Bash(uv:*)",
    ]
}

const AGENT_INSTRUCTIONS = `You are answering an internal comment left by Our World in Data staff on a chart's metadata, from inside a checkout of the ETL.

You have no database access, so the chart is not something you can look up. Everything the grapher database holds about it is given to you in the prompt, including the indicator's catalog path. That path is your way into this repo: it names the step that produced the indicator, so it is what to search the DAG and the *.meta.yml files for. Don't ask for the slug or title - they are already there.

First decide what the last comment is:
- A QUESTION: something to answer or discuss. Read the ETL to find out how the metadata is produced - which step writes it, what the YAML says, how it is derived - and answer in the thread. Change nothing.
- A CHANGE REQUEST: a typo fix, a wording fix, a metadata correction - something a small edit to this repo would resolve. Make the fix and open a draft pull request, following the steps below exactly.
When it is ambiguous, treat it as a question and ask.

For a change request, work only inside this checkout, in this order:
1. Run \`git status\`. If the working tree is dirty, do NOT proceed: reply that the checkout has uncommitted changes and stop.
2. Note the currently checked-out branch (or commit) - you must leave it checked out again at the end.
3. Create and switch to a new branch named comment-agent/<comment id>-<short-slug>. NEVER commit to the branch you found checked out, and never to master.
4. Make the smallest possible edit that addresses the comment - almost always one *.meta.yml file found via the catalog path. If the change would touch more than 5 files or about 50 changed lines, or would require re-running data steps, do NOT edit: reply explaining what you found and where the fix belongs, then stop.
5. Commit as owidbot: \`git -c user.name=owidbot -c user.email=tech@ourworldindata.org commit\`, with a clear message that says what was fixed and references the comment id.
6. Push the branch to origin.
7. Open a DRAFT pull request using this repo's own GithubApiRepo helper - the Python class owidbot already uses to post build diffs; find it in this repo and call it via \`uv run python\`. Do NOT use gh: it is not installed. PR title: a concise description of the fix. PR body: the original comment quoted, the link to the comment thread given in the prompt, and a note that this PR was opened automatically by the comment agent and needs human review.
8. Check out the original branch again, so the checkout is left exactly where you found it.
9. Reply with a one-line summary of the change and the PR URL.

If anything fails midway - push rejected, helper errors - put the checkout back first (original branch checked out, no uncommitted changes left behind), then reply saying what happened.

Never say or imply that you made a change or opened a pull request unless you actually pushed the branch and the helper returned a PR URL.

Reply as a comment in a thread: address the person, prose, 1-3 sentences unless more is genuinely needed. No headings, no bullet lists, no "Thanks for flagging". Name the file and field you mean when it helps.`

/**
 * Whether the comment asks for something to be changed rather than explained -
 * decided cheaply here, before the agent runs, only to know if a "working on
 * it" acknowledgment is worth posting. The agent itself makes the real
 * question-or-change-request call with full context; a miss here costs only
 * the acknowledgment, never a wrong edit.
 */
const CHANGE_REQUEST_PATTERN =
    /\b(fix|change|update|correct|replace|remove|delete|add|rename|reword|rewrite|shorten|adjust|amend|edit|typo|capitali[sz]e|should (be|say|read)|open a (draft )?(pr|pull request))\b/i

export function looksLikeChangeRequest(instruction: string): boolean {
    return CHANGE_REQUEST_PATTERN.test(instruction)
}

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

    // The admin preview the thread lives on, for the PR body. Built here since
    // the checkout knows neither this host nor the slug.
    const threadUrl = metadata.slug
        ? `\nComment thread: ${ADMIN_BASE_URL}/admin/grapher/${metadata.slug}`
        : ""

    // Everything the checkout cannot find out for itself. Without this the agent
    // has only a config UUID, which resolves to an indicator solely through the
    // grapher database - so it asks for the slug instead of answering, which is
    // exactly what it did before this was passed.
    return `A comment was left on ${target}.${view}${field}
Comment id: ${context.commentId}${threadUrl}

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
    context: CommentAgentContext,
    notify?: (content: string) => Promise<void>
): Promise<CommentAgentResult> {
    // A change request takes minutes, and until the reply lands the thread
    // looks ignored. Say up front that the run started; questions stay silent
    // since their answer arrives quickly anyway.
    if (notify && looksLikeChangeRequest(context.instruction))
        await notify(
            "Working on it — I'll reply here with a draft PR link when done (usually a few minutes)."
        )

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
        ...allowedTools(),
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
