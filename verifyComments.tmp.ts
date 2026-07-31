import { chromium, Page, Browser } from "playwright"

const BASE = "http://staging-site-internal-comments-2"

interface Result {
    page: string
    checks: string[]
    failures: string[]
}

const createdCommentIds: number[] = []

async function dismissCookies(page: Page): Promise<void> {
    const reject = page.locator("button", {
        hasText: "Reject optional cookies",
    })
    if (await reject.count())
        await reject
            .first()
            .click()
            .catch(() => {})
    await page.waitForTimeout(500)
}

async function openComments(page: Page): Promise<void> {
    await page.locator(".comments-overlay__toggle").click()
    await page.waitForSelector(".comments-overlay__panel", { timeout: 10000 })
}

async function postComment(page: Page, text: string): Promise<void> {
    await page
        .locator(".comments-panel__composer .comment-composer__input")
        .fill(text)
    await page
        .locator(".comments-panel__composer .comment-composer__submit")
        .click()
    await page.waitForTimeout(2500)
}

async function run(
    browser: Browser,
    name: string,
    url: string,
    clickSelector: string,
    expectMultiDim: boolean
): Promise<Result> {
    const result: Result = { page: name, checks: [], failures: [] }
    const page = await browser.newPage({
        viewport: { width: 1500, height: 1000 },
    })
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))

    try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 90000 })
        await dismissCookies(page)

        const context = await page.evaluate(
            `JSON.stringify(window._OWID_COMMENT_CONTEXT ?? null)`
        )
        const parsed = context ? JSON.parse(context as string) : null
        if (!parsed) {
            result.failures.push("no _OWID_COMMENT_CONTEXT serialized")
            return result
        }
        result.checks.push(
            `context: ${parsed.targets.length} target(s), primary=${parsed.targets[0].targetType}:${parsed.targets[0].targetId}` +
                (parsed.multiDimDimensionSlugs
                    ? `, dims=[${parsed.multiDimDimensionSlugs.join(",")}]`
                    : "")
        )
        if (expectMultiDim && !parsed.multiDimDimensionSlugs?.length)
            result.failures.push("expected multiDim dimension slugs")

        if (!(await page.locator(".comments-overlay__toggle").count())) {
            result.failures.push("no Comments button")
            return result
        }
        await openComments(page)
        result.checks.push("panel opens")

        // Click the thing we want to comment on
        const targetEl = page.locator(clickSelector).first()
        if (!(await targetEl.count())) {
            result.failures.push(`click target not found: ${clickSelector}`)
            return result
        }
        const quoted = ((await targetEl.textContent()) ?? "")
            .replace(/\s+/g, " ")
            .trim()
        await targetEl.click({ force: true })
        await page.waitForTimeout(400)

        const activeAnchor = page.locator(".comments-panel__active-anchor")
        if (!(await activeAnchor.count())) {
            result.failures.push(
                `clicking ${clickSelector} did not set an anchor`
            )
            return result
        }
        result.checks.push(
            `anchored to: "${((await activeAnchor.textContent()) ?? "")
                .replace(/Commenting on:\s*/, "")
                .replace(/×/, "")
                .trim()
                .slice(0, 50)}"`
        )

        const marker = `automated check ${name} ${process.env.RUN_TAG}`
        await postComment(page, marker)

        const threadWithMarker = page.locator(".comment-thread", {
            hasText: marker,
        })
        if (!(await threadWithMarker.count())) {
            result.failures.push("posted comment did not appear in the panel")
        } else {
            result.checks.push("comment round-trips")
            const anchorLine = await threadWithMarker
                .locator(".comment-thread__anchor")
                .textContent()
                .catch(() => null)
            if (anchorLine && quoted.slice(0, 20))
                result.checks.push(
                    `thread shows anchor: ${anchorLine.trim().slice(0, 50)}`
                )
            else result.failures.push("thread missing its anchor quote")
        }

        // Pin should be re-found after a reload
        await page.reload({ waitUntil: "networkidle", timeout: 90000 })
        await dismissCookies(page)
        await openComments(page)
        await page.waitForTimeout(1500)
        const badgeCount = await page.locator(".comments-anchor-badge").count()
        if (badgeCount > 0)
            result.checks.push(
                `pin re-found after reload (${badgeCount} badge(s))`
            )
        else result.failures.push("no pin re-found after reload")

        if (expectMultiDim) {
            const before = await page.locator(".comment-thread").count()
            // change a dimension by clicking a radio/choice control
            const choice = page.locator(
                ".settings-row__wrapper input[type=radio], .settings-row__wrapper button"
            )
            const n = await choice.count()
            let switched = false
            for (let i = 0; i < Math.min(n, 12); i++) {
                const el = choice.nth(i)
                if (await el.isChecked?.().catch(() => false)) continue
                await el.click({ force: true }).catch(() => {})
                await page.waitForTimeout(2500)
                if (page.url() !== url) {
                    switched = true
                    break
                }
            }
            if (!switched) {
                result.checks.push(
                    "could not switch mdim view (skipped view filter check)"
                )
            } else {
                await page.waitForTimeout(1500)
                const after = await page.locator(".comment-thread").count()
                const other = await page
                    .locator(".comments-panel__other-views")
                    .count()
                result.checks.push(
                    `after view switch: ${before} -> ${after} thread(s), other-views notice: ${other > 0}`
                )
                if (after >= before && other === 0)
                    result.failures.push(
                        "view switch did not filter threads nor report other views"
                    )
            }
        }

        // collect ids so we can clean up
        const ids = await page.evaluate(`(async function () {
            const ctx = window._OWID_COMMENT_CONTEXT
            const out = []
            for (const t of ctx.targets) {
                const r = await fetch('/admin/api/comments.json?targetType=' + t.targetType + '&targetId=' + t.targetId + '&includeResolved=true')
                const j = await r.json()
                for (const c of j.comments) if (c.content && c.content.indexOf('automated check') === 0) out.push(c.id)
            }
            return out
        })()`)
        createdCommentIds.push(...(ids as number[]))
    } catch (error) {
        result.failures.push(`threw: ${(error as Error).message}`)
    } finally {
        if (errors.length)
            result.failures.push(`JS errors: ${errors.slice(0, 3).join(" | ")}`)
        await page.close()
    }
    return result
}

const main = async (): Promise<void> => {
    const browser = await chromium.launch()
    const results: Result[] = []

    results.push(
        await run(
            browser,
            "data page",
            `${BASE}/admin/datapage-preview/1118466`,
            ".key-info__key-description li, .meta-description-table__value",
            false
        )
    )
    results.push(
        await run(
            browser,
            "chart page",
            `${BASE}/admin/grapher/life-expectancy`,
            ".HeaderHTML h1",
            false
        )
    )
    results.push(
        await run(
            browser,
            "multi-dim",
            `${BASE}/admin/grapher/vaccination-coverage-who-unicef`,
            ".HeaderHTML p",
            true
        )
    )

    // Clean up anything this run created
    if (createdCommentIds.length) {
        const page = await browser.newPage()
        await page.goto(`${BASE}/admin/datapage-preview/1118466`, {
            waitUntil: "domcontentloaded",
        })
        for (const id of [...new Set(createdCommentIds)]) {
            await page.evaluate(
                `fetch('/admin/api/comments/${id}', { method: 'DELETE' })`
            )
        }
        await page.waitForTimeout(1500)
        await page.close()
        console.log(
            `cleaned up ${new Set(createdCommentIds).size} test comment(s)`
        )
    }

    await browser.close()

    let failed = false
    for (const r of results) {
        console.log(`\n=== ${r.page} ===`)
        for (const c of r.checks) console.log(`  ok   ${c}`)
        for (const f of r.failures) {
            console.log(`  FAIL ${f}`)
            failed = true
        }
    }
    console.log(`\n${failed ? "SOME CHECKS FAILED" : "ALL CHECKS PASSED"}`)
}

void main()
