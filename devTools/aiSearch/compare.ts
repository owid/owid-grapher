import { execFileSync } from "child_process"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import pMap from "p-map"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import {
    AI_SEARCH_MODELS,
    AiSearchCompactBlock,
    AiSearchCompactContentBlock,
} from "@ourworldindata/types"

/**
 * Runs AI search and standard search for a list of queries on a server that
 * has /api/ai-search (a staging server or local dev with an Anthropic key),
 * and writes the run as JSON plus an HTML report that shows both side by
 * side. With --baseline, the report and the console summary also show what
 * changed since an earlier run, e.g. after a prompt or model change.
 *
 * Every query costs one AI search request (a Haiku and a Sonnet call by
 * default), so a run of the default 20 queries takes a minute or two.
 */

interface SearchHitSummary {
    slug: string
    title: string
    type: string
}

interface QueryRun {
    query: string
    ai: {
        blocks: AiSearchCompactBlock[]
        expansions: string[]
        model?: string
        timings?: Record<string, number>
        error?: string
    }
    standard: { charts: SearchHitSummary[]; pages: SearchHitSummary[] }
}

interface Run {
    host: string
    model?: string
    startedAt: string
    queries: QueryRun[]
}

const STANDARD_HITS = 10

async function main(): Promise<void> {
    const argv = await yargs(hideBin(process.argv))
        .command("$0 [queries..]", "Compare AI search with standard search")
        .option("host", {
            type: "string",
            description:
                "Server to query (default: this branch's staging server)",
        })
        .option("queries-file", {
            type: "string",
            default: path.join(import.meta.dirname, "queries.txt"),
            description: "File with one query per line",
        })
        .option("model", { type: "string", choices: AI_SEARCH_MODELS })
        .option("baseline", {
            type: "string",
            description: "An earlier run's JSON file to compare against",
        })
        .option("out", { type: "string", default: "tmp/ai-search-runs" })
        .option("concurrency", { type: "number", default: 3 })
        .strict()
        .parse()

    const host = argv.host ?? stagingHost()
    const queries = argv.queries?.length
        ? argv.queries.map(String)
        : (await readFile(argv.queriesFile, "utf8"))
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
    const baseline: Run | undefined = argv.baseline
        ? JSON.parse(await readFile(argv.baseline, "utf8"))
        : undefined

    const startedAt = new Date().toISOString()
    console.log(`Running ${queries.length} queries on ${host}`)
    const results = await pMap(
        queries,
        async (query) => {
            const result = await runQuery(host, query, argv.model)
            console.log(`  ${query}: ${describeOutcome(result)}`)
            return result
        },
        { concurrency: argv.concurrency }
    )
    const run: Run = { host, model: argv.model, startedAt, queries: results }

    await mkdir(argv.out, { recursive: true })
    const name = startedAt.replace(/[:.]/g, "-")
    const jsonPath = path.join(argv.out, `${name}.json`)
    const htmlPath = path.join(argv.out, `${name}.html`)
    await writeFile(jsonPath, JSON.stringify(run, null, 2))
    await writeFile(htmlPath, renderReport(run, baseline))

    if (baseline) printChanges(run, baseline)
    console.log(`\nWrote ${jsonPath}\nand ${htmlPath}`)
}

/** The staging server of the current git branch */
function stagingHost(): string {
    const branch = execFileSync("git", ["branch", "--show-current"], {
        encoding: "utf8",
    }).trim()
    return `http://staging-site-${branch.replaceAll("/", "-").slice(0, 28)}`
}

async function runQuery(
    host: string,
    query: string,
    model: string | undefined
): Promise<QueryRun> {
    const [ai, charts, pages] = await Promise.all([
        runAiSearch(host, query, model),
        runStandardSearch(host, query, "charts"),
        runStandardSearch(host, query, "pages"),
    ])
    return { query, ai, standard: { charts, pages } }
}

async function runAiSearch(
    host: string,
    query: string,
    model: string | undefined
): Promise<QueryRun["ai"]> {
    const params = new URLSearchParams({ q: query, compact: "1" })
    if (model) params.set("model", model)
    const ai: QueryRun["ai"] = { blocks: [], expansions: [] }
    try {
        const response = await fetch(`${host}/api/ai-search?${params}`, {
            signal: AbortSignal.timeout(90_000),
        })
        if (!response.ok) {
            ai.error = `HTTP ${response.status}`
            return ai
        }
        for (const line of (await response.text()).split("\n")) {
            if (!line.trim()) continue
            const event = JSON.parse(line)
            if (event.type === "block") ai.blocks.push(event.block)
            else if (event.type === "expansion") ai.expansions = event.queries
            else if (event.type === "done") {
                ai.model = event.model
                ai.timings = event.timings
            } else if (event.type === "error") ai.error = event.code
        }
        if (!ai.timings && !ai.error) ai.error = "stream ended early"
    } catch (error) {
        ai.error = String(error)
    }
    return ai
}

async function runStandardSearch(
    host: string,
    query: string,
    type: "charts" | "pages"
): Promise<SearchHitSummary[]> {
    const params = new URLSearchParams({
        q: query,
        type,
        hitsPerPage: String(STANDARD_HITS),
    })
    const response = await fetch(`${host}/api/search?${params}`, {
        signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) return []
    const { results } = (await response.json()) as {
        results: SearchHitSummary[]
    }
    return results.map(({ slug, title, type }) => ({ slug, title, type }))
}

function describeOutcome({ ai }: QueryRun): string {
    if (ai.error) return `failed (${ai.error})`
    const seconds = ((ai.timings?.["end to end"] ?? 0) / 1000).toFixed(1)
    return `${ai.blocks.length} blocks in ${seconds}s`
}

// The facts about a page that a prompt change usually moves

const contentOf = (
    blocks: AiSearchCompactBlock[]
): AiSearchCompactContentBlock[] =>
    blocks.flatMap((block) =>
        block.type === "group" ? block.blocks : "slug" in block ? [block] : []
    )

const headlineOf = (blocks: AiSearchCompactBlock[]): string | undefined =>
    contentOf(blocks).find(
        (block) => block.type === "chart" && block.size !== "small"
    )?.slug

const isWriting = (block: AiSearchCompactContentBlock): boolean =>
    block.type !== "chart"

/** How many groups start with a page rather than a chart */
const pageLeadsOf = (blocks: AiSearchCompactBlock[]): number =>
    blocks.filter(
        (block) =>
            block.type === "group" &&
            block.blocks[0] &&
            isWriting(block.blocks[0])
    ).length

/** The share of slugs in `a` that are also in `b` */
function overlap(a: string[], b: string[]): number {
    if (!a.length) return 0
    const other = new Set(b)
    return a.filter((slug) => other.has(slug)).length / a.length
}

const slugsOf = (blocks: AiSearchCompactBlock[]): string[] =>
    contentOf(blocks).map((block) => block.slug)

const standardSlugsOf = ({ standard }: QueryRun): string[] =>
    [...standard.charts, ...standard.pages].map((hit) => hit.slug)

const percent = (share: number): string => `${Math.round(share * 100)}%`

function printChanges(run: Run, baseline: Run): void {
    const before = new Map(baseline.queries.map((q) => [q.query, q]))
    console.log(`\nChanges since the run of ${baseline.startedAt}:`)
    for (const result of run.queries) {
        const old = before.get(result.query)
        if (!old) {
            console.log(`  ${result.query}: not in the baseline`)
            continue
        }
        const changes: string[] = []
        const [headline, oldHeadline] = [
            headlineOf(result.ai.blocks),
            headlineOf(old.ai.blocks),
        ]
        if (headline !== oldHeadline)
            changes.push(
                `headline ${oldHeadline ?? "none"} → ${headline ?? "none"}`
            )
        const [leads, oldLeads] = [
            pageLeadsOf(result.ai.blocks),
            pageLeadsOf(old.ai.blocks),
        ]
        if (leads !== oldLeads)
            changes.push(`groups led by a page ${oldLeads} → ${leads}`)
        changes.push(
            `${percent(overlap(slugsOf(result.ai.blocks), slugsOf(old.ai.blocks)))} of content kept`
        )
        console.log(`  ${result.query}: ${changes.join(", ")}`)
    }
}

// The HTML report

const escape = (text: string): string =>
    text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")

function renderCard(block: AiSearchCompactContentBlock): string {
    const size =
        block.type === "chart" && block.size !== "small" ? ` ${block.size}` : ""
    const country = block.country ? ` · ${escape(block.country)}` : ""
    return `<li><span class="kind">${block.type}${size}</span> ${escape(block.title)}${country}</li>`
}

function renderAiPage(ai: QueryRun["ai"]): string {
    if (ai.error) return `<p class="error">Failed: ${escape(ai.error)}</p>`
    return ai.blocks
        .map((block) => {
            switch (block.type) {
                case "group":
                    return `<div class="group"><h4>${escape(block.title)}</h4><p class="blurb">${escape(block.blurb)}</p><ul>${block.blocks.map(renderCard).join("")}</ul></div>`
                case "forks":
                    return `<div class="group"><h4>${escape(block.question || "Which one?")}</h4><ul>${block.options.map((o) => `<li><span class="kind">fork</span> ${escape(o.label)} → “${escape(o.query)}”</li>`).join("")}</ul></div>`
                case "related":
                    return `<p class="related">Related: ${block.queries.map(escape).join(" · ")}</p>`
                default:
                    return `<ul>${renderCard(block)}</ul>`
            }
        })
        .join("")
}

function renderStandard({ standard }: QueryRun, aiSlugs: Set<string>): string {
    const list = (hits: SearchHitSummary[]): string =>
        hits
            .map(
                (hit, i) =>
                    `<li class="${aiSlugs.has(hit.slug) ? "shared" : ""}"><span class="kind">${i + 1}</span> ${escape(hit.title)}</li>`
            )
            .join("")
    return `<h4>Charts</h4><ol>${list(standard.charts)}</ol><h4>Pages</h4><ol>${list(standard.pages)}</ol>`
}

function renderReport(run: Run, baseline: Run | undefined): string {
    const before = new Map(baseline?.queries.map((q) => [q.query, q]))
    const sections = run.queries.map((result) => {
        const aiSlugs = slugsOf(result.ai.blocks)
        const timings = result.ai.timings
            ? `${((result.ai.timings["end to end"] ?? 0) / 1000).toFixed(1)} s, first block ${((result.ai.timings["first block"] ?? 0) / 1000).toFixed(1)} s`
            : ""
        const old = before.get(result.query)
        const baselineColumn = old
            ? `<div><h3>Baseline</h3>${renderAiPage(old.ai)}</div>`
            : ""
        return `<section>
<h2>${escape(result.query)}</h2>
<p class="meta">${timings} · ${percent(overlap(aiSlugs, standardSlugsOf(result)))} of the AI page's content is in standard search's top ${STANDARD_HITS} charts and pages${result.ai.expansions.length ? ` · also searched: ${result.ai.expansions.map(escape).join(", ")}` : ""}</p>
<div class="columns ${old ? "three" : ""}">
<div><h3>AI search</h3>${renderAiPage(result.ai)}</div>
${baselineColumn}
<div><h3>Standard search</h3>${renderStandard(result, new Set(aiSlugs))}</div>
</div>
</section>`
    })
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AI search run ${escape(run.startedAt)}</title>
<style>
body{margin:0;padding:24px 32px;background:#fff;color:#1d3d63;font:14px/1.45 Lato,"Helvetica Neue",Arial,sans-serif}
h1{font:700 24px Georgia,serif;margin:0 0 4px}
h2{font:700 20px Georgia,serif;margin:0}
h3{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#577291;margin:0 0 8px}
h4{margin:12px 0 2px;font-size:14px}
section{border-top:1px solid #dbe5f0;padding:20px 0}
.columns{display:grid;grid-template-columns:2fr 1fr;gap:32px;margin-top:12px}
.columns.three{grid-template-columns:1fr 1fr 1fr}
ul,ol{margin:4px 0;padding-left:0;list-style:none}
li{padding:2px 0}
.kind{display:inline-block;min-width:72px;font-size:11px;color:#6e87a2}
.shared{background:#f0f4fa}
.meta,.blurb,.related{color:#577291;margin:4px 0}
.error{color:#b40000}
</style></head><body>
<h1>AI search vs standard search</h1>
<p class="meta">${escape(run.host)} · ${escape(run.model ?? "default model")} · ${escape(run.startedAt)}${baseline ? ` · baseline ${escape(baseline.startedAt)}` : ""} · highlighted standard results also appear on the AI page</p>
${sections.join("\n")}
</body></html>`
}

void main()
