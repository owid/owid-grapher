import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"
import { GRAY_50 } from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { ColorScheme } from "./constants.js"
import { ORGANIZATION_GROUPS, getOrganizationGroup } from "./organizations.js"

interface SchemeDefinition {
    label: string
    /** Legend intro, e.g. "The color shows the domain of the AI system" */
    legendTitle: string
    groups: readonly string[]
    colors: Record<string, string>
}

export const DOMAIN_GROUPS = [
    "Language",
    "Vision",
    "Drawing",
    "Games",
    "Science",
    "Other",
] as const

/**
 * Epoch tags a model with every domain it touches ("Multimodal,Language,
 * Vision"). We show one, picking the most distinctive: a model that plays
 * games or does science is better described by that than by "Language".
 */
const DOMAIN_PRIORITY: {
    group: (typeof DOMAIN_GROUPS)[number]
    tags: string[]
}[] = [
    { group: "Games", tags: ["Games"] },
    {
        group: "Science",
        tags: [
            "Biology",
            "Medicine",
            "Earth science",
            "Materials science",
            "Mathematics",
        ],
    },
    { group: "Drawing", tags: ["Image generation", "Video"] },
    { group: "Language", tags: ["Language", "Multimodal"] },
    { group: "Vision", tags: ["Vision"] },
]

export function getDomainGroup(
    domain: string | null
): (typeof DOMAIN_GROUPS)[number] {
    const tags = splitList(domain)
    for (const { group, tags: groupTags } of DOMAIN_PRIORITY)
        if (tags.some((tag) => groupTags.includes(tag))) return group
    return "Other"
}

export const SECTOR_GROUPS = [
    "Industry",
    "Academia",
    "Industry–academia collaboration",
    "Other",
] as const

/** From Epoch's per-organization categorization (Industry, Academia, …) */
export function getSectorGroup(
    organizationCategory: string | null
): (typeof SECTOR_GROUPS)[number] {
    const categories = new Set(splitList(organizationCategory))
    const hasIndustry = categories.has("Industry")
    const hasAcademia = categories.has("Academia")
    if (hasIndustry && hasAcademia) return "Industry–academia collaboration"
    if (hasIndustry) return "Industry"
    if (hasAcademia) return "Academia"
    return "Other"
}

export function splitList(value: string | null): string[] {
    if (!value) return []
    return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
}

export const COLOR_SCHEME_DEFINITIONS: Record<ColorScheme, SchemeDefinition> = {
    organization: {
        label: "Developer",
        legendTitle: "The color shows who developed the AI system:",
        groups: ORGANIZATION_GROUPS,
        colors: {
            OpenAI: OwidDistinctColors.TealishGreen,
            Google: OwidDistinctColors.Blue,
            Meta: OwidDistinctColors.Purple,
            Anthropic: OwidDistinctColors.DarkOrange,
            Microsoft: OwidDistinctColors.Turquoise,
            xAI: OwidDistinctColors.MidnightBlue,
            Nvidia: OwidDistinctColors.Lime,
            "Chinese AI labs": OwidDistinctColors.Coral,
            "Other companies": OwidDistinctColors.Camel,
            "Academia & others": GRAY_50,
        },
    },
    domain: {
        label: "Domain",
        legendTitle: "The color shows the domain of the AI system:",
        groups: DOMAIN_GROUPS,
        colors: {
            Language: OwidDistinctColors.MidnightBlue,
            Vision: OwidDistinctColors.Cherry,
            Drawing: OwidDistinctColors.Peach,
            Games: OwidDistinctColors.OliveGreen,
            Science: OwidDistinctColors.Teal,
            Other: OwidDistinctColors.Mauve,
        },
    },
    sector: {
        label: "Sector",
        legendTitle: "The color shows where the AI system was developed:",
        groups: SECTOR_GROUPS,
        colors: {
            Industry: OwidDistinctColors.Blue,
            Academia: OwidDistinctColors.DarkOrange,
            "Industry–academia collaboration": OwidDistinctColors.Mauve,
            Other: GRAY_50,
        },
    },
}

export function getGroupColor(scheme: ColorScheme, group: string): string {
    return COLOR_SCHEME_DEFINITIONS[scheme].colors[group] ?? GRAY_50
}

export function getModelGroups(
    organization: string | null,
    organizationCategory: string | null,
    domain: string | null
): Record<ColorScheme, string> {
    return {
        organization: getOrganizationGroup(organization, organizationCategory),
        domain: getDomainGroup(domain),
        sector: getSectorGroup(organizationCategory),
    }
}
