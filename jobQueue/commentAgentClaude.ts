import Anthropic from "@anthropic-ai/sdk"

import * as db from "../db/db.js"
import { ANTHROPIC_API_KEY } from "../settings/serverSettings.js"
import {
    CommentAgentContext,
    CommentAgentResult,
} from "./commentAgentProcessor.js"
import { readCommentTargetMetadata } from "./commentAgentMetadata.js"

const MODEL = "claude-opus-5"
/**
 * A reply is read in a 320px popover next to the chart, so length is a feature
 * of the medium rather than a preference. The cap is a backstop; the prompt is
 * what actually keeps replies short.
 */
const MAX_TOKENS = 1024

const SYSTEM_PROMPT = `You are Claude, replying to an internal comment left by Our World in Data staff on a chart's metadata.

Comments are left on a specific field - a chart's title, subtitle or note, or a piece of the indicator's metadata - of a specific chart or multi-dimensional view. The current values of those fields are given to you below. The comment thread is the conversation; your replies appear in it.

What you can do right now: read the metadata you are given, and answer. Say what you think is wrong, what the fix should be, or ask for the one thing you need to know.

What you cannot do yet: change anything. You have no access to the ETL, no ability to edit metadata, and no ability to open a pull request. Do not say or imply that you have made a change, opened a PR, or will do so - that is the single worst thing you can do here, because your reply arrives in a tool that will later be able to do those things. If someone asks you to make a change, say plainly that you can't yet and what you would change.

How to write: address the person directly, in prose, 1-3 sentences unless more is genuinely needed. No headings, no bullet lists, no preamble like "Thanks for flagging". Quote the exact text you are talking about when it helps. If the metadata you were given does not contain what you would need, say so rather than guessing.`

/** The field names in the comment record, spelled as a person would read them */
const FIELD_LABELS: Record<string, string> = {
    title: "chart title",
    subtitle: "chart subtitle",
    note: "chart note",
    indicatorTitle: "indicator title",
    titleVariant: "title variant",
    descriptionShort: "indicator short description",
    descriptionKey: 'indicator "what you should know" points',
    descriptionFromProducer: "description from producer",
    descriptionProcessing: "processing description",
    source: "data source / attribution",
    unit: "unit",
    unitConversionFactor: "unit conversion factor",
    dateRange: "date range",
    lastUpdated: "last updated",
    nextUpdate: "next expected update",
}

function describeTarget(context: CommentAgentContext): string {
    const what =
        context.targetType === "multiDim"
            ? "multi-dimensional chart"
            : "chart"
    const where = context.targetKey ?? `id ${context.targetId}`
    const view = context.viewState
        ? `\nView: ${Object.entries(context.viewState)
              .map(([key, value]) => `${key} = ${value}`)
              .join(", ")}`
        : ""
    const field = context.anchor
        ? `\nThe comment is on the ${
              FIELD_LABELS[context.anchor] ?? context.anchor
          } (field \`${context.anchor}\`).`
        : "\nThe comment is on the chart as a whole, not one field."
    return `Target: ${what} \`${where}\`${view}${field}`
}

/**
 * The thread as a conversation. The agent's own replies are its turns, so a
 * follow-up reads as one: it can see what it said last time, and the API's
 * alternation is what makes that unambiguous.
 */
export function threadToMessages(
    context: CommentAgentContext
): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = []
    for (const entry of context.thread) {
        const role = entry.isAgent ? "assistant" : "user"
        const text = entry.isAgent
            ? entry.content
            : `${entry.author}: ${entry.content}`
        // Consecutive comments from people are one turn: the API requires
        // alternating roles, and two colleagues talking in a row is normal.
        const last = messages.at(-1)
        if (last && last.role === role)
            last.content = `${last.content as string}\n\n${text}`
        else messages.push({ role, content: text })
    }
    // A thread always starts with the comment that was written first, but the
    // agent may have been mentioned in a reply to its own reply, which would
    // leave an assistant turn first. The API wants a user turn to answer.
    if (messages[0]?.role === "assistant")
        messages.unshift({
            role: "user",
            content: "(earlier in this thread)",
        })
    return messages
}

/**
 * Answers a comment with the real model.
 *
 * Deliberately has no tools: it reads the metadata it is asked about and
 * replies. Giving it the ability to change anything is a separate step that
 * needs somewhere to make the change - a checkout of the ETL and a token that
 * can open a pull request - and neither exists in the environment this runs in.
 */
export async function runAgentWithClaude(
    context: CommentAgentContext
): Promise<CommentAgentResult> {
    const metadata = await db.knexReadonlyTransaction((trx) =>
        readCommentTargetMetadata(trx, {
            targetType: context.targetType,
            targetId: context.targetId,
            viewState: context.viewState,
        })
    )

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
            SYSTEM_PROMPT,
            describeTarget(context),
            `Current metadata:\n${JSON.stringify(metadata, null, 2)}`,
        ].join("\n\n"),
        messages: threadToMessages(context),
    })

    const reply = response.content
        .filter(
            (block): block is Anthropic.TextBlock => block.type === "text"
        )
        .map((block) => block.text)
        .join("\n")
        .trim()

    if (!reply)
        throw new Error(
            `The model returned no text (stop reason: ${response.stop_reason})`
        )

    return { success: true, reply }
}

/** Whether a key is configured for the agent to run with */
export function isAgentConnected(): boolean {
    return ANTHROPIC_API_KEY !== ""
}
