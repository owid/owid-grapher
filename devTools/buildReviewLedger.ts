// Builds data-nuggets/REVIEW-LEDGER.md from the newest review snapshot.
//
// Why this exists: reviewer comments are the only human signal in the
// data-nuggets pipeline, and most of that signal is judgment ("is this
// interesting?") rather than anything that survives being compressed into a
// rule. Codifying it in the skills over-generalises from a handful of cases.
// Instead we hand the generator the precedent itself and let it decide whether
// a past objection applies to the nugget it is drafting.
//
// Design notes:
//   - Grouped by chart slug, because that is the highest-precision retrieval
//     key available and it needs no code: a generator working on
//     `democracy-index-eiu` reads that heading. Feedback is heavily
//     indicator-specific, far more so than it is semantically clustered.
//   - Comments are reproduced IN FULL, not summarised. The specific suggested
//     rewrite is the most valuable part of a review and a gist destroys it.
//   - Purely mechanical: no model in the loop, so the ledger cannot drift from
//     the snapshot it was built from.
//   - Committed to git, unlike the raw snapshots under data-nuggets/reviews/
//     (gitignored). Reviews live on a staging box that is destroyed after two
//     weeks; this file is how the signal outlives it. Reviewer emails are
//     dropped here — the ledger keeps the argument, not the identity.
//
// Examples:
//   yarn tsx devTools/buildReviewLedger.ts
//   yarn tsx devTools/buildReviewLedger.ts --snapshot data-nuggets/reviews/pull-x.json

import * as fs from "fs/promises"
import * as path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const REVIEWS_DIR = path.join("data-nuggets", "reviews")
const OUT_PATH = path.join("data-nuggets", "REVIEW-LEDGER.md")

type Decision = "approved" | "rejected" | "request_revisions"

interface Review {
    decision: Decision
    comment?: string | null
    reviewedAt?: string
}

interface GrapherView {
    slug?: string
    url?: string
    queryParams?: Record<string, string>
}

interface Version {
    kind?: string
    localId?: string
    title?: string
    description?: string
    payload?: { grapherViews?: GrapherView[] }
    review?: Review | null
}

interface Lineage {
    lineageKey: string
    versions?: Version[]
}

interface Snapshot {
    pulledAt: string
    source: string
    lineages: Lineage[]
}

// Mirrors the taxonomy already used by data-nuggets/.sample-index.json so the
// two artifacts can be cross-referenced.
function describeStructure(views: GrapherView[]): string {
    if (views.length > 1) return `multi-chart (${views.length} charts)`
    const params = views[0]?.queryParams ?? {}
    const tab = params.tab ?? "line"
    if (tab === "map") return "map"
    if (tab === "discrete-bar") return "discrete-bar"
    if (tab === "slope") return "slope"
    if (tab.startsWith("stacked")) return "stacked"
    if (tab === "scatter") return "scatter"
    const country = params.country ?? ""
    const n = country ? country.split("~").filter(Boolean).length : 0
    if (n <= 1) return "single-entity"
    if (n === 2) return "pair"
    return `group(${n})`
}

// A reviewer who decides twice on one lineage usually escalates
// request_revisions -> rejected, and the second comment is a pointer rather
// than an argument. Those carry no signal and would pollute any clustering.
function isContentFree(comment: string): boolean {
    return (
        comment.trim().length < 60 &&
        /see (the )?(previous|prior|above)/i.test(comment)
    )
}

async function newestSnapshot(): Promise<string> {
    const entries = await fs.readdir(REVIEWS_DIR)
    const pulls = entries
        .filter((f) => f.startsWith("pull-") && f.endsWith(".json"))
        .sort()
    if (!pulls.length)
        throw new Error(
            `No snapshots in ${REVIEWS_DIR}. Run: yarn tsx devTools/pullAgenticWriting.ts --branch data-nuggets`
        )
    return path.join(REVIEWS_DIR, pulls[pulls.length - 1])
}

interface Entry {
    lineageKey: string
    localId: string
    slugs: string[]
    structure: string
    title: string
    description: string
    decisions: { decision: Decision; comment: string }[]
    escalated: boolean
}

function collect(snapshot: Snapshot): Entry[] {
    const entries: Entry[] = []
    for (const lineage of snapshot.lineages) {
        const decisionVersions = (lineage.versions ?? []).filter(
            (v) => v.kind === "decision" && v.review?.decision
        )
        if (!decisionVersions.length) continue

        const latest = decisionVersions[decisionVersions.length - 1]
        const views = latest.payload?.grapherViews ?? []
        const decisions = decisionVersions
            .map((v) => ({
                decision: v.review!.decision,
                comment: (v.review!.comment ?? "").trim(),
            }))
            .filter((d) => d.comment && !isContentFree(d.comment))

        entries.push({
            lineageKey: lineage.lineageKey,
            localId: latest.localId ?? "",
            slugs: [
                ...new Set(views.map((v) => v.slug).filter(Boolean)),
            ] as string[],
            structure: describeStructure(views),
            title: latest.title ?? "",
            description: latest.description ?? "",
            decisions,
            escalated:
                decisionVersions.length > 1 &&
                decisionVersions[decisionVersions.length - 1].review!
                    .decision === "rejected",
        })
    }
    return entries
}

function render(snapshot: Snapshot, entries: Entry[]): string {
    const counts = { approved: 0, rejected: 0, request_revisions: 0 }
    for (const e of entries) {
        const last = e.decisions[e.decisions.length - 1]
        // An entry whose only comments were content-free still has a decision
        // on the lineage; fall back to the escalation flag.
        const decision: Decision = last
            ? last.decision
            : e.escalated
              ? "rejected"
              : "request_revisions"
        counts[decision]++
    }
    const decided = entries.length
    const out: string[] = []

    out.push("# Nugget review ledger")
    out.push("")
    out.push(
        "Every reviewed data nugget, with the reviewer's verdict and comment in full. Generated by `devTools/buildReviewLedger.ts` from the newest snapshot in `data-nuggets/reviews/` — **do not edit by hand**."
    )
    out.push("")
    out.push(
        `Built from a snapshot of \`${snapshot.source}\` pulled ${snapshot.pulledAt} · ${decided} reviewed nuggets · ${counts.approved} approved, ${counts.request_revisions} awaiting revision, ${counts.rejected} rejected.`
    )
    out.push("")
    out.push("## How to use this")
    out.push("")
    out.push(
        "**These are precedents, not rules.** A comment here is one reviewer's judgment about one nugget. Read it as a prediction of what they might say about yours, then decide whether the objection actually applies. If you think it doesn't, proceed — and say why."
    )
    out.push("")
    out.push("Read, in order of usefulness:")
    out.push("")
    out.push(
        "1. **Every entry under the chart slug you're working on.** This is the strongest signal by far — much of the feedback is specific to an indicator (how to handle an index, which comparison groups are meaningful for this metric, what counts as common knowledge in this domain)."
    )
    out.push(
        "2. **Every entry sharing your structure** (see the index below) — multi-chart pairings especially, which have their own recurring objections."
    )
    out.push(
        "3. **The rest**, if the ledger is still short enough to read in one pass. Once it isn't, retrieve by slug and structure first and sample the remainder."
    )
    out.push("")
    if (counts.approved === 0) {
        out.push(
            "⚠️ **Nothing in this corpus has been approved yet.** Every entry is a criticism, which makes the ledger systematically misleading in one direction: the absence of an approved example of some framing is *not* evidence against it, and a nugget resembling a rejected one is not thereby doomed. Don't let an all-negative corpus make you timid — use it to anticipate objections, not to narrow what you attempt."
        )
        out.push("")
    }
    out.push(
        "An **escalated** entry (revisions requested, then rejected on a second pass) is the strongest signal in the corpus: feedback did not rescue it, so the underlying idea was unsalvageable rather than badly written."
    )
    out.push("")

    // Structure index — the second retrieval axis, cheap to scan.
    out.push("## Index by structure")
    out.push("")
    const byStructure = new Map<string, Entry[]>()
    for (const e of entries) {
        const k = e.structure.startsWith("multi-chart")
            ? "multi-chart"
            : e.structure
        if (!byStructure.has(k)) byStructure.set(k, [])
        byStructure.get(k)!.push(e)
    }
    for (const [structure, group] of [...byStructure.entries()].sort(
        (a, b) => b[1].length - a[1].length
    )) {
        out.push(
            `- **${structure}** (${group.length}): ${group.map((e) => `"${e.title}"`).join("; ")}`
        )
    }
    out.push("")

    // Primary grouping: chart slug.
    out.push("## Reviews by chart")
    out.push("")
    const bySlug = new Map<string, Entry[]>()
    for (const e of entries) {
        for (const slug of e.slugs.length ? e.slugs : ["(unknown)"]) {
            if (!bySlug.has(slug)) bySlug.set(slug, [])
            bySlug.get(slug)!.push(e)
        }
    }
    for (const slug of [...bySlug.keys()].sort()) {
        out.push(`### ${slug}`)
        out.push("")
        for (const e of bySlug.get(slug)!) {
            const last = e.decisions[e.decisions.length - 1]
            const verdict = e.escalated
                ? "rejected (escalated)"
                : (last?.decision ?? "reviewed")
            out.push(`#### "${e.title}" — ${verdict}`)
            out.push("")
            out.push(
                `\`${e.structure}\` · charts: ${e.slugs.join(", ") || "—"} · \`${e.lineageKey}\``
            )
            out.push("")
            out.push(`> ${e.description}`)
            out.push("")
            for (const d of e.decisions) {
                out.push(`**Reviewer (${d.decision}):**`)
                out.push("")
                // Trailing whitespace is common in pasted review comments and is
                // pure noise in the ledger.
                for (const line of d.comment.split("\n"))
                    out.push(line.trimEnd())
                out.push("")
            }
        }
    }

    return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n"
}

async function main(): Promise<void> {
    const argv = await yargs(hideBin(process.argv))
        .option("snapshot", {
            type: "string",
            describe:
                "Snapshot to build from. Defaults to the newest data-nuggets/reviews/pull-*.json",
        })
        .option("out", {
            type: "string",
            describe: `Output path (${OUT_PATH})`,
        })
        .strict()
        .help().argv

    const snapshotPath = argv.snapshot ?? (await newestSnapshot())
    const snapshot = JSON.parse(
        await fs.readFile(snapshotPath, "utf8")
    ) as Snapshot
    const entries = collect(snapshot)
    if (!entries.length)
        throw new Error(
            `No decisions found in ${snapshotPath}. Note the review fields are nested under version.review — a parse looking for a flat reviewDecision finds nothing.`
        )

    const outPath = argv.out ?? OUT_PATH
    await fs.writeFile(outPath, render(snapshot, entries))
    console.log(
        `Wrote ${entries.length} reviewed nuggets from ${snapshotPath} to ${outPath}`
    )
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(-1)
})
