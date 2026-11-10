/**
 * DARK MODE PROTOTYPE — palette lab at /dark-mode-palettes
 *
 * Shows every named Grapher color scheme, plus a sample of real
 * author-entered map colors from the database, three ways:
 *   1. on white (today)
 *   2. on dark, unchanged (what proposal B would give you)
 *   3. on dark, adapted by the proposal C rules in ChartTheme.ts
 */

import * as R from "remeda"
import { ColorSchemeName } from "@ourworldindata/types"
import { ColorSchemes } from "@ourworldindata/grapher"
import {
    adaptCategoricalColorForDark,
    adaptRampForDark,
    describeRampStrategy,
    DARK_CHART_BACKGROUND,
} from "../packages/@ourworldindata/grapher/src/color/ChartTheme.js"
import { color as d3color } from "d3-color"
import * as db from "../db/db.js"

const escape = (s: string): string =>
    s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

const isValidColor = (c: unknown): c is string =>
    typeof c === "string" && d3color(c) !== null

function swatches(colors: string[]): string {
    return `<div class="swatches">${colors
        .map(
            (c) =>
                `<span class="swatch" style="background:${c}" title="${c}"></span>`
        )
        .join("")}</div>`
}

interface Row {
    name: string
    note?: string
    colors: string[]
    categorical: boolean
}

function renderRow(row: Row): string {
    const adapted = row.categorical
        ? row.colors.map(adaptCategoricalColorForDark)
        : adaptRampForDark(row.colors)
    const rule = row.categorical
        ? "lift lightness"
        : describeRampStrategy(row.colors)
    const kind = row.categorical ? "categorical" : "ordered"
    return `<tr>
        <th scope="row"><div class="name">${escape(row.name)}</div>
            <div class="meta">${escape(kind)} · ${escape(rule)}</div>
            ${row.note ? `<div class="meta">${escape(row.note)}</div>` : ""}</th>
        <td class="light">${swatches(row.colors)}</td>
        <td class="dark">${swatches(row.colors)}</td>
        <td class="dark">${swatches(adapted)}</td>
    </tr>`
}

function renderTable(title: string, intro: string, rows: Row[]): string {
    return `<section>
        <h2>${escape(title)}</h2>
        <p class="intro">${intro}</p>
        <table>
            <thead><tr>
                <th></th>
                <th>Light (today)</th>
                <th>Dark, unchanged</th>
                <th>Dark, adapted (proposal C)</th>
            </tr></thead>
            <tbody>${rows.map(renderRow).join("")}</tbody>
        </table>
    </section>`
}

export async function renderDarkModePalettesPage(
    knex: db.KnexReadonlyTransaction
): Promise<string> {
    const schemeRows: Row[] = Object.values(ColorSchemeName).map((name) => {
        const scheme = ColorSchemes.get(name)
        const categorical = scheme.isDistinct || !!scheme.colorMap
        const colors = categorical
            ? scheme.colorMap
                ? Object.values(scheme.colorMap)
                : (R.last(scheme.colorSets.filter(Boolean)) ?? [])
            : scheme.getColors(7)
        return {
            name: scheme.name,
            colors: colors.slice(0, 12),
            categorical,
        }
    })

    const customMapColors = await db.knexRaw<{
        slug: string
        colors: string
    }>(
        knex,
        `-- sql
        SELECT cc.slug, cc.config->>'$.map.colorScale.customNumericColors' AS colors
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE cc.config->>'$.isPublished' = 'true'
          AND cc.config->>'$.map.colorScale.customNumericColorsActive' = 'true'
        ORDER BY c.id DESC
        LIMIT 200`
    )
    const customRows: Row[] = customMapColors
        .map((r) => ({ slug: r.slug, colors: (JSON.parse(r.colors ?? "[]") ?? []) as unknown[] }))
        .filter((r) => r.colors.length >= 3 && r.colors.every(isValidColor))
        .slice(0, 40)
        .map((r) => ({
            name: r.slug,
            note: "custom map bins",
            colors: r.colors as string[],
            categorical: false,
        }))

    const entityColors = await db.knexRaw<{ slug: string; colors: string }>(
        knex,
        `-- sql
        SELECT cc.slug, cc.config->>'$.selectedEntityColors' AS colors
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE cc.config->>'$.isPublished' = 'true'
          AND JSON_LENGTH(cc.config->'$.selectedEntityColors') >= 3
        ORDER BY c.id DESC
        LIMIT 25`
    )
    const entityRows: Row[] = entityColors.map((r) => ({
        name: r.slug,
        note: "selectedEntityColors",
        colors: Object.values(
            (JSON.parse(r.colors ?? "{}") ?? {}) as Record<string, unknown>
        ).filter(isValidColor),
        categorical: true,
    }))

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dark mode palette lab</title>
<style>
    :root { --dark: ${DARK_CHART_BACKGROUND}; }
    body { margin: 0; font: 14px/1.45 Lato, system-ui, sans-serif; color: #1d3d63; background: #f0f4fa; }
    main { max-width: 1200px; margin: 0 auto; padding: 32px 16px 80px; }
    h1 { font: 700 32px/1.2 "Playfair Display", Georgia, serif; margin: 0 0 8px; }
    h2 { font-size: 20px; margin: 40px 0 4px; }
    .intro, .lede { max-width: 760px; color: #426591; }
    .rules { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 20px 0; }
    .rule { background: #fff; border-radius: 8px; padding: 12px 14px; }
    .rule b { display: block; margin-bottom: 2px; }
    table { width: 100%; border-collapse: separate; border-spacing: 0 6px; }
    thead th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #577291; padding: 0 12px; }
    tbody th { text-align: left; font-weight: 400; width: 24%; padding: 8px 12px; background: #fff; border-radius: 8px 0 0 8px; vertical-align: middle; }
    .name { font-weight: 700; word-break: break-word; }
    .meta { font-size: 12px; color: #577291; }
    td { padding: 12px; vertical-align: middle; }
    td.light { background: #fff; }
    td.dark { background: var(--dark); }
    td:last-child { border-radius: 0 8px 8px 0; }
    .swatches { display: flex; flex-wrap: wrap; gap: 3px; }
    .swatch { width: 22px; height: 22px; border-radius: 3px; }
    @media (max-width: 760px) { tbody th { width: auto; } .swatch { width: 14px; height: 14px; } }
</style>
</head>
<body>
<main>
    <h1>Dark mode palette lab</h1>
    <p class="lede">Every named Grapher color scheme, and a sample of real author-entered colors from the local database, adapted by the proposal C rules (<code>packages/@ourworldindata/grapher/src/color/ChartTheme.ts</code>). The rules work in OKLCH color space: hue is never changed, only lightness (and chroma when needed to stay in gamut).</p>
    <div class="rules">
        <div class="rule"><b>Categorical</b>Lightness lifted into a band that reads on dark; the lightness order between colors is kept.</div>
        <div class="rule"><b>Single-hue sequential</b>"More = darker" on white becomes "more = lighter" on dark (lightness mirrored).</div>
        <div class="rule"><b>Multi-hue sequential</b>Run backwards (dark navy low end → bright yellow high end), because mirroring would turn yellows into olive.</div>
        <div class="rule"><b>Already dark → light</b>Viridis, magma and similar keep their order; only the darkest end is lifted.</div>
        <div class="rule"><b>Diverging</b>Neutral midpoint becomes dark (least prominent), extremes become light; hues stay on their side.</div>
    </div>
    ${renderTable("Named color schemes", "Sequential schemes shown with 7 bins.", schemeRows)}
    ${renderTable("Custom map bins from real charts", "Published charts with <code>customNumericColorsActive</code>, newest first.", customRows)}
    ${renderTable("Custom entity colors from real charts", "Published charts with three or more <code>selectedEntityColors</code>.", entityRows)}
</main>
</body>
</html>`
}
