import { useEffect, useMemo, useState } from "react"
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
import { Link } from "./Link.js"
import { GdocsReferenceExample } from "./GdocsReferenceExample.js"
import {
    docTypeNoun,
    humanizeVariation,
    indefinite,
    joinWithAnd,
    liveUrl,
    usageSentence,
    usageTooltip,
    useAdminJson,
    variationFrequencyLabel,
} from "./gdocsReferenceLiveHelpers.js"

/**
 * The live (database-backed) half of the writing reference UI: usage strips,
 * real examples with provenance navigated by observed forms, and template
 * exemplar x-rays. Everything here presents computed facts qualitatively —
 * words first, raw numbers only in tooltips (see gdocsReferenceLiveHelpers).
 */

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
        <p className="gdocs-ref-live__usage-strip" title={usageTooltip(usage)}>
            {usageSentence(usage, totalDocsByType)}
        </p>
    )
}

// -----------------------------------------------------------------------------
// Component page: examples from the site
// -----------------------------------------------------------------------------

const GALLERY_PAGE_SIZE = 12
// Rendered previews are expensive (each is a full page in an iframe), so the
// gallery starts small and "Show more" reveals already-fetched instances
// before fetching the next page.
const GALLERY_INITIAL_VISIBLE = 4
const GALLERY_VISIBLE_STEP = 8

// What the gallery is currently showing: every published use, one observed
// form, or one synthetic sidecar example (a form no published doc uses yet).
type FormSelection =
    | { kind: "all" }
    | { kind: "form"; signature: string }
    | { kind: "synthetic"; exampleIndex: number }

function FormChip({
    label,
    title,
    isActive,
    isSynthetic,
    onClick,
}: {
    label: string
    title?: string
    isActive: boolean
    isSynthetic?: boolean
    onClick: () => void
}): React.ReactElement {
    const classNames = ["gdocs-ref-live__form-chip"]
    if (isActive) classNames.push("gdocs-ref-live__form-chip--active")
    if (isSynthetic) classNames.push("gdocs-ref-live__form-chip--synthetic")
    return (
        <button
            type="button"
            role="tab"
            aria-selected={isActive}
            className={classNames.join(" ")}
            title={title}
            onClick={onClick}
        >
            {label}
        </button>
    )
}

/**
 * The live examples section of a component page: one gallery of real,
 * rendered uses with provenance, navigated by a single chip row of the
 * component's observed forms. Curated (pinned) examples lead the unfiltered
 * gallery; sidecar examples whose form no published doc uses appear as
 * dashed "not yet used" chips showing the reference example instead.
 */
export function ComponentRealExamples({
    doc,
    usage,
}: {
    doc: ComponentDoc
    usage: ComponentUsage | undefined
}): React.ReactElement | null {
    const [selection, setSelection] = useState<FormSelection>({ kind: "all" })
    const [docTypeFilter, setDocTypeFilter] = useState<string | undefined>()
    const [page, setPage] = useState(0)
    const [visible, setVisible] = useState(GALLERY_INITIAL_VISIBLE)
    // Instances accumulate across "Show more" clicks
    const [gallery, setGallery] = useState<ComponentInstance[]>([])

    const variationFilter =
        selection.kind === "form" ? selection.signature : undefined
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

    // Chip-row inputs arrive with every response (they are unfiltered);
    // keep the last ones so the row doesn't vanish while a page loads.
    const [variations, setVariations] = useState<ComponentVariation[]>([])
    const [pinned, setPinned] = useState<ComponentInstance[]>([])
    const [stalePins, setStalePins] = useState<
        ComponentInstancesResponse["stalePins"]
    >([])
    const [synthetic, setSynthetic] = useState<
        ComponentInstancesResponse["syntheticExamples"]
    >([])
    const [total, setTotal] = useState(0)

    useEffect(() => {
        if (!response) return
        setVariations(response.variations)
        setPinned(response.pinned)
        setStalePins(response.stalePins)
        setSynthetic(response.syntheticExamples)
        setTotal(response.total)
        setGallery((previous) =>
            page === 0
                ? response.instances
                : [...previous, ...response.instances]
        )
        // page is what varies between appends; the response carries the data
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [response])

    const selectForm = (next: FormSelection): void => {
        setSelection(next)
        setPage(0)
        setVisible(GALLERY_INITIAL_VISIBLE)
        setGallery([])
    }
    const selectDocType = (docType: string | undefined): void => {
        setDocTypeFilter(docType)
        setPage(0)
        setVisible(GALLERY_INITIAL_VISIBLE)
        setGallery([])
    }
    // Reveal already-fetched instances first; fetch the next page once the
    // fetched ones run out.
    const showMore = (): void => {
        const next = visible + GALLERY_VISIBLE_STEP
        setVisible(next)
        if (next > gallery.length && (page + 1) * GALLERY_PAGE_SIZE < total)
            setPage(page + 1)
    }

    if (response === null && variations.length === 0) return null
    // Full-section loader only before anything has ever arrived — once the
    // chip row exists it stays mounted while filtered pages load.
    if (response === undefined && total === 0 && variations.length === 0)
        return (
            <section className="gdocs-ref__section">
                <h2 className="gdocs-ref__section-title">
                    Examples from the site
                </h2>
                <p className="gdocs-ref-live__loading">
                    Looking up published uses…
                </p>
            </section>
        )

    const scanned = variations.reduce((sum, v) => sum + v.count, 0)
    const unobservedSynthetic = synthetic.filter((example) => !example.observed)
    const docTypesInUse = usage?.byDocType.map((entry) => entry.docType) ?? []
    const showChipRow = variations.length > 1 || unobservedSynthetic.length > 0
    const isSynthetic = selection.kind === "synthetic"
    const syntheticExample = isSynthetic
        ? doc.examples[selection.exampleIndex]
        : undefined

    // Curated picks lead the unfiltered gallery, deduplicated from the page
    // of instances that follows them.
    const showPinned = selection.kind === "all" && docTypeFilter === undefined
    const pinnedKeys = new Set(
        pinned.map((instance) => `${instance.gdocId}-${instance.path}`)
    )
    const galleryInstances = (
        showPinned
            ? gallery.filter(
                  (instance) =>
                      !pinnedKeys.has(`${instance.gdocId}-${instance.path}`)
              )
            : gallery
    ).slice(0, visible)
    const remaining = total - (showPinned ? pinned.length : 0) - visible

    return (
        <section className="gdocs-ref__section">
            <h2 className="gdocs-ref__section-title">Examples from the site</h2>
            {stalePins.length > 0 && (
                <p className="gdocs-ref-live__stale">
                    Stale pinned example{stalePins.length > 1 && "s"} in the
                    sidecar:{" "}
                    {stalePins
                        .map(
                            (pin) =>
                                pin.slug + (pin.nth ? ` (#${pin.nth})` : "")
                        )
                        .join(", ")}{" "}
                    — the document is unpublished or no longer uses this
                    component.
                </p>
            )}
            <div className="gdocs-ref-live__gallery-controls">
                {showChipRow && (
                    <div
                        className="gdocs-ref-live__form-chips"
                        role="tablist"
                        aria-label="Forms of this component"
                    >
                        <FormChip
                            label="All forms"
                            title={`${total} published uses`}
                            isActive={selection.kind === "all"}
                            onClick={() => selectForm({ kind: "all" })}
                        />
                        {variations.map((variation) => (
                            <FormChip
                                key={variation.signature}
                                // Curated name from the matching sidecar
                                // example; the technical signature is the
                                // fallback for still-unnamed forms.
                                label={
                                    variation.name ??
                                    humanizeVariation(variation.signature)
                                }
                                title={`${variation.count} published uses — ${variationFrequencyLabel(
                                    variation.count,
                                    scanned
                                )}`}
                                isActive={
                                    selection.kind === "form" &&
                                    selection.signature === variation.signature
                                }
                                onClick={() =>
                                    selectForm({
                                        kind: "form",
                                        signature: variation.signature,
                                    })
                                }
                            />
                        ))}
                        {unobservedSynthetic.map((example) => (
                            <FormChip
                                key={`synthetic-${example.exampleIndex}`}
                                label={example.name}
                                title="Not used in any published doc yet — reference example"
                                isActive={
                                    selection.kind === "synthetic" &&
                                    selection.exampleIndex ===
                                        example.exampleIndex
                                }
                                isSynthetic
                                onClick={() =>
                                    selectForm({
                                        kind: "synthetic",
                                        exampleIndex: example.exampleIndex,
                                    })
                                }
                            />
                        ))}
                    </div>
                )}
                {docTypesInUse.length > 1 && !isSynthetic && (
                    <select
                        className="gdocs-ref-live__doc-type-select"
                        value={docTypeFilter ?? ""}
                        onChange={(event) =>
                            selectDocType(
                                event.currentTarget.value || undefined
                            )
                        }
                    >
                        <option value="">All document types</option>
                        {docTypesInUse.map((docType) => (
                            <option key={docType} value={docType}>
                                {docTypeNoun(docType, true)}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            {isSynthetic && syntheticExample ? (
                <div className="gdocs-ref-live__synthetic">
                    <p className="gdocs-ref-live__synthetic-note">
                        No published document uses this form yet — this is the
                        reference example from the docs.
                    </p>
                    <GdocsReferenceExample
                        archie={syntheticExample.archie}
                        previewPath={`/gdocs-reference/components/${doc.id}/preview?example=${
                            (selection as { exampleIndex: number }).exampleIndex
                        }`}
                    />
                </div>
            ) : (
                <>
                    {showPinned &&
                        pinned.map((instance) => (
                            <div
                                key={`pinned-${instance.gdocId}-${instance.path}`}
                                className="gdocs-ref-live__curated"
                            >
                                <span className="gdocs-ref-live__curated-badge">
                                    curated pick
                                </span>
                                <InstanceExample instance={instance} />
                            </div>
                        ))}
                    {galleryInstances.map((instance) => (
                        <InstanceExample
                            key={`${instance.gdocId}-${instance.path}`}
                            instance={instance}
                        />
                    ))}
                    {response !== undefined && total === 0 && (
                        <p className="gdocs-ref-live__loading">
                            No published document uses this component yet.
                        </p>
                    )}
                    {response === undefined && (
                        <p className="gdocs-ref-live__loading">Loading…</p>
                    )}
                    {response !== undefined && remaining > 0 && (
                        <button
                            type="button"
                            className="gdocs-ref-live__show-more"
                            onClick={showMore}
                        >
                            Show more ({remaining} more)
                        </button>
                    )}
                </>
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
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
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
                The blocks used in{" "}
                {docTypeNoun(template.id as OwidGdocType, true)}
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
