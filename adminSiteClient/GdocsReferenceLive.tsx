import { useContext, useEffect, useMemo, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons"
import {
    ComponentDoc,
    ComponentInstance,
    ComponentInstancesResponse,
    ComponentUsage,
    ComponentUsageLabel,
    ComponentVariation,
    ExemplarOutline,
    ExemplarSection,
    GdocsReferenceUsage,
    OwidGdocType,
    TemplateDoc,
    TemplateExemplarsResponse,
} from "@ourworldindata/types"
import { getCanonicalPath } from "@ourworldindata/components"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Link } from "./Link.js"
import { GdocsReferenceExample } from "./GdocsReferenceExample.js"

/**
 * The live (database-backed) half of the writing reference UI: usage strips,
 * observed variations, real examples with provenance, and template exemplar
 * x-rays. Everything here presents computed facts qualitatively — words
 * first, raw numbers only in tooltips.
 */

// -----------------------------------------------------------------------------
// Data fetching
// -----------------------------------------------------------------------------

/** Fetch an admin API JSON path; undefined while loading, null on failure. */
export function useAdminJson<T>(path: string | undefined): T | undefined | null {
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

// -----------------------------------------------------------------------------
// Qualitative wording helpers
// -----------------------------------------------------------------------------

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

function joinWithAnd(parts: string[]): string {
    if (parts.length <= 1) return parts[0] ?? ""
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
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

function variationFrequencyLabel(count: number, scanned: number): string {
    const fraction = scanned > 0 ? count / scanned : 0
    if (fraction >= 0.5) return "the common form"
    if (fraction >= 0.15) return "frequent"
    if (fraction >= 0.02) return "occasional"
    return "rare"
}

// -----------------------------------------------------------------------------
// Live links + instance previews
// -----------------------------------------------------------------------------

export function liveUrl(instance: {
    slug: string
    docType: OwidGdocType
    anchor?: string
}): string {
    const path = getCanonicalPath(instance.slug, instance.docType)
    return `${BAKED_BASE_URL}${path}${instance.anchor ? `#${instance.anchor}` : ""}`
}

function instancePreviewPath(instance: ComponentInstance): string {
    return `/gdocs-reference/instance/preview?gdocId=${encodeURIComponent(
        instance.gdocId
    )}&path=${encodeURIComponent(instance.path)}`
}

/** "Used in *Life expectancy* → view live" — the provenance line under a real example. */
function InstanceProvenance({
    instance,
}: {
    instance: ComponentInstance
}): React.ReactElement {
    return (
        <p className="gdocs-ref-live__provenance">
            Used in <em>{instance.title}</em>{" "}
            <span className="gdocs-ref-live__provenance-type">
                ({docTypeNoun(instance.docType, false)})
            </span>{" "}
            —{" "}
            <a href={liveUrl(instance)} target="_blank" rel="noopener">
                view live <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </a>
        </p>
    )
}

function InstanceExample({
    instance,
}: {
    instance: ComponentInstance
}): React.ReactElement {
    return (
        <div className="gdocs-ref-live__instance">
            <GdocsReferenceExample
                archie={instance.archie ?? ""}
                previewPath={instancePreviewPath(instance)}
            />
            <InstanceProvenance instance={instance} />
        </div>
    )
}

// -----------------------------------------------------------------------------
// Component page: usage strip
// -----------------------------------------------------------------------------

export function UsageStrip({
    usage,
    totalDocsByType,
}: {
    usage: ComponentUsage | undefined
    totalDocsByType: GdocsReferenceUsage["totalDocsByType"]
}): React.ReactElement {
    return (
        <p
            className="gdocs-ref-live__usage-strip"
            title={usageTooltip(usage)}
        >
            {usageSentence(usage, totalDocsByType)}
        </p>
    )
}

// -----------------------------------------------------------------------------
// Component page: real examples (pinned, variations, browse all)
// -----------------------------------------------------------------------------

const BROWSE_PAGE_SIZE = 12

function VariationCard({
    variation,
    scanned,
    onBrowse,
}: {
    variation: ComponentVariation
    scanned: number
    onBrowse: (signature: string) => void
}): React.ReactElement {
    return (
        <div className="gdocs-ref-live__variation">
            <div className="gdocs-ref-live__variation-header">
                <span className="gdocs-ref-live__variation-name">
                    {humanizeVariation(variation.signature)}
                </span>
                <span
                    className="gdocs-ref-live__variation-freq"
                    title={`${variation.count} published uses`}
                >
                    {variationFrequencyLabel(variation.count, scanned)}
                </span>
                <button
                    type="button"
                    className="gdocs-ref-live__variation-browse"
                    onClick={() => onBrowse(variation.signature)}
                >
                    see more like this
                </button>
            </div>
            <InstanceExample instance={variation.representative} />
        </div>
    )
}

/**
 * The live section of a component page: curated pinned examples first, the
 * observed variations of the component, and a browsable, filterable list of
 * every published use. Synthetic sidecar examples whose form is not observed
 * in production are appended to the variations with a distinct treatment.
 */
export function ComponentRealExamples({
    doc,
    usage,
}: {
    doc: ComponentDoc
    usage: ComponentUsage | undefined
}): React.ReactElement | null {
    const [docTypeFilter, setDocTypeFilter] = useState<string | undefined>()
    const [variationFilter, setVariationFilter] = useState<
        string | undefined
    >()
    const [page, setPage] = useState(0)
    const [browsing, setBrowsing] = useState(false)

    const query = new URLSearchParams()
    if (docTypeFilter !== undefined) query.set("docType", docTypeFilter)
    if (variationFilter !== undefined) query.set("variation", variationFilter)
    if (page > 0) query.set("page", String(page))
    const queryString = query.toString()
    const response = useAdminJson<ComponentInstancesResponse>(
        `/api/gdocs-reference/components/${doc.id}/instances.json${
            queryString ? `?${queryString}` : ""
        }`
    )

    // The unfiltered variations arrive with every response; keep the first
    // ones so the grid doesn't vanish while a filtered page loads.
    const [variations, setVariations] = useState<ComponentVariation[]>([])
    const [scanned, setScanned] = useState(0)
    useEffect(() => {
        if (response && response.variations.length > 0) {
            setVariations(response.variations)
            setScanned(
                response.variations.reduce((sum, v) => sum + v.count, 0)
            )
        }
    }, [response])

    const onBrowseVariation = (signature: string): void => {
        setVariationFilter(signature)
        setPage(0)
        setBrowsing(true)
    }

    if (response === null) return null
    if (response === undefined && variations.length === 0)
        return (
            <section className="gdocs-ref__section">
                <h2 className="gdocs-ref__section-title">In the wild</h2>
                <p className="gdocs-ref-live__loading">
                    Looking up published uses…
                </p>
            </section>
        )

    const unobservedSynthetic =
        response?.syntheticExamples.filter((example) => !example.observed) ??
        []
    const docTypesInUse = usage?.byDocType.map((entry) => entry.docType) ?? []
    const totalPages = response
        ? Math.ceil(response.total / BROWSE_PAGE_SIZE)
        : 0

    return (
        <section className="gdocs-ref__section">
            <h2 className="gdocs-ref__section-title">In the wild</h2>
            {response && response.pinned.length > 0 && (
                <div className="gdocs-ref-live__pinned">
                    {response.pinned.map((instance) => (
                        <InstanceExample
                            key={`${instance.gdocId}-${instance.path}`}
                            instance={instance}
                        />
                    ))}
                </div>
            )}
            {response && response.stalePins.length > 0 && (
                <p className="gdocs-ref-live__stale">
                    Stale pinned example{response.stalePins.length > 1 && "s"}{" "}
                    in the sidecar:{" "}
                    {response.stalePins
                        .map((pin) => pin.slug + (pin.nth ? ` (#${pin.nth})` : ""))
                        .join(", ")}{" "}
                    — the document is unpublished or no longer uses this
                    component.
                </p>
            )}
            {variations.length > 0 &&
                (variations.length > 1 || unobservedSynthetic.length > 0) && (
                    <>
                        <h3 className="gdocs-ref-live__subheading">
                            Forms seen in published content
                        </h3>
                        <div className="gdocs-ref-live__variations">
                            {variations.map((variation) => (
                                <VariationCard
                                    key={variation.signature}
                                    variation={variation}
                                    scanned={scanned}
                                    onBrowse={onBrowseVariation}
                                />
                            ))}
                            {unobservedSynthetic.map((example) => (
                                <div
                                    key={example.exampleIndex}
                                    className="gdocs-ref-live__variation gdocs-ref-live__variation--synthetic"
                                >
                                    <div className="gdocs-ref-live__variation-header">
                                        <span className="gdocs-ref-live__variation-name">
                                            {humanizeVariation(
                                                example.signature
                                            )}
                                        </span>
                                        <span className="gdocs-ref-live__variation-freq gdocs-ref-live__variation-freq--synthetic">
                                            not used in any published doc yet
                                        </span>
                                    </div>
                                    <GdocsReferenceExample
                                        archie={
                                            doc.examples[example.exampleIndex]
                                                ?.archie ?? ""
                                        }
                                        previewPath={`/gdocs-reference/components/${doc.id}/preview?example=${example.exampleIndex}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                )}
            {response && response.total > 0 && (
                <div className="gdocs-ref-live__browse">
                    {!browsing ? (
                        <button
                            type="button"
                            className="gdocs-ref-live__browse-toggle"
                            onClick={() => setBrowsing(true)}
                        >
                            Browse all {response.total} published uses
                        </button>
                    ) : (
                        <>
                            <div className="gdocs-ref-live__browse-controls">
                                <select
                                    value={docTypeFilter ?? ""}
                                    onChange={(event) => {
                                        setDocTypeFilter(
                                            event.currentTarget.value ||
                                                undefined
                                        )
                                        setPage(0)
                                    }}
                                >
                                    <option value="">
                                        All document types
                                    </option>
                                    {docTypesInUse.map((docType) => (
                                        <option key={docType} value={docType}>
                                            {docTypeNoun(docType, true)}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={
                                        variationFilter === undefined
                                            ? "__all"
                                            : variationFilter
                                    }
                                    onChange={(event) => {
                                        const value =
                                            event.currentTarget.value
                                        setVariationFilter(
                                            value === "__all"
                                                ? undefined
                                                : value
                                        )
                                        setPage(0)
                                    }}
                                >
                                    <option value="__all">All forms</option>
                                    {variations.map((variation) => (
                                        <option
                                            key={variation.signature}
                                            value={variation.signature}
                                        >
                                            {humanizeVariation(
                                                variation.signature
                                            )}
                                        </option>
                                    ))}
                                </select>
                                <span className="gdocs-ref-live__browse-count">
                                    {response.total} use
                                    {response.total === 1 ? "" : "s"}
                                </span>
                            </div>
                            {response.instances.map((instance) => (
                                <InstanceExample
                                    key={`${instance.gdocId}-${instance.path}`}
                                    instance={instance}
                                />
                            ))}
                            {totalPages > 1 && (
                                <div className="gdocs-ref-live__pagination">
                                    <button
                                        type="button"
                                        disabled={page === 0}
                                        onClick={() => setPage(page - 1)}
                                    >
                                        Previous
                                    </button>
                                    <span>
                                        Page {page + 1} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={page + 1 >= totalPages}
                                        onClick={() => setPage(page + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    )
}

// -----------------------------------------------------------------------------
// Template page: skeleton scaffold
// -----------------------------------------------------------------------------

export function SkeletonScaffold({
    template,
}: {
    template: TemplateDoc
}): React.ReactElement | null {
    if (!template.skeleton || template.skeleton.length === 0) return null
    return (
        <section className="gdocs-ref__section">
            <h2 className="gdocs-ref__section-title">
                The shape of {indefinite(template.title.toLowerCase())}
            </h2>
            <ol className="gdocs-ref-live__skeleton">
                {template.skeleton.map((part) => (
                    <li
                        key={part.name}
                        className={
                            part.repeats
                                ? "gdocs-ref-live__skeleton-part gdocs-ref-live__skeleton-part--repeats"
                                : "gdocs-ref-live__skeleton-part"
                        }
                    >
                        <div className="gdocs-ref-live__skeleton-name">
                            {part.name}
                            {part.repeats && (
                                <span className="gdocs-ref-live__skeleton-repeat">
                                    repeated
                                </span>
                            )}
                        </div>
                        <p className="gdocs-ref-live__skeleton-desc">
                            {part.description}
                        </p>
                        <div className="gdocs-ref-live__skeleton-components">
                            {part.components.map((componentId) => (
                                <Link
                                    key={componentId}
                                    className="gdocs-ref-live__component-chip"
                                    to={`/gdocs-reference/components/${componentId}`}
                                >
                                    {`{.${componentId}}`}
                                </Link>
                            ))}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    )
}

// -----------------------------------------------------------------------------
// Template page: exemplar x-ray
// -----------------------------------------------------------------------------

function indefinite(noun: string): string {
    return (/^[aeiou]/.test(noun) ? "an " : "a ") + noun
}

/** "prose, 2 charts and a callout" — a section's composition in words. */
function compositionSentence(composition: Record<string, number>): string {
    const parts: string[] = []
    const { text, ...rest } = composition
    if (text) parts.push("prose")
    for (const [componentId, count] of Object.entries(rest)) {
        parts.push(
            count === 1 ? indefinite(componentId) : `${count} ${componentId}s`
        )
    }
    if (parts.length === 0) return "empty"
    return joinWithAnd(parts)
}

function XraySection({
    section,
    exemplar,
}: {
    section: ExemplarSection
    exemplar: ExemplarOutline
}): React.ReactElement {
    const [expanded, setExpanded] = useState(false)
    // Group the drill-in blocks by component, keeping first paths
    const grouped = useMemo(() => {
        const byComponent = new Map<string, number>()
        for (const block of section.blocks) {
            byComponent.set(
                block.componentId,
                (byComponent.get(block.componentId) ?? 0) + 1
            )
        }
        return [...byComponent.entries()]
    }, [section.blocks])

    return (
        <li className="gdocs-ref-live__xray-section">
            <div className="gdocs-ref-live__xray-header">
                <span className="gdocs-ref-live__xray-heading">
                    {section.heading ??
                        (section.blocks.length === 1 &&
                        section.blocks[0]?.componentId
                            ? `{.${section.blocks[0].componentId}}`
                            : "Intro")}
                </span>
                {section.repeats && section.repeats > 1 && (
                    <span className="gdocs-ref-live__xray-repeats">
                        + {section.repeats - 1} more section
                        {section.repeats > 2 ? "s" : ""} like this
                    </span>
                )}
                <a
                    className="gdocs-ref-live__xray-live"
                    href={liveUrl({
                        slug: exemplar.slug,
                        docType: exemplar.docType,
                        anchor: section.anchor,
                    })}
                    target="_blank"
                    rel="noopener"
                >
                    view live{" "}
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                </a>
            </div>
            <button
                type="button"
                className="gdocs-ref-live__xray-composition"
                title={expanded ? "Hide blocks" : "Show blocks"}
                onClick={() => setExpanded(!expanded)}
            >
                {compositionSentence(section.composition)}
            </button>
            {expanded && (
                <div className="gdocs-ref-live__xray-blocks">
                    {grouped.map(([componentId, count]) => (
                        <Link
                            key={componentId}
                            className="gdocs-ref-live__component-chip"
                            to={`/gdocs-reference/components/${componentId}`}
                        >
                            {`{.${componentId}}`}
                            {count > 1 && ` ×${count}`}
                        </Link>
                    ))}
                </div>
            )}
        </li>
    )
}

/**
 * The x-ray of a template's exemplar documents: for each editorially chosen
 * published doc, a section-level outline computed live from its current
 * content — headings, composition in words, live links, block drill-in.
 */
export function ExemplarXray({
    template,
}: {
    template: TemplateDoc
}): React.ReactElement | null {
    const hasExemplars = (template.exemplars?.length ?? 0) > 0
    const response = useAdminJson<TemplateExemplarsResponse>(
        hasExemplars
            ? `/api/gdocs-reference/templates/${template.id}/exemplars.json`
            : undefined
    )
    if (!hasExemplars || response === null) return null
    if (response === undefined)
        return (
            <section className="gdocs-ref__section">
                <p className="gdocs-ref-live__loading">Loading exemplar…</p>
            </section>
        )
    return (
        <section className="gdocs-ref__section">
            {response.exemplars.map((exemplar) => (
                <div key={exemplar.slug} className="gdocs-ref-live__xray">
                    <h2 className="gdocs-ref__section-title">
                        How “{exemplar.title}” is built
                    </h2>
                    <p className="gdocs-ref__section-desc">
                        A real, published {docTypeNoun(exemplar.docType, false)}
                        , section by section — computed from its current
                        content.{" "}
                        <a
                            href={liveUrl(exemplar)}
                            target="_blank"
                            rel="noopener"
                        >
                            Read it on the site{" "}
                            <FontAwesomeIcon
                                icon={faArrowUpRightFromSquare}
                            />
                        </a>
                    </p>
                    <ol className="gdocs-ref-live__xray-sections">
                        {exemplar.sections.map((section, index) => (
                            <XraySection
                                key={index}
                                section={section}
                                exemplar={exemplar}
                            />
                        ))}
                    </ol>
                </div>
            ))}
            {response.staleExemplars.length > 0 && (
                <p className="gdocs-ref-live__stale">
                    Stale exemplar slug
                    {response.staleExemplars.length > 1 && "s"} in the sidecar:{" "}
                    {response.staleExemplars.join(", ")} — not published as{" "}
                    {docTypeNoun(template.id as OwidGdocType, false)} anymore.
                </p>
            )}
        </section>
    )
}

// -----------------------------------------------------------------------------
// Template page: component shortlist for the doc type
// -----------------------------------------------------------------------------

/**
 * The components that matter for one document type, ordered by adoption —
 * each with its usage label and the first line of its decision prose.
 */
export function TemplateComponentShortlist({
    template,
    usage,
    components,
}: {
    template: TemplateDoc
    usage: GdocsReferenceUsage | undefined | null
    components: ComponentDoc[]
}): React.ReactElement | null {
    const rows = useMemo(() => {
        if (!usage) return []
        const docType = template.id as OwidGdocType
        const entries: {
            doc: ComponentDoc
            label: ComponentUsageLabel
            fraction: number
        }[] = []
        for (const componentUsage of usage.components) {
            const byType = componentUsage.byDocType.find(
                (entry) => entry.docType === docType
            )
            if (!byType || byType.label === "rare" || byType.label === "unused")
                continue
            const doc = components.find(
                (component) => component.id === componentUsage.componentId
            )
            if (!doc) continue
            entries.push({
                doc,
                label: byType.label,
                fraction:
                    byType.totalDocs > 0
                        ? byType.docsUsingIt / byType.totalDocs
                        : 0,
            })
        }
        return entries.sort((a, b) => b.fraction - a.fraction)
    }, [usage, template.id, components])

    if (rows.length === 0) return null
    return (
        <section className="gdocs-ref__section">
            <h2 className="gdocs-ref__section-title">
                The blocks used in {docTypeNoun(template.id as OwidGdocType, true)}
            </h2>
            <p className="gdocs-ref__section-desc">
                Ordered by how widely published{" "}
                {docTypeNoun(template.id as OwidGdocType, true)} use them.
            </p>
            <ul className="gdocs-ref-live__shortlist">
                {rows.map(({ doc, label }) => (
                    <li key={doc.id} className="gdocs-ref-live__shortlist-row">
                        <Link
                            className="gdocs-ref-live__shortlist-title"
                            to={`/gdocs-reference/components/${doc.id}`}
                        >
                            {doc.title}
                        </Link>
                        <span
                            className={`gdocs-ref-live__label gdocs-ref-live__label--${label}`}
                        >
                            {label}
                        </span>
                        <span className="gdocs-ref-live__shortlist-desc">
                            {firstSentence(doc.body)}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    )
}

function firstSentence(body: string): string {
    const paragraph = (body.split("\n\n")[0] ?? "").replace(/\s+/g, " ").trim()
    const period = paragraph.indexOf(". ")
    const sentence = period > 0 ? paragraph.slice(0, period + 1) : paragraph
    return sentence.replace(/[`*_]/g, "")
}
