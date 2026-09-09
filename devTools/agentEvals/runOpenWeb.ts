#!/usr/bin/env tsx
/**
 * Where does an agent get its numbers when nobody points it at us?
 *
 * Generic questions with no mention of Our World in Data and no URL; the agent
 * has web search and fetch and must name its source. Records every search
 * query and every domain fetched, and compares the number to our CSV value.
 *
 * Two agents: Claude Code (`claude -p`, on the developer's subscription) and
 * Gemini CLI (`gemini`, with GOOGLE_API_KEY). Both get an empty working
 * directory and no user-level skills, memory files or hooks.
 *
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runOpenWeb.ts --name open-web
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runOpenWeb.ts --agent gemini --model gemini-3.8-flash --name open-web-gemini
 */
import { spawn } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RESULTS_DIR } from "./lib/charts.js"
import { approxEqual } from "./lib/numbers.js"
import {
    CallOutcome,
    RunOptions,
    ToolCall,
    runClaude,
    servedModel,
    usageOf,
} from "./runDocQa.js"

interface OpenQuestion {
    id: string
    question: string
    /** Our value, from the chart's CSV, and the chart it comes from. */
    gold: number | string
    unit: string
    chart: string
}

const QUESTIONS: OpenQuestion[] = [
    {
        id: "zimbabwe-life-expectancy",
        question: "What was life expectancy in Zimbabwe in 2023?",
        gold: 62.7748,
        unit: "years",
        chart: "life-expectancy",
    },
    {
        id: "highest-life-expectancy",
        question: "Which country had the highest life expectancy in 2023?",
        gold: "Monaco",
        unit: "",
        chart: "life-expectancy",
    },
    {
        id: "namibia-co2-per-capita",
        question: "What were Namibia's CO2 emissions per person in 2024?",
        gold: 1.1448735,
        unit: "tonnes per person",
        chart: "co-emissions-per-capita",
    },
    {
        id: "pakistan-extreme-poverty",
        question:
            "What share of Pakistan's population lived in extreme poverty in 2024?",
        gold: 22.956307232379913,
        unit: "% (World Bank $3/day line, 2021 PPP)",
        chart: "share-of-population-in-extreme-poverty",
    },
    {
        id: "slovakia-population",
        question: "How many people lived in Slovakia in 2023?",
        gold: 5518057,
        unit: "people",
        chart: "population",
    },
]

const SYSTEM_PROMPT = `You are a research assistant answering a factual question with a number. You have web search and can fetch pages and run shell commands (curl, python3, jq and so on).

Rules:
- Find the answer on the web. Do not answer from memory alone; retrieve the value from a source you can name.
- answer_number is a plain number in a sensible unit stated in answer_text (write 5500000, not "5.5 million"; write 12.5 for 12.5%). answer_entity is a country name when the question asks which country.
- source_url is the URL of the page or file the number came from; source_name is the organisation behind it.
- answer_text is one or two sentences for the user, including the unit and the source.`

const SCHEMA = {
    type: "object",
    properties: {
        answer_number: { type: ["number", "null"] },
        answer_entity: { type: ["string", "null"] },
        answer_text: { type: "string" },
        source_url: { type: "string" },
        source_name: { type: "string" },
    },
    required: [
        "answer_number",
        "answer_entity",
        "answer_text",
        "source_url",
        "source_name",
    ],
    additionalProperties: false,
}

interface OpenAnswer {
    answer_number: number | null
    answer_entity: string | null
    answer_text: string
    source_url: string
    source_name: string
}

function domainsOf(toolCalls: ToolCall[]): {
    searches: string[]
    fetched: string[]
} {
    const searches: string[] = []
    const fetched: string[] = []
    for (const call of toolCalls) {
        let input: Record<string, unknown> = {}
        try {
            input = JSON.parse(call.input) as Record<string, unknown>
        } catch {
            continue
        }
        if (/search/i.test(call.name) && typeof input.query === "string") {
            searches.push(input.query)
            continue
        }
        for (const m of call.input.matchAll(/https?:\/\/([^/\s"'\\]+)/g))
            fetched.push(m[1])
    }
    return { searches, fetched: [...new Set(fetched)] }
}

/** Gemini CLI has no structured output; ask for a JSON block and parse the last one. */
function extractJson(text: string): OpenAnswer | undefined {
    const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(
        (m) => m[1]
    )
    const candidates = [...fenced.reverse(), text.slice(text.lastIndexOf("{"))]
    for (const c of candidates) {
        try {
            const parsed = JSON.parse(c) as Partial<OpenAnswer>
            if ("answer_text" in parsed || "answer_number" in parsed)
                return {
                    answer_number:
                        typeof parsed.answer_number === "number"
                            ? parsed.answer_number
                            : null,
                    answer_entity: parsed.answer_entity ?? null,
                    answer_text: parsed.answer_text ?? "",
                    source_url: parsed.source_url ?? "",
                    source_name: parsed.source_name ?? "",
                }
        } catch {
            // try the next candidate
        }
    }
    return undefined
}

interface GeminiEvent {
    type: string
    role?: string
    content?: unknown
    tool_name?: string
    parameters?: unknown
    output?: unknown
    stats?: Record<string, number>
    status?: string
}

function runGemini(
    question: string,
    model: string,
    timeoutMs: number
): Promise<CallOutcome> {
    // A private HOME: the CLI reads ~/.gemini/GEMINI.md as its global
    // instructions (our system prompt) and ~/.gemini/settings.json for auth,
    // and sees none of the developer's own memory files, hooks or extensions.
    const home = fs.mkdtempSync(
        path.join(os.tmpdir(), "agent-evals-gemini-home-")
    )
    fs.mkdirSync(path.join(home, ".gemini"))
    fs.writeFileSync(
        path.join(home, ".gemini", "GEMINI.md"),
        `${SYSTEM_PROMPT}\n\nWhen you have the answer, end your reply with a single JSON object in a \`\`\`json fence with exactly these keys: answer_number (number or null), answer_entity (string or null), answer_text, source_url, source_name.`
    )
    fs.writeFileSync(
        path.join(home, ".gemini", "settings.json"),
        JSON.stringify({
            security: { auth: { selectedType: "gemini-api-key" } },
        })
    )
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agent-evals-gemini-"))
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required")

    return new Promise((resolve, reject) => {
        const child = spawn(
            "gemini",
            ["-m", model, "-o", "stream-json", "--yolo", question],
            {
                cwd,
                env: { ...process.env, HOME: home, GEMINI_API_KEY: apiKey },
                stdio: ["pipe", "pipe", "pipe"],
            }
        )
        let stdout = ""
        let stderr = ""
        const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs)
        child.stdout.on("data", (d) => (stdout += d))
        child.stderr.on("data", (d) => (stderr += d))
        child.on("error", reject)
        child.on("close", (code) => {
            clearTimeout(timer)
            const toolCalls: ToolCall[] = []
            const outputs: string[] = []
            let lastAssistant = ""
            let stats: Record<string, number> = {}
            let turns = 0
            for (const line of stdout.split("\n")) {
                if (!line.trim()) continue
                let event: GeminiEvent
                try {
                    event = JSON.parse(line) as GeminiEvent
                } catch {
                    continue
                }
                if (event.type === "tool_use")
                    toolCalls.push({
                        name: event.tool_name ?? "?",
                        input: JSON.stringify(event.parameters ?? {}),
                    })
                if (event.type === "tool_result")
                    outputs.push(
                        typeof event.output === "string"
                            ? event.output
                            : JSON.stringify(
                                  event.output ?? event.content ?? ""
                              )
                    )
                // Assistant text arrives in chunks; concatenate them all.
                if (event.type === "message" && event.role === "assistant") {
                    turns++
                    lastAssistant +=
                        typeof event.content === "string"
                            ? event.content
                            : JSON.stringify(event.content)
                }
                if (event.type === "result") stats = event.stats ?? {}
            }
            fs.writeFileSync(path.join(cwd, "stream.jsonl"), stdout)
            const answer = extractJson(lastAssistant)
            if (!answer)
                return reject(
                    new Error(
                        `exit ${code}; no JSON answer in: ${lastAssistant.slice(-300)} | raw stream: ${cwd}/stream.jsonl | stderr: ${stderr.slice(0, 120)}`
                    )
                )
            resolve({
                parsed: {
                    is_error: false,
                    structured_output:
                        answer as unknown as CallOutcome["parsed"]["structured_output"],
                    num_turns: turns,
                    total_cost_usd: 0,
                    modelUsage: { [model]: {} },
                    usage: {
                        input_tokens: stats.input ?? 0,
                        output_tokens: stats.output_tokens ?? 0,
                        cache_read_input_tokens: stats.cached ?? 0,
                        cache_creation_input_tokens: 0,
                    },
                },
                toolCalls,
                toolOutput: outputs.join("\n"),
            })
        })
        child.stdin.end()
    })
}

async function main(): Promise<void> {
    const argv = await yargs(hideBin(process.argv))
        .option("name", { type: "string", default: "open-web" })
        .option("agent", {
            type: "string",
            choices: ["claude", "gemini"],
            default: "claude",
        })
        .option("model", { type: "string" })
        .option("concurrency", { type: "number", default: 3 })
        .option("timeout-s", { type: "number", default: 420 })
        .option("filter", { type: "string" })
        .parse()
    const model =
        argv.model ?? (argv.agent === "gemini" ? "gemini-3.8-flash" : "sonnet")

    const runDir = path.join(RESULTS_DIR, "runs", argv.name)
    fs.mkdirSync(path.join(runDir, "traces"), { recursive: true })
    const systemPromptFile = path.join(runDir, "system.md")
    fs.writeFileSync(systemPromptFile, SYSTEM_PROMPT)
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agent-evals-web-"))
    const resultsFile = path.join(runDir, "results.jsonl")
    const done = new Set(
        fs.existsSync(resultsFile)
            ? fs
                  .readFileSync(resultsFile, "utf8")
                  .split("\n")
                  .filter(Boolean)
                  .map((l) => (JSON.parse(l) as { id: string }).id)
            : []
    )
    const questions = QUESTIONS.filter(
        (q) =>
            !done.has(q.id) &&
            (!argv.filter || new RegExp(argv.filter).test(q.id))
    )
    console.log(
        `${questions.length} questions, agent ${argv.agent} (${model}) → ${path.relative(process.cwd(), runDir)}`
    )

    const claudeOptions: RunOptions = {
        model,
        timeoutMs: argv.timeoutS * 1000,
        cwd,
        systemPromptFile,
        agentTools: true,
        // No user-level skills: the agent must find its own way to the data.
        settingSources: "project",
    }

    const runOne = async (q: OpenQuestion): Promise<void> => {
        const started = Date.now()
        try {
            const outcome =
                argv.agent === "gemini"
                    ? await runGemini(q.question, model, argv.timeoutS * 1000)
                    : await runClaude(q.question, claudeOptions, SCHEMA)
            const answer = outcome.parsed
                .structured_output as unknown as OpenAnswer
            const { searches, fetched } = domainsOf(outcome.toolCalls)
            const matches =
                typeof q.gold === "number"
                    ? answer.answer_number !== null &&
                      approxEqual(answer.answer_number, q.gold, 0.01)
                    : (answer.answer_entity ?? "")
                          .toLowerCase()
                          .includes(q.gold.toLowerCase())
            const row = {
                id: q.id,
                agent: argv.agent,
                question: q.question,
                gold: q.gold,
                unit: q.unit,
                chart: q.chart,
                answer,
                matches_owid: matches,
                searches,
                fetched_domains: fetched,
                tool_calls: outcome.toolCalls,
                num_turns: outcome.parsed.num_turns,
                model: servedModel(outcome.parsed),
                usage: usageOf(outcome.parsed),
                cost_usd: outcome.parsed.total_cost_usd ?? 0,
                latency_s: (Date.now() - started) / 1000,
            }
            fs.appendFileSync(resultsFile, JSON.stringify(row) + "\n")
            fs.writeFileSync(
                path.join(runDir, "traces", `${q.id}.json`),
                JSON.stringify(
                    [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: q.question },
                        ...outcome.toolCalls.map((c) => ({
                            role: "tool_call",
                            name: c.name,
                            content: c.input,
                        })),
                        {
                            role: "tool_result",
                            content: outcome.toolOutput.slice(0, 200_000),
                        },
                        {
                            role: "assistant",
                            content: JSON.stringify(answer, null, 2),
                        },
                    ],
                    null,
                    2
                )
            )
            console.log(
                `${matches ? "=" : "≠"} ${q.id}: ${answer.answer_number ?? answer.answer_entity} from ${answer.source_name} (${answer.source_url})\n    searched: ${searches.join(" | ")}\n    fetched: ${fetched.join(", ") || "nothing"}  (${row.latency_s.toFixed(0)}s, ${row.usage.input_tokens + row.usage.cache_read_input_tokens} in / ${row.usage.output_tokens} out tokens)`
            )
        } catch (error) {
            console.log(`! ${q.id}: ${(error as Error).message.slice(0, 300)}`)
        }
    }

    const queue = [...questions]
    await Promise.all(
        Array.from({ length: argv.concurrency }, async () => {
            while (queue.length > 0) await runOne(queue.shift()!)
        })
    )
}

void main()
