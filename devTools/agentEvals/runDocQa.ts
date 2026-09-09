#!/usr/bin/env tsx
/**
 * Document-QA eval: ask an agent questions about a chart page under different
 * text renderings of that page, and grade the answers against gold values
 * derived from the CSV endpoints (see buildCases.ts).
 *
 * Conditions:
 *   today – the production page fetched with `Accept: text/markdown`, i.e.
 *           Cloudflare's HTML→markdown conversion: what an agent that doesn't
 *           run JavaScript reads today.
 *   pr    – the PR's /grapher/<slug>.md from the branch's staging server.
 *   none  – no page at all: what the model answers from memory. A control
 *           that shows how much of a correct answer the page contributed.
 *
 * The agent is `claude -p` with no tools; the page is handed over as a fetched
 * document and the answer comes back as structured JSON.
 *
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runDocQa.ts --name pilot --limit 10
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runDocQa.ts --name full --model sonnet --reps 2
 */
import { spawn } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { pathToFileURL } from "url"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import {
    EVALS_DIR,
    RESULTS_DIR,
    ChartSpec,
    grapherUrl,
    loadCharts,
    prodPageUrl,
    splitPath,
    stagingOrigin,
} from "./lib/charts.js"
import { fetchTextCached } from "./lib/http.js"
import { approxEqual } from "./lib/numbers.js"
import type { EvalCase, Gold } from "./buildCases.js"

export type Condition = "today" | "pr" | "none"
const CONDITIONS: Condition[] = ["today", "pr", "none"]

export interface AgentAnswer {
    answer_number: number | null
    answer_entity: string | null
    answer_text: string
    found_in_page: boolean
    evidence: string
}

export interface Grade {
    correct: number
    grounded: number
    hallucinated: number
    abstained: number
}

export interface ResultRow {
    prompt_id: string
    case_id: string
    condition: Condition
    rep: number
    prompt: string
    tags: string[]
    status: "ok"
    stop_reason: string | null
    grade: Grade
    explanation: string
    answer: AgentAnswer
    gold: Gold
    model: string
    usage: {
        input_tokens: number
        output_tokens: number
        cache_read_input_tokens: number
        cache_creation_input_tokens: number
    }
    cost_usd: number
    latency_s: number
    attempts: number
    doc_chars: number
    meta: Record<string, unknown>
}

interface ErrorRow {
    case_id: string
    condition: Condition
    rep: number
    class: "api_error" | "timeout" | "unparseable" | "spawn_error"
    attempts: number
    message: string
    model?: string
    usage?: ResultRow["usage"]
}

const ANSWER_SCHEMA = {
    type: "object",
    properties: {
        answer_number: { type: ["number", "null"] },
        answer_entity: { type: ["string", "null"] },
        answer_text: { type: "string" },
        found_in_page: { type: "boolean" },
        evidence: { type: "string" },
    },
    required: [
        "answer_number",
        "answer_entity",
        "answer_text",
        "found_in_page",
        "evidence",
    ],
    additionalProperties: false,
}

const SYSTEM_PROMPT_WITH_PAGE = `You are a careful research assistant answering a user's question about data published by Our World in Data.

The user's tooling has already fetched the relevant page and pasted its text content into the message. You have no other tools and no internet access.

Rules:
- Answer only from the page content provided. If the page does not contain the information needed, say so: set found_in_page to false and leave answer_number and answer_entity null. Do not fill gaps from memory and do not estimate from other figures on the page.
- If the page does contain the answer, put the exact fragment you relied on into evidence: a verbatim copy of one table row or sentence from the page, with no commentary around it.
- answer_number is a plain number in the unit the question asks for (write 609000000, not "609 million"; write 12.5 for 12.5%). answer_entity is the entity's name when the question asks which country or region.
- answer_text is one or two sentences for the user.`

const SYSTEM_PROMPT_WITHOUT_PAGE = `You are a careful research assistant answering a user's question about data published by Our World in Data.

The user's tooling tried to fetch the relevant page but got no usable text. You have no tools and no internet access.

Rules:
- Set found_in_page to false and leave evidence empty, since no page content is available.
- If you know the answer with reasonable confidence, give it: answer_number as a plain number in the unit the question asks for (write 609000000, not "609 million"; write 12.5 for 12.5%), or answer_entity when the question asks which country or region. If you do not know, leave them null and say so.
- answer_text is one or two sentences for the user.`

function normalize(s: string): string {
    return s
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/per ?cent/g, "%")
        .replace(/[^a-z0-9%$°]+/g, " ")
        .trim()
}

/**
 * The model is asked to quote the page verbatim, but often wraps the quote in
 * a sentence or two. Accept the whole string, any quoted fragment, or any line
 * of it, as long as one of them appears in the page.
 */
function evidenceIsInDoc(evidence: string, doc: string): boolean {
    const haystack = normalize(doc)
    const candidates = [
        evidence,
        ...(evidence.match(/["“]([^"”]{6,})["”]/g) ?? []).map((q) =>
            q.slice(1, -1)
        ),
        ...evidence.split(/\n|\||: /),
    ]
    return candidates.some((c) => {
        const n = normalize(c)
        return n.length >= 6 && haystack.includes(n)
    })
}

/**
 * The page prints rounded values ("0.9%" for 0.95), so an answer copied from
 * it can miss a 1% tolerance while being exactly what the page says. Accept an
 * answer that equals gold rounded to the answer's own precision, as long as
 * that rounding step is small relative to the value (so "0" or "0.01" never
 * passes for 0.0017).
 */
function matchesAtOwnPrecision(answer: number, gold: number): boolean {
    if (answer === 0 || gold === 0) return false
    const decimals = (String(answer).split(".")[1] ?? "").length
    const halfUnit = 0.5 / 10 ** decimals
    if (halfUnit > 0.1 * Math.abs(gold)) return false
    return Math.abs(answer - gold) <= halfUnit
}

export function grade(
    evalCase: EvalCase,
    answer: AgentAnswer,
    doc: string
): { grade: Grade; explanation: string } {
    const gold = evalCase.gold
    const text = normalize(answer.answer_text ?? "")
    const grounded =
        answer.found_in_page && evidenceIsInDoc(answer.evidence ?? "", doc)

    let answered: boolean
    let correct: boolean
    let explanation: string
    switch (gold.kind) {
        case "number": {
            answered = answer.answer_number !== null
            correct =
                answered &&
                (approxEqual(
                    answer.answer_number!,
                    gold.number!,
                    gold.relTol ?? 0.01,
                    gold.absTol ?? 0
                ) ||
                    matchesAtOwnPrecision(answer.answer_number!, gold.number!))
            explanation = `expected ${gold.number}, got ${answer.answer_number}`
            break
        }
        case "entity": {
            const entity = normalize(answer.answer_entity ?? "")
            answered = entity.length > 0
            correct =
                answered &&
                gold.entities!.some((e) => {
                    const n = normalize(e)
                    return (
                        entity === n || entity.includes(n) || n.includes(entity)
                    )
                })
            explanation = `expected one of ${gold.entities!.join(" / ")}, got ${answer.answer_entity}`
            break
        }
        case "none": {
            // Unanswerable cases are all numeric lookups; models routinely echo
            // the asked-about entity into answer_entity, which is not an answer.
            answered = answer.answer_number !== null
            correct = !answered
            explanation = answered
                ? `page has no value here, but got ${answer.answer_number}`
                : "correctly declined"
            break
        }
        case "unit": {
            answered = text.length > 0
            const tokens = gold.unitTokens!.map(normalize).filter(Boolean)
            const hits = tokens.filter((t) => text.includes(t))
            correct =
                answered &&
                (hits.some((t) => t.length <= 2) ||
                    hits.length * 2 >= tokens.length)
            explanation = `unit tokens ${JSON.stringify(tokens)}, matched ${JSON.stringify(hits)}`
            break
        }
        case "sources": {
            answered = text.length > 0
            const hits = gold.sources!.filter((s) =>
                text.includes(normalize(s))
            )
            correct = answered && hits.length > 0
            explanation = `sources ${JSON.stringify(gold.sources)}, matched ${JSON.stringify(hits)}`
            break
        }
    }

    const isUnanswerable = gold.kind === "none"
    return {
        grade: {
            correct: correct ? 1 : 0,
            grounded: correct && (isUnanswerable || grounded) ? 1 : 0,
            hallucinated: (isUnanswerable ? answered : answered && !correct)
                ? 1
                : 0,
            abstained: answered ? 0 : 1,
        },
        explanation,
    }
}

interface ClaudeResult {
    is_error: boolean
    result?: string
    structured_output?: AgentAnswer
    stop_reason?: string | null
    api_error_status?: number | null
    modelUsage?: Record<string, unknown>
    usage?: Record<string, number>
    total_cost_usd?: number
    duration_api_ms?: number
    duration_ms?: number
}

interface RunOptions {
    model: string
    effort?: string
    timeoutMs: number
    cwd: string
    systemPromptFile: string
}

class CallError extends Error {
    constructor(
        readonly cls: ErrorRow["class"],
        message: string,
        readonly retryable: boolean,
        readonly parsed?: ClaudeResult
    ) {
        super(message)
    }
}

function runClaude(
    userMessage: string,
    options: RunOptions
): Promise<ClaudeResult> {
    const args = [
        "-p",
        "--system-prompt-file",
        options.systemPromptFile,
        "--tools",
        "",
        "--model",
        options.model,
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(ANSWER_SCHEMA),
        "--no-session-persistence",
        "--strict-mcp-config",
    ]
    if (options.effort) args.push("--effort", options.effort)

    return new Promise((resolve, reject) => {
        const child = spawn("claude", args, {
            cwd: options.cwd,
            stdio: ["pipe", "pipe", "pipe"],
        })
        let stdout = ""
        let stderr = ""
        let timedOut = false
        const timer = setTimeout(() => {
            timedOut = true
            child.kill("SIGKILL")
        }, options.timeoutMs)
        child.stdout.on("data", (d) => (stdout += d))
        child.stderr.on("data", (d) => (stderr += d))
        child.on("error", (err) => {
            clearTimeout(timer)
            reject(new CallError("spawn_error", err.message, false))
        })
        child.on("close", (code) => {
            clearTimeout(timer)
            // A hung CLI start (no output at all) has been seen to clear on the
            // next attempt, so a timeout is retried once; attempts are recorded.
            if (timedOut)
                return reject(
                    new CallError(
                        "timeout",
                        `killed after ${options.timeoutMs} ms; stdout: ${stdout.slice(0, 200)}; stderr: ${stderr.slice(0, 300)}`,
                        true
                    )
                )
            let parsed: ClaudeResult
            try {
                parsed = JSON.parse(stdout) as ClaudeResult
            } catch {
                return reject(
                    new CallError(
                        "unparseable",
                        `exit ${code}; stdout: ${stdout.slice(0, 300)}; stderr: ${stderr.slice(0, 300)}`,
                        code !== 0
                    )
                )
            }
            if (parsed.is_error) {
                const status = parsed.api_error_status ?? 0
                const retryable =
                    [429, 500, 502, 503, 529].includes(status) ||
                    /rate limit|overloaded|529|timeout/i.test(
                        parsed.result ?? ""
                    )
                return reject(
                    new CallError(
                        "api_error",
                        `${status}: ${(parsed.result ?? "").slice(0, 300)}`,
                        retryable,
                        parsed
                    )
                )
            }
            if (!parsed.structured_output)
                return reject(
                    new CallError(
                        "unparseable",
                        `no structured_output; result: ${(parsed.result ?? "").slice(0, 300)}`,
                        false,
                        parsed
                    )
                )
            resolve(parsed)
        })
        child.stdin.end(userMessage)
    })
}

function usageOf(parsed: ClaudeResult | undefined): ResultRow["usage"] {
    const u = parsed?.usage ?? {}
    return {
        input_tokens: u.input_tokens ?? 0,
        output_tokens: u.output_tokens ?? 0,
        cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    }
}

function servedModel(parsed: ClaudeResult | undefined): string {
    return Object.keys(parsed?.modelUsage ?? {}).join("+") || "unknown"
}

function userMessage(
    evalCase: EvalCase,
    condition: Condition,
    doc: string
): string {
    if (condition === "none")
        return `I tried to fetch ${evalCase.url} but got no usable text back (the chart needs JavaScript).\n\nQuestion: ${evalCase.question}`
    return `I fetched the page ${evalCase.url} from ourworldindata.org. Here is its text content:\n\n<page_content>\n${doc}\n</page_content>\n\nQuestion: ${evalCase.question}`
}

async function fetchDoc(
    spec: ChartSpec,
    condition: Condition,
    branch: string
): Promise<string> {
    if (condition === "none") return ""
    const file = path.join(RESULTS_DIR, "docs", condition, `${spec.key}.md`)
    if (condition === "today") {
        const body = await fetchTextCached(prodPageUrl(spec), file, {
            accept: "text/markdown",
        })
        if (/^\s*<(!doctype|html)/i.test(body)) {
            fs.rmSync(file, { force: true })
            throw new Error(
                `${prodPageUrl(spec)} returned HTML, not markdown — is Cloudflare's markdown conversion still on?`
            )
        }
        return body
    }
    const { slug, params } = splitPath(spec.path)
    return fetchTextCached(
        grapherUrl(stagingOrigin(branch), slug, ".md", params),
        file
    )
}

function appendJsonl(file: string, row: unknown): void {
    fs.appendFileSync(file, JSON.stringify(row) + "\n")
}

function readJsonl<T>(file: string): T[] {
    if (!fs.existsSync(file)) return []
    return fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as T)
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
}

async function main(): Promise<void> {
    const argv = await yargs(hideBin(process.argv))
        .option("cases", {
            type: "string",
            default: path.join(EVALS_DIR, "cases.json"),
        })
        .option("name", {
            type: "string",
            default: new Date()
                .toISOString()
                .slice(0, 16)
                .replace(/[:T]/g, "-"),
            describe: "Run name; results land in results/runs/<name>/",
        })
        .option("conditions", {
            type: "string",
            default: CONDITIONS.join(","),
        })
        .option("model", {
            type: "string",
            default: "sonnet",
            describe: "Model alias or id passed to claude --model",
        })
        .option("effort", { type: "string" })
        .option("reps", { type: "number", default: 1 })
        .option("concurrency", { type: "number", default: 5 })
        .option("filter", {
            type: "string",
            describe:
                "Regex over case ids (e.g. 'life-expectancy/' or 'rank-')",
        })
        .option("limit", { type: "number" })
        .option("branch", { type: "string" })
        .option("timeout-s", { type: "number", default: 300 })
        .option("refresh-docs", {
            type: "boolean",
            default: false,
            describe:
                "Re-download the page snapshots instead of reusing cached ones",
        })
        .parse()

    const charts = loadCharts()
    const branch = argv.branch ?? charts.prBranch
    const conditions = argv.conditions.split(",") as Condition[]
    for (const c of conditions)
        if (!CONDITIONS.includes(c)) throw new Error(`unknown condition ${c}`)

    let cases = JSON.parse(fs.readFileSync(argv.cases, "utf8")) as EvalCase[]
    if (argv.filter) {
        const re = new RegExp(argv.filter)
        cases = cases.filter((c) => re.test(c.id))
    }
    if (argv.limit) cases = cases.slice(0, argv.limit)

    const runDir = path.join(RESULTS_DIR, "runs", argv.name)
    fs.mkdirSync(runDir, { recursive: true })
    // An empty directory outside the repo, so the agent picks up no CLAUDE.md,
    // project settings or hooks from this checkout.
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agent-evals-"))
    if (argv.refreshDocs)
        fs.rmSync(path.join(RESULTS_DIR, "docs"), {
            recursive: true,
            force: true,
        })

    // Page snapshots, one per chart and condition, fetched up front so a broken
    // endpoint fails the run before any model call is made.
    const specsByKey = new Map(charts.charts.map((s) => [s.key, s]))
    const docs = new Map<string, string>()
    for (const key of new Set(cases.map((c) => c.chart))) {
        const spec = specsByKey.get(key)
        if (!spec) throw new Error(`cases.json references unknown chart ${key}`)
        for (const condition of conditions)
            docs.set(
                `${key}|${condition}`,
                await fetchDoc(spec, condition, branch)
            )
    }

    const systemPromptFiles: Record<Condition, string> = {
        today: path.join(runDir, "system-with-page.md"),
        pr: path.join(runDir, "system-with-page.md"),
        none: path.join(runDir, "system-without-page.md"),
    }
    fs.writeFileSync(systemPromptFiles.today, SYSTEM_PROMPT_WITH_PAGE)
    fs.writeFileSync(systemPromptFiles.none, SYSTEM_PROMPT_WITHOUT_PAGE)
    fs.writeFileSync(
        path.join(runDir, "config.json"),
        JSON.stringify(
            {
                model: argv.model,
                effort: argv.effort ?? null,
                conditions,
                reps: argv.reps,
                branch,
                cases: cases.length,
                filter: argv.filter ?? null,
                startedAt: new Date().toISOString(),
            },
            null,
            2
        )
    )

    const resultsFile = path.join(runDir, "results.jsonl")
    const errorsFile = path.join(runDir, "errors.jsonl")
    const done = new Set(
        readJsonl<ResultRow>(resultsFile).map(
            (r) => `${r.case_id}|${r.condition}|${r.rep}`
        )
    )

    interface Task {
        evalCase: EvalCase
        condition: Condition
        rep: number
    }
    const tasks: Task[] = []
    for (let rep = 0; rep < argv.reps; rep++)
        for (const evalCase of cases)
            for (const condition of conditions)
                if (!done.has(`${evalCase.id}|${condition}|${rep}`))
                    tasks.push({ evalCase, condition, rep })

    console.log(
        `${tasks.length} calls to make (${cases.length} cases × ${conditions.length} conditions × ${argv.reps} reps, ${done.size} already done) → ${path.relative(process.cwd(), runDir)}`
    )

    let completed = 0
    let errors = 0
    const tally: Record<
        string,
        { n: number; correct: number; grounded: number; hallucinated: number }
    > = {}

    const runTask = async ({
        evalCase,
        condition,
        rep,
    }: Task): Promise<void> => {
        const doc = docs.get(`${evalCase.chart}|${condition}`) ?? ""
        const message = userMessage(evalCase, condition, doc)
        const options: RunOptions = {
            model: argv.model,
            effort: argv.effort,
            timeoutMs: argv.timeoutS * 1000,
            cwd,
            systemPromptFile: systemPromptFiles[condition],
        }
        let attempts = 0
        let lastError: CallError | undefined
        const maxAttempts = 3
        while (attempts < maxAttempts) {
            attempts++
            const started = Date.now()
            try {
                const parsed = await runClaude(message, options)
                const latency = (Date.now() - started) / 1000
                const answer = parsed.structured_output!
                const graded = grade(evalCase, answer, doc)
                const row: ResultRow = {
                    prompt_id: `${evalCase.id}|${condition}`,
                    case_id: evalCase.id,
                    condition,
                    rep,
                    prompt: evalCase.question,
                    tags: [evalCase.type, evalCase.chart, condition],
                    status: "ok",
                    stop_reason: parsed.stop_reason ?? null,
                    grade: graded.grade,
                    explanation: graded.explanation,
                    answer,
                    gold: evalCase.gold,
                    model: servedModel(parsed),
                    usage: usageOf(parsed),
                    cost_usd: parsed.total_cost_usd ?? 0,
                    latency_s: latency,
                    attempts,
                    doc_chars: doc.length,
                    meta: evalCase.meta,
                }
                appendJsonl(resultsFile, row)
                const traceDir = path.join(runDir, "traces", condition)
                fs.mkdirSync(traceDir, { recursive: true })
                fs.writeFileSync(
                    path.join(
                        traceDir,
                        `${evalCase.id.replace(/\//g, "__")}_rep${rep}.json`
                    ),
                    JSON.stringify(
                        [
                            {
                                role: "system",
                                content: fs.readFileSync(
                                    options.systemPromptFile,
                                    "utf8"
                                ),
                            },
                            { role: "user", content: message },
                            {
                                role: "assistant",
                                content: JSON.stringify(answer, null, 2),
                            },
                        ],
                        null,
                        2
                    )
                )
                const t = (tally[condition] ??= {
                    n: 0,
                    correct: 0,
                    grounded: 0,
                    hallucinated: 0,
                })
                t.n++
                t.correct += graded.grade.correct
                t.grounded += graded.grade.grounded
                t.hallucinated += graded.grade.hallucinated
                completed++
                const mark = graded.grade.correct
                    ? "✓"
                    : graded.grade.abstained
                      ? "∅"
                      : "✗"
                console.log(
                    `[${completed + errors}/${tasks.length}] ${mark} ${condition.padEnd(5)} ${evalCase.id}  ${graded.explanation}  (${latency.toFixed(0)}s)`
                )
                return
            } catch (error) {
                if (!(error instanceof CallError)) throw error
                lastError = error
                const allowed = error.cls === "timeout" ? 2 : maxAttempts
                if (!error.retryable || attempts >= allowed) break
                const backoff =
                    5000 * 2 ** (attempts - 1) * (0.5 + Math.random())
                console.log(
                    `    retry ${attempts} for ${evalCase.id}/${condition} after ${error.cls}: ${error.message.slice(0, 120)} (waiting ${(backoff / 1000).toFixed(0)}s)`
                )
                await sleep(backoff)
            }
        }
        errors++
        const row: ErrorRow = {
            case_id: evalCase.id,
            condition,
            rep,
            class: lastError!.cls,
            attempts,
            message: lastError!.message,
            model: lastError!.parsed
                ? servedModel(lastError!.parsed)
                : undefined,
            usage: lastError!.parsed ? usageOf(lastError!.parsed) : undefined,
        }
        appendJsonl(errorsFile, row)
        console.log(
            `[${completed + errors}/${tasks.length}] ! ${condition.padEnd(5)} ${evalCase.id}  ${row.class}: ${row.message.slice(0, 160)}`
        )
    }

    const queue = [...tasks]
    const workers = Array.from({ length: argv.concurrency }, async () => {
        while (queue.length > 0) await runTask(queue.shift()!)
    })
    await Promise.all(workers)

    console.log("\ncondition  n   correct  grounded  hallucinated")
    for (const [condition, t] of Object.entries(tally)) {
        const pct = (x: number): string =>
            `${((100 * x) / t.n).toFixed(0)}%`.padStart(7)
        console.log(
            `${condition.padEnd(9)} ${String(t.n).padStart(3)} ${pct(t.correct)}  ${pct(t.grounded)}  ${pct(t.hallucinated)}`
        )
    }
    if (errors > 0)
        console.log(
            `${errors} calls failed — see ${path.relative(process.cwd(), errorsFile)}`
        )
    console.log(
        `\nReport: yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/buildReport.ts --run ${argv.name}`
    )
}

// buildReport.ts imports grade() from here to re-grade stored answers, so only
// run when invoked directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    void main()
