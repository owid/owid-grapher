import fs from "fs-extra"
import path from "path"

// A/B test configuration for chart descriptions
// Groups:
// - no_change: Don't generate or show the description, don't show download section
// - hidden_alt_text: Generate and include in HTML but hide from user (for measuring impact on SEO/accessibility)
// - visible_alt_text: Generate and show to user
// - download_button: Show download section on data page

export type ChartDescriptionExperimentGroup =
    | "no_change"
    | "hidden_alt_text"
    | "visible_alt_text"
    | "download_button"

let CHART_DESCRIPTION_AB_TEST: Record<
    string,
    ChartDescriptionExperimentGroup
> | null = null

function loadAbTestConfig(): Record<string, ChartDescriptionExperimentGroup> {
    if (CHART_DESCRIPTION_AB_TEST !== null) {
        return CHART_DESCRIPTION_AB_TEST
    }

    const csvPath = path.join(__dirname, "chartDescriptionAbTest.csv")
    const csvContent = fs.readFileSync(csvPath, "utf-8")
    const lines = csvContent.trim().split("\n")
    const config: Record<string, ChartDescriptionExperimentGroup> = {}

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const [slug, group] = lines[i].split(",")
        if (slug && group) {
            config[slug.trim()] =
                group.trim() as ChartDescriptionExperimentGroup
        }
    }

    CHART_DESCRIPTION_AB_TEST = config
    return config
}

export function getChartDescriptionExperimentGroup(
    slug: string | undefined
): ChartDescriptionExperimentGroup | undefined {
    if (!slug) return undefined
    const config = loadAbTestConfig()
    return config[slug]
}

export function shouldFetchChartDescription(slug: string | undefined): boolean {
    const group = getChartDescriptionExperimentGroup(slug)
    return group === "hidden_alt_text" || group === "visible_alt_text"
}

export function shouldShowChartDescription(slug: string | undefined): boolean {
    const group = getChartDescriptionExperimentGroup(slug)
    return group === "visible_alt_text"
}

export function shouldShowDownloadSection(slug: string | undefined): boolean {
    const group = getChartDescriptionExperimentGroup(slug)
    // Show download section by default, unless chart is in A/B test and not in download_button group
    // - no_change: Don't show download section
    // - hidden_alt_text: Don't show download section (only chart description)
    // - visible_alt_text: Don't show download section (only chart description)
    // - download_button: Show download section
    // - undefined (not in test): Show download section (default behavior)
    return group === "download_button" || group === undefined
}
