import { useContext, useEffect, useState } from "react"
import {
    ComponentUsage,
    ComponentUsageLabel,
    GdocsReferenceUsage,
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

const DOC_TYPE_NOUNS: Partial<Record<OwidGdocType, [string, string]>> = {
    [OwidGdocType.Article]: ["article", "articles"],
    [OwidGdocType.DataInsight]: ["data insight", "data insights"],
    [OwidGdocType.TopicPage]: ["topic page", "topic pages"],
    [OwidGdocType.LinearTopicPage]: [
        "linear topic page",
        "linear topic pages",
    ],
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

// The doc types authors actually choose between — the usage sentence talks
// about these; marginal types only appear when a component is used there.
const MAJOR_DOC_TYPES: OwidGdocType[] = [
    OwidGdocType.Article,
    OwidGdocType.DataInsight,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
]

const LABEL_PHRASES: Record<ComponentUsageLabel, string> = {
    standard: "standard in",
    common: "common in",
    occasional: "occasional in",
    rare: "rare in",
    unused: "not used in",
}

export function joinWithAnd(parts: string[]): string {
    if (parts.length <= 1) return parts[0] ?? ""
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
}

export function indefinite(noun: string): string {
    return (/^[aeiou]/.test(noun) ? "an " : "a ") + noun
}

/**
 * One plain sentence about where a component is used, built from the live
 * labels: "Standard in articles and topic pages; occasional in linear topic
 * pages; never used in data insights."
 */
export function usageSentence(
    usage: ComponentUsage | undefined,
    totalDocsByType: GdocsReferenceUsage["totalDocsByType"]
): string {
    if (!usage || usage.docsUsingIt === 0)
        return "Not used in any published document yet."
    const byLabel = new Map<ComponentUsageLabel, OwidGdocType[]>()
    const usedTypes = new Set<OwidGdocType>()
    for (const entry of usage.byDocType) {
        usedTypes.add(entry.docType)
        const group = byLabel.get(entry.label)
        if (group) group.push(entry.docType)
        else byLabel.set(entry.label, [entry.docType])
    }
    const clauses: string[] = []
    for (const label of ["standard", "common", "occasional", "rare"] as const) {
        const types = byLabel.get(label)
        if (!types) continue
        clauses.push(
            LABEL_PHRASES[label] +
                " " +
                joinWithAnd(types.map((type) => docTypeNoun(type, true)))
        )
    }
    const neverIn = MAJOR_DOC_TYPES.filter(
        (type) => !usedTypes.has(type) && (totalDocsByType[type] ?? 0) > 0
    )
    if (neverIn.length > 0 && clauses.length > 0)
        clauses.push(
            "never used in " +
                joinWithAnd(neverIn.map((type) => docTypeNoun(type, true)))
        )
    if (clauses.length === 0) return "Not used in any published document yet."
    const sentence = clauses.join("; ")
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + "."
}

/** Raw numbers behind the sentence — tooltip material, never the lead. */
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

/** A component is "popular" when it is standard or common somewhere. */
export function isPopular(usage: ComponentUsage | undefined): boolean {
    return (
        usage?.byDocType.some(
            (entry) => entry.label === "standard" || entry.label === "common"
        ) ?? false
    )
}

/** "caption+size:narrow" → "with caption, size: narrow"; "" is the bare form */
export function humanizeVariation(signature: string): string {
    if (signature === "") return "the bare form"
    return signature
        .split("+")
        .map((part) => {
            const [key, value] = part.split(":")
            return value === undefined ? `with ${key}` : `${key}: ${value}`
        })
        .join(", ")
}

export function variationFrequencyLabel(
    count: number,
    scanned: number
): string {
    const fraction = scanned > 0 ? count / scanned : 0
    if (fraction >= 0.5) return "the common form"
    if (fraction >= 0.15) return "frequent"
    if (fraction >= 0.02) return "occasional"
    return "rare"
}

export function liveUrl(instance: {
    slug: string
    docType: OwidGdocType
    anchor?: string
}): string {
    const path = getCanonicalPath(instance.slug, instance.docType)
    return `${BAKED_BASE_URL}${path}${instance.anchor ? `#${instance.anchor}` : ""}`
}
