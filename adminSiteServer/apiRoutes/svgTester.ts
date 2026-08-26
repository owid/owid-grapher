import fs from "fs-extra"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"
import { Request, Response } from "express"
import {
    SVG_TESTER_SUITES,
    SVG_TESTER_DIRECTORIES,
    SvgTesterDirectory,
    SvgTesterSuite,
    SvgTesterSuiteOverview,
    SvgTesterSuiteStatus,
    SVG_TESTER_VERIFY_RESULTS_FILENAME,
    SvgTesterVerifyRunOverview,
    SvgTesterVerifyRunSummary,
} from "@ourworldindata/types"
import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"

const execFileAsync = promisify(execFile)

function suiteDir(suite: SvgTesterSuite): string {
    return path.join(SVG_TESTER_REPO_PATH, suite)
}

function parseSuite(value: string): SvgTesterSuite | undefined {
    return SVG_TESTER_SUITES.find((suite) => suite === value)
}

function parseKind(value: string): SvgTesterDirectory | undefined {
    return SVG_TESTER_DIRECTORIES.find((kind) => kind === value)
}

async function headCommit(cwd?: string): Promise<string | null> {
    try {
        const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
            cwd,
            encoding: "utf-8",
        })
        return stdout.trim()
    } catch {
        return null
    }
}

/** Subject line of a commit, or null when it isn't in this checkout's history */
async function commitSubject(commit: string | null): Promise<string | null> {
    // The sha comes out of a file on disk, so don't hand git anything shaped
    // like an option or a revision range.
    if (!commit || !/^[0-9a-f]{7,40}$/i.test(commit)) return null
    try {
        const { stdout } = await execFileAsync(
            "git",
            ["log", "-1", "--format=%s", commit, "--"],
            { encoding: "utf-8" }
        )
        return stdout.trim() || null
    } catch {
        return null
    }
}

async function readResults(suite: SvgTesterSuite): Promise<{
    results: SvgTesterVerifyRunSummary | null
    isUnreadable: boolean
}> {
    const file = path.join(suiteDir(suite), SVG_TESTER_VERIFY_RESULTS_FILENAME)
    let raw: string
    try {
        raw = await fs.readFile(file, "utf-8")
    } catch {
        // No file at all: this suite was never run on this machine.
        return { results: null, isUnreadable: false }
    }
    try {
        return {
            results: JSON.parse(raw) as SvgTesterVerifyRunSummary,
            isUnreadable: false,
        }
    } catch {
        // The writer can be killed mid-write, so a truncated file is plausible
        // and is its own state rather than "absent".
        return { results: null, isUnreadable: true }
    }
}

function toOverview(
    results: SvgTesterVerifyRunSummary | null
): SvgTesterVerifyRunOverview | null {
    if (!results) return null
    const { differences: _differences, errors: _errors, ...overview } = results
    return overview
}

export async function getSvgTesterSuites(): Promise<{
    suites: SvgTesterSuiteOverview[]
}> {
    const grapherHead = await headCommit()

    const suites = await Promise.all(
        SVG_TESTER_SUITES.map(async (suite) => {
            const { results, isUnreadable } = await readResults(suite)
            const isStale = Boolean(
                results?.grapherCommit &&
                grapherHead &&
                results.grapherCommit !== grapherHead
            )
            const grapherCommitSubject = await commitSubject(
                results?.grapherCommit ?? null
            )
            return {
                suite,
                results: toOverview(results),
                grapherCommitSubject,
                isStale,
                isUnreadable,
            }
        })
    )

    return { suites }
}

export async function getSvgTesterResults(
    req: Request
): Promise<SvgTesterSuiteStatus> {
    const suite = parseSuite(req.params.suite)
    if (!suite) throw new Error(`Unknown test suite: ${req.params.suite}`)

    const { results, isUnreadable } = await readResults(suite)
    const grapherHead = await headCommit()
    const isStale = Boolean(
        results?.grapherCommit &&
        grapherHead &&
        results.grapherCommit !== grapherHead
    )

    const grapherCommitSubject = await commitSubject(
        results?.grapherCommit ?? null
    )

    return { suite, results, grapherCommitSubject, isStale, isUnreadable }
}

/** Serve one SVG out of the svgs checkout */
export function resolveSvgPath(
    suite: string,
    kind: string,
    filename: string
): string | null {
    const parsedSuite = parseSuite(suite)
    const parsedKind = parseKind(kind)

    const isSafeBasename =
        filename.endsWith(".svg") &&
        !filename.startsWith(".") &&
        !/[/\\]/.test(filename)

    if (!parsedSuite || !parsedKind || !isSafeBasename) return null

    const dir = path.resolve(suiteDir(parsedSuite), parsedKind)
    const file = path.resolve(dir, filename)

    return file.startsWith(dir + path.sep) ? file : null
}

export async function getSvgTesterSvg(
    req: Request,
    res: Response
): Promise<void> {
    const file = resolveSvgPath(
        req.params.suite,
        req.params.kind,
        req.params.filename
    )

    if (!file || !(await fs.pathExists(file))) {
        res.status(404).end()
        return
    }

    res.type("image/svg+xml")
    res.setHeader("Cache-Control", "no-cache")
    res.sendFile(file)
}
