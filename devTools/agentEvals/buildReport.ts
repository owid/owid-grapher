#!/usr/bin/env tsx
/**
 * Render one document-QA run as a self-contained HTML report and open it.
 * Grades are recomputed from the stored answers, so a grader fix does not
 * require re-running the model.
 *
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/buildReport.ts --run sonnet-full
 */
import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { EVALS_DIR, RESULTS_DIR } from "./lib/charts.js"
import type { EvalCase } from "./buildCases.js"
import { Condition, Grade, ResultRow, grade } from "./runDocQa.js"

interface ErrorRow {
    case_id: string
    condition: Condition
    rep: number
    class: string
    message: string
}

const CONDITION_LABEL: Record<Condition, string> = {
    today: "Today (Cloudflare markdown)",
    pr: "PR (/grapher/<slug>.md)",
    none: "No page (memory only)",
}

function readJsonl<T>(file: string): T[] {
    if (!fs.existsSync(file)) return []
    return fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as T)
}

function esc(s: unknown): string {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

function pct(x: number, n: number): string {
    return n === 0 ? "–" : `${Math.round((100 * x) / n)}%`
}

function mean(xs: number[]): number {
    return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}

function median(xs: number[]): number {
    if (xs.length === 0) return 0
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
}

/** Paired bootstrap CI for the mean per-case difference b − a of a metric. */
function pairedDiff(
    rows: ResultRow[],
    a: Condition,
    b: Condition,
    metric: keyof Grade
): { diff: number; lo: number; hi: number; n: number } | undefined {
    const byCase = new Map<string, { a: number[]; b: number[] }>()
    for (const r of rows) {
        if (r.condition !== a && r.condition !== b) continue
        const e = byCase.get(r.case_id) ?? { a: [], b: [] }
        e[r.condition === a ? "a" : "b"].push(r.grade[metric])
        byCase.set(r.case_id, e)
    }
    const diffs = [...byCase.values()]
        .filter((e) => e.a.length > 0 && e.b.length > 0)
        .map((e) => mean(e.b) - mean(e.a))
    if (diffs.length < 2) return undefined
    let seed = 12345
    const rnd = (): number => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 4294967296
    }
    const samples: number[] = []
    for (let i = 0; i < 2000; i++) {
        let s = 0
        for (const _ of diffs) s += diffs[Math.floor(rnd() * diffs.length)]
        samples.push(s / diffs.length)
    }
    samples.sort((x, y) => x - y)
    return {
        diff: mean(diffs),
        lo: samples[Math.floor(0.025 * samples.length)],
        hi: samples[Math.floor(0.975 * samples.length)],
        n: diffs.length,
    }
}

function cell(r: ResultRow | undefined, err: ErrorRow | undefined): string {
    if (!r && err)
        return `<td class="c err" title="${esc(err.class + ": " + err.message)}">!</td>`
    if (!r) return `<td class="c"></td>`
    const g = r.grade
    const cls = g.correct
        ? g.grounded
            ? "ok"
            : "okmem"
        : g.abstained
          ? "abst"
          : "wrong"
    const sym = g.correct ? "✓" : g.abstained ? "∅" : "✗"
    const tip = [
        r.explanation,
        `answer: ${r.answer.answer_text}`,
        r.answer.evidence ? `evidence: ${r.answer.evidence}` : "",
        `found_in_page: ${r.answer.found_in_page}`,
    ]
        .filter(Boolean)
        .join("\n")
    return `<td class="c ${cls}" title="${esc(tip)}">${sym}</td>`
}

async function main(): Promise<void> {
    const argv = await yargs(hideBin(process.argv))
        .option("run", { type: "string", demandOption: true })
        .option("open", { type: "boolean", default: true })
        .parse()

    const runDir = path.join(RESULTS_DIR, "runs", argv.run)
    const config = JSON.parse(
        fs.readFileSync(path.join(runDir, "config.json"), "utf8")
    ) as Record<string, unknown>
    const cases = JSON.parse(
        fs.readFileSync(path.join(EVALS_DIR, "cases.json"), "utf8")
    ) as EvalCase[]
    const caseById = new Map(cases.map((c) => [c.id, c]))
    const charts = JSON.parse(
        fs.readFileSync(path.join(EVALS_DIR, "charts.json"), "utf8")
    ) as {
        charts: { key: string; path: string; note?: string }[]
    }

    // Re-grade from stored answers against the cached page snapshots.
    const docCache = new Map<string, string>()
    const doc = (chart: string, condition: Condition): string => {
        if (condition === "none") return ""
        const key = `${chart}|${condition}`
        if (!docCache.has(key)) {
            const f = path.join(RESULTS_DIR, "docs", condition, `${chart}.md`)
            docCache.set(
                key,
                fs.existsSync(f) ? fs.readFileSync(f, "utf8") : ""
            )
        }
        return docCache.get(key)!
    }
    const rows = readJsonl<ResultRow>(path.join(runDir, "results.jsonl")).map(
        (r) => {
            const c = caseById.get(r.case_id)
            if (!c) return r
            const g = grade(c, r.answer, doc(c.chart, r.condition))
            return { ...r, grade: g.grade, explanation: g.explanation }
        }
    )
    const errors = readJsonl<ErrorRow>(path.join(runDir, "errors.jsonl"))
    const conditions = (config.conditions as Condition[]).filter((c) =>
        rows.some((r) => r.condition === c)
    )

    // Summary per condition.
    const summary = conditions.map((cond) => {
        const rs = rows.filter((r) => r.condition === cond)
        const n = rs.length
        const sum = (k: keyof Grade): number =>
            rs.reduce((a, r) => a + r.grade[k], 0)
        return {
            cond,
            n,
            errors: errors.filter((e) => e.condition === cond).length,
            correct: sum("correct"),
            grounded: sum("grounded"),
            hallucinated: sum("hallucinated"),
            abstained: sum("abstained"),
            latency: median(rs.map((r) => r.latency_s)),
            docChars: median(rs.map((r) => r.doc_chars)),
            cost: rs.reduce((a, r) => a + r.cost_usd, 0),
            inputTokens: mean(
                rs.map(
                    (r) =>
                        r.usage.input_tokens +
                        r.usage.cache_read_input_tokens +
                        r.usage.cache_creation_input_tokens
                )
            ),
        }
    })

    const types = [...new Set(cases.map((c) => c.type))]
    const byType = (cond: Condition, type: string, k: keyof Grade): string => {
        const rs = rows.filter(
            (r) => r.condition === cond && r.tags[0] === type
        )
        return pct(
            rs.reduce((a, r) => a + r.grade[k], 0),
            rs.length
        )
    }

    const diffs = ["correct", "grounded", "hallucinated"].map((m) => ({
        metric: m,
        prVsToday: pairedDiff(rows, "today", "pr", m as keyof Grade),
        prVsNone: pairedDiff(rows, "none", "pr", m as keyof Grade),
    }))

    const reps = Math.max(1, ...rows.map((r) => r.rep + 1))
    const rowFor = (id: string, cond: Condition): ResultRow | undefined =>
        rows.find(
            (r) => r.case_id === id && r.condition === cond && r.rep === 0
        )
    const errFor = (id: string, cond: Condition): ErrorRow | undefined =>
        errors.find((e) => e.case_id === id && e.condition === cond)

    const fmtDiff = (d: ReturnType<typeof pairedDiff>): string =>
        d
            ? `${d.diff >= 0 ? "+" : ""}${Math.round(100 * d.diff)} pts <span class="ci">[${Math.round(100 * d.lo)}, ${Math.round(100 * d.hi)}]</span>`
            : "–"

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Agent eval · ${esc(argv.run)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.45 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 32px 40px 64px; max-width: 1400px; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 36px 0 10px; }
  .muted { color: #666; } .small { font-size: 12.5px; }
  table { border-collapse: collapse; margin: 8px 0 4px; } th, td { padding: 5px 10px; border-bottom: 1px solid #e6e6e6; text-align: left; vertical-align: top; }
  th { background: #f6f6f4; font-weight: 600; font-size: 12.5px; text-transform: uppercase; letter-spacing: .02em; color: #444; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .ci { color: #777; font-size: 12px; }
  td.c { text-align: center; width: 34px; font-weight: 700; cursor: help; }
  td.ok { background: #d7efd9; color: #1e6b2b; } td.okmem { background: #eef6d9; color: #5e7a12; }
  td.wrong { background: #f8d7d7; color: #9b1c1c; } td.abst { background: #eeeeee; color: #666; } td.err { background: #e8d9f5; color: #5b2d91; }
  .legend span { display: inline-block; padding: 1px 8px; margin-right: 8px; border-radius: 3px; font-size: 12.5px; }
  tr.chart td { background: #fafaf8; font-weight: 600; }
  td.q { max-width: 620px; }
  .gold { color: #555; font-size: 12px; }
  code { background: #f2f2f0; padding: 0 4px; border-radius: 3px; font-size: 12.5px; }
</style></head><body>
<h1>Agent eval: does the page text let an agent answer? · <code>${esc(argv.run)}</code></h1>
<p class="muted">Model <code>${esc(config.model)}</code>${config.effort ? `, effort ${esc(config.effort)}` : ""} · ${cases.length} cases over ${charts.charts.length} chart views · ${reps} rep(s) · ${rows.length} graded answers, ${errors.length} failed calls · started ${esc(config.startedAt)}.<br>
The agent gets the question plus the page text (or nothing) and must answer only from it. Gold comes from the chart's CSV endpoints, never from the page under test.</p>

<h2>Headline</h2>
<table>
<tr><th>Condition</th><th class="num">n</th><th class="num">Correct</th><th class="num">Correct &amp; from page</th><th class="num">Hallucinated</th><th class="num">Abstained</th><th class="num">Failed calls</th><th class="num">Median latency</th><th class="num">Median page chars</th><th class="num">Mean input tokens</th><th class="num">Cost (API-equiv.)</th></tr>
${summary
    .map(
        (s) =>
            `<tr><td>${esc(CONDITION_LABEL[s.cond])}</td><td class="num">${s.n}</td><td class="num"><b>${pct(s.correct, s.n)}</b></td><td class="num">${pct(s.grounded, s.n)}</td><td class="num">${pct(s.hallucinated, s.n)}</td><td class="num">${pct(s.abstained, s.n)}</td><td class="num">${s.errors}</td><td class="num">${s.latency.toFixed(0)} s</td><td class="num">${Math.round(s.docChars).toLocaleString()}</td><td class="num">${Math.round(s.inputTokens).toLocaleString()}</td><td class="num">$${s.cost.toFixed(2)}</td></tr>`
    )
    .join("\n")}
</table>
<p class="small muted">Correct: answer matches gold (numbers within 1%, or the accepted entity, or the page has no value and the agent declined). From page: correct and the quoted evidence occurs in the page text. Hallucinated: gave a specific answer that is wrong, or gave a number where the page has none. Abstained: gave no number/entity. Cost is what the same calls would cost on the API (they ran on a Claude subscription via <code>claude -p</code>); it includes Claude Code's ~9k-token system prompt on every call.</p>

<h2>Paired differences (mean per-case change, 95% bootstrap CI over cases)</h2>
<table>
<tr><th>Metric</th><th>PR vs today</th><th>PR vs no page</th></tr>
${diffs.map((d) => `<tr><td>${esc(d.metric)}</td><td>${fmtDiff(d.prVsToday)}</td><td>${fmtDiff(d.prVsNone)}</td></tr>`).join("\n")}
</table>
<p class="small muted">Noise floor for a single pass-rate at n = ${cases.length}, ${reps} rep(s): about ±${Math.round(100 / Math.sqrt(cases.length * reps))} pts. Differences whose interval excludes 0 are the ones to act on.</p>

<h2>By question type (correct · from page · hallucinated)</h2>
<table>
<tr><th>Type</th><th class="num">cases</th>${conditions.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>
${types
    .map(
        (t) =>
            `<tr><td>${esc(t)}</td><td class="num">${cases.filter((c) => c.type === t).length}</td>${conditions
                .map(
                    (c) =>
                        `<td>${byType(c, t, "correct")} · ${byType(c, t, "grounded")} · <span class="muted">${byType(c, t, "hallucinated")}</span></td>`
                )
                .join("")}</tr>`
    )
    .join("\n")}
</table>

<h2>Every case</h2>
<p class="legend"><span class="ok" style="background:#d7efd9">✓ correct, from page</span><span style="background:#eef6d9">✓ correct, not traceable to page</span><span style="background:#f8d7d7">✗ wrong</span><span style="background:#eeeeee">∅ abstained</span><span style="background:#e8d9f5">! call failed</span> · hover a cell for the answer and evidence</p>
<table>
<tr><th>Case</th><th>Question</th>${conditions.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>
${charts.charts
    .map((ch) => {
        const cs = cases.filter((c) => c.chart === ch.key)
        if (cs.length === 0) return ""
        return (
            `<tr class="chart"><td colspan="${2 + conditions.length}">${esc(ch.key)} <span class="muted small">· <a href="https://ourworldindata.org/grapher/${esc(ch.path)}">${esc(ch.path)}</a>${ch.note ? ` · ${esc(ch.note)}` : ""}</span></td></tr>` +
            cs
                .map(
                    (c) =>
                        `<tr><td class="small muted">${esc(c.type)}</td><td class="q">${esc(c.question)}<br><span class="gold">gold: ${esc(
                            c.gold.kind === "number"
                                ? c.gold.number
                                : c.gold.kind === "entity"
                                  ? c.gold.entities?.join(" / ")
                                  : c.gold.kind === "none"
                                    ? "no value on the page"
                                    : c.gold.kind === "unit"
                                      ? c.gold.unitTokens?.join(", ")
                                      : c.gold.sources?.join("; ")
                        )}</span></td>${conditions.map((cond) => cell(rowFor(c.id, cond), errFor(c.id, cond))).join("")}</tr>`
                )
                .join("\n")
        )
    })
    .join("\n")}
</table>
</body></html>`

    const out = path.join(runDir, "report.html")
    fs.writeFileSync(out, html)
    console.log(`Wrote ${path.relative(process.cwd(), out)}`)
    for (const s of summary)
        console.log(
            `${s.cond.padEnd(6)} n=${String(s.n).padStart(3)}  correct ${pct(s.correct, s.n).padStart(4)}  from-page ${pct(s.grounded, s.n).padStart(4)}  hallucinated ${pct(s.hallucinated, s.n).padStart(4)}  abstained ${pct(s.abstained, s.n).padStart(4)}  errors ${s.errors}`
        )
    if (argv.open && process.platform === "darwin")
        execFileSync("open", ["-a", "Google Chrome", out])
}

void main()
