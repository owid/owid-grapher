import { useContext, useEffect, useState } from "react"
import {
    COMPONENT_USAGE_LABELS,
    ComponentUsage,
    ComponentUsageLabel,
    OwidGdocType,
} from "@ourworldindata/types"
import { getCanonicalPath } from "@ourworldindata/components"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { AdminAppContext } from "./AdminAppContext.js"

/**
 * Non-component helpers behind the live half of the writing reference UI:
 * data fetching and the qualitative wording layer — computed facts presented
 * as words first, raw numbers only in tooltips.
 */

/** Fetch an admin API JSON path; undefined while loading, null on failure. */
export function useAdminJson<T>(
    path: string | undefined
): T | undefined | null {
    const { admin } = useContext(AdminAppContext)
    const [result, setResult] = useState<T | undefined | null>(undefined)
    useEffect(() => {
        if (!path) return
        let cancelled = false
        setResult(undefined)
        admin
            .getJSON(path)
            // getJSON's Json constraint rejects named interfaces (they lack
            // an implicit index signature); the cast is as safe as any other
            // typed API response.
            .then((json) => {
                if (!cancelled) setResult(json as unknown as T)
            })
            .catch(() => {
                if (!cancelled) setResult(null)
            })
        return () => {
            cancelled = true
        }
    }, [admin, path])
    return path ? result : undefined
}

// Component docs live as .md sidecars in the repo, gated by CI; the reference
// links technical editors to GitHub to propose changes or read definitions.
const GITHUB_REPO = "https://github.com/owid/owid-grapher"
export const githubEditUrl = (sidecarFile: string): string =>
    `${GITHUB_REPO}/edit/master/${sidecarFile}`
export const githubBlobUrl = (sourceFile: string): string =>
    `${GITHUB_REPO}/blob/master/${sourceFile}`

const DOC_TYPE_NOUNS: Partial<Record<OwidGdocType, [string, string]>> = {
    [OwidGdocType.Article]: ["article", "articles"],
    [OwidGdocType.DataInsight]: ["data insight", "data insights"],
    [OwidGdocType.TopicPage]: ["topic page", "topic pages"],
    [OwidGdocType.LinearTopicPage]: ["linear topic page", "linear topic pages"],
    [OwidGdocType.Fragment]: ["fragment", "fragments"],
    [OwidGdocType.AboutPage]: ["about page", "about pages"],
    [OwidGdocType.Announcement]: ["announcement", "announcements"],
    [OwidGdocType.Author]: ["author page", "author pages"],
    [OwidGdocType.Profile]: ["profile", "profiles"],
    [OwidGdocType.Homepage]: ["homepage", "homepage"],
}

export function docTypeNoun(docType: OwidGdocType, plural: boolean): string {
    const nouns = DOC_TYPE_NOUNS[docType]
    if (!nouns) return docType
    return plural ? nouns[1] : nouns[0]
}

// The doc types authors actually choose between — the where-it's-used bar
// always accounts for these; marginal types only appear when a component is
// used there.
export const MAJOR_DOC_TYPES: OwidGdocType[] = [
    OwidGdocType.Article,
    OwidGdocType.DataInsight,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
]

export function joinWithAnd(parts: string[]): string {
    if (parts.length <= 1) return parts[0] ?? ""
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
}

export function indefinite(noun: string): string {
    return (/^[aeiou]/.test(noun) ? "an " : "a ") + noun
}

/**
 * The one visual frequency vocabulary: every adoption label maps to a number
 * of filled dots on the four-dot glyph. Synthetic "new" forms render the
 * glyph dashed instead.
 */
export const FREQUENCY_DOTS: Record<ComponentUsageLabel, number> = {
    standard: 4,
    common: 3,
    occasional: 2,
    rare: 1,
    unused: 0,
}

/**
 * Fraction → qualitative label, the same thresholds the server applies for
 * per-doc-type usage — reused client-side for form frequency (share of a
 * component's uses) and per-prop adoption, so one vocabulary reads the same
 * everywhere.
 */
export function fractionUsageLabel(
    count: number,
    total: number
): ComponentUsageLabel {
    const fraction = total > 0 ? count / total : 0
    if (fraction >= 0.4) return "standard"
    if (fraction >= 0.1) return "common"
    if (fraction >= 0.02) return "occasional"
    if (count > 0) return "rare"
    return "unused"
}

/** The component's overall adoption: its best label across doc types. */
export function overallUsageLabel(
    usage: ComponentUsage | undefined
): ComponentUsageLabel {
    let best = COMPONENT_USAGE_LABELS.length - 1
    for (const entry of usage?.byDocType ?? []) {
        const index = COMPONENT_USAGE_LABELS.indexOf(entry.label)
        if (index >= 0 && index < best) best = index
    }
    return COMPONENT_USAGE_LABELS[best]
}

/** Raw numbers behind a glyph — tooltip material, never the lead. */
export function usageTooltip(usage: ComponentUsage | undefined): string {
    if (!usage) return "No published uses"
    return usage.byDocType
        .map(
            (entry) =>
                `${entry.docsUsingIt} of ${entry.totalDocs} ${docTypeNoun(
                    entry.docType,
                    entry.totalDocs === 1 ? false : true
                )}`
        )
        .join(" · ")
}

/**
 * Fallback label for an observed form no sidecar example has named yet:
 * "caption+size:narrow" → "with caption, size: narrow". "" is the standard
 * form — what remains once required props and defaults are folded away.
 */
export function humanizeVariation(signature: string): string {
    if (signature === "") return "the standard form"
    return signature
        .split("+")
        .map((part) => {
            const [key, value] = part.split(":")
            // "hasOutline:true" reads as presence, not as a value choice
            if (value === undefined || value === "true") return `with ${key}`
            return `${key}: ${value}`
        })
        .join(", ")
}

export function liveUrl(instance: {
    slug: string
    docType: OwidGdocType
    anchor?: string
}): string {
    const path = getCanonicalPath(instance.slug, instance.docType)
    return `${BAKED_BASE_URL}${path}${instance.anchor ? `#${instance.anchor}` : ""}`
}
