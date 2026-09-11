import { Fragment, useEffect, useMemo, useState } from "react"
import { Tooltip } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowUpRightFromSquare,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons"
import {
    COMPONENT_USAGE_LABELS,
    ComponentReference,
    ComponentInstance,
    ComponentInstancesResponse,
    ComponentProp,
    ComponentUsage,
    ComponentUsageLabel,
    ComponentVariation,
    ExemplarOutline,
    GdocsReferenceUsage,
    OwidGdocType,
    SyntheticExampleInfo,
    TemplateReference,
    TemplateExemplarsResponse,
} from "@ourworldindata/types"
import { Link } from "./Link.js"
import { GdocsReferenceExample } from "./GdocsReferenceExample.js"
import { InlineMarkdownText, TitleFor } from "./GdocsReferenceMarkdown.js"
import {
    docTypeNoun,
    formDefiningParts,
    FormSetPart,
    PropAdoptionInfo,
    formatUsagePercent,
    FREQUENCY_DOTS,
    fractionUsageLabel,
    githubBlobUrl,
    indefinite,
    isContentProp,
    isEffectivelyRequired,
    liveUrl,
    MAJOR_DOC_TYPES,
    useAdminJson,
} from "./gdocsReferenceLiveHelpers.js"

/**
 * The live (database-backed) half of the writing reference UI: the frequency
 * vocabulary, the where-it's-used sentence, the forms section with real examples,
 * the derived properties table, and the template exemplar previews. Everything
 * here presents computed facts qualitatively — words and the four-dot glyph
 * first, raw numbers only in tooltips (see gdocsReferenceLiveHelpers).
 */

// -----------------------------------------------------------------------------
// The frequency vocabulary: one glyph everywhere frequency is spoken
// -----------------------------------------------------------------------------

const GLYPH_DOT_POSITIONS = [5, 15, 25, 35]

/**
 * The four-dot frequency glyph — the single visual primitive for adoption,
 * used on overview cards, sidebar rows, form cards, the properties table and
 * template shortlists. Dashed marks a "new" form no published doc uses yet.
 */
export function FrequencyGlyph({
    label,
    dashed,
}: {
    label: ComponentUsageLabel
    dashed?: boolean
}): React.ReactElement {
    const filled = dashed ? 0 : FREQUENCY_DOTS[label]
    return (
        <svg
            className="gdocs-ref-live__glyph"
            width="42"
            height="10"
            viewBox="0 0 42 10"
            aria-hidden="true"
        >
            {GLYPH_DOT_POSITIONS.map((cx, index) => (
                <circle
                    key={cx}
                    cx={cx}
                    cy="5"
                    r="3"
                    className={
                        dashed
                            ? "gdocs-ref-live__glyph-dot gdocs-ref-live__glyph-dot--dashed"
                            : index < filled
                              ? "gdocs-ref-live__glyph-dot gdocs-ref-live__glyph-dot--filled"
                              : "gdocs-ref-live__glyph-dot"
                    }
                />
            ))}
        </svg>
    )
}

/** Glyph + word — the word is primary, the glyph reinforces. */
export function FrequencyBadge({
    label,
    title,
    dashed,
    hideWord,
}: {
    label: ComponentUsageLabel
    title?: string
    dashed?: boolean
    hideWord?: boolean
}): React.ReactElement {
    return (
        <span className="gdocs-ref-live__freq" title={title}>
            <FrequencyGlyph label={label} dashed={dashed} />
            {!hideWord && (
                <span className="gdocs-ref-live__freq-word">
                    {dashed ? "new" : label}
                </span>
            )}
        </span>
    )
}

// -----------------------------------------------------------------------------
// Component page: where it's used (adoption in words)
// -----------------------------------------------------------------------------

/** ", " between items, a custom separator (" and ", " or ") before the last. */
function joinNodes(
    nodes: React.ReactElement[],
    lastSeparator: string
): React.ReactElement[] {
    return nodes.map((node, index) => (
        <Fragment key={index}>
            {index > 0 && (index === nodes.length - 1 ? lastSeparator : ", ")}
            {node}
        </Fragment>
    ))
}

/**
 * "Where it's used" — one sentence naming the document types by their
 * adoption word, peaks first, with the notable zeros trailing ("never in
 * data insights"). Each adoption word is backed by the share of that type
 * using the component, so the claim can be checked at a glance; the raw
 * counts live in tooltips. Each doc type links to its template page when one
 * exists.
 */
export function UsageSummary({
    usage,
    totalDocsByType,
    templateIds,
}: {
    usage: ComponentUsage | undefined
    totalDocsByType: GdocsReferenceUsage["totalDocsByType"]
    templateIds: Set<string>
}): React.ReactElement {
    const entries = (usage?.byDocType ?? [])
        .filter((entry) => entry.totalUses > 0)
        .sort((a, b) => b.totalUses - a.totalUses)
    const unusedMajor = MAJOR_DOC_TYPES.filter(
        (docType) =>
            !entries.some((entry) => entry.docType === docType) &&
            (totalDocsByType[docType] ?? 0) > 0
    )
    // One clause per adoption word, most-adopted first
    const groups = COMPONENT_USAGE_LABELS.map((label) => ({
        label,
        entries: entries.filter((entry) => entry.label === label),
    })).filter((group) => group.entries.length > 0)
    const docTypeName = (
        docType: OwidGdocType,
        title?: string
    ): React.ReactElement =>
        templateIds.has(docType) ? (
            <Link to={`/gdocs-reference/templates/${docType}`} title={title}>
                {docTypeNoun(docType, true)}
            </Link>
        ) : (
            <span title={title}>{docTypeNoun(docType, true)}</span>
        )

    return (
        <div className="gdocs-ref-live__usage">
            <div className="gdocs-ref-live__usage-title">
                Where it’s used{" "}
                <span className="gdocs-ref-live__usage-subtitle">
                    — adoption within each document type
                </span>
            </div>
            {entries.length === 0 ? (
                <p className="gdocs-ref-live__loading">
                    Not used in any published document yet.
                </p>
            ) : (
                <p className="gdocs-ref-live__usage-sentence">
                    {groups.map((group, groupIndex) => (
                        <Fragment key={group.label}>
                            {groupIndex === 0
                                ? group.label.charAt(0).toUpperCase() +
                                  group.label.slice(1)
                                : `, ${group.label}`}{" "}
                            in{" "}
                            {joinNodes(
                                group.entries.map((entry) => {
                                    const tooltip = `Used in ${entry.docsUsingIt} of ${entry.totalDocs} published ${docTypeNoun(
                                        entry.docType,
                                        entry.totalDocs !== 1
                                    )}`
                                    return (
                                        <Fragment key={entry.docType}>
                                            {docTypeName(
                                                entry.docType,
                                                tooltip
                                            )}{" "}
                                            <span
                                                className="gdocs-ref-live__usage-pct"
                                                title={tooltip}
                                            >
                                                (
                                                {formatUsagePercent(
                                                    entry.docsUsingIt,
                                                    entry.totalDocs
                                                )}
                                                )
                                            </span>
                                        </Fragment>
                                    )
                                }),
                                " and "
                            )}
                        </Fragment>
                    ))}
                    {unusedMajor.length > 0 && (
                        <>
                            {" · "}
                            <span className="gdocs-ref-live__usage-never">
                                never in{" "}
                                {joinNodes(
                                    unusedMajor.map((docType) =>
                                        docTypeName(docType)
                                    ),
                                    " or "
                                )}
                            </span>
                        </>
                    )}
                    .
                </p>
            )}
        </div>
    )
}

// -----------------------------------------------------------------------------
// Component page: the forms section
// -----------------------------------------------------------------------------

function instancePreviewPath(instance: ComponentInstance): string {
    return `/gdocs-reference/instance/preview?gdocId=${encodeURIComponent(
        instance.gdocId
    )}&path=${encodeURIComponent(instance.path)}`
}

/** "Used in *Life expectancy* → view live" — the provenance line under a real example. */
function InstanceProvenance({
    instance,
    curated,
}: {
    instance: ComponentInstance
    curated?: boolean
}): React.ReactElement {
    return (
        <p className="gdocs-ref-live__provenance">
            {curated && (
                <span className="gdocs-ref-live__curated-badge">
                    curated pick
                </span>
            )}
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

/**
 * A form's title is its definition: one chip per signature part, each prop
 * name carrying its hover hint. The default form — nothing beyond the
 * required properties — gets a plain label instead. `plain` drops the hints
 * for places that already sit inside a control (the long-tail rows).
 */
function FormTitle({
    parts,
    defaults,
    plain,
    synthetic,
    titleFor,
}: {
    parts: FormSetPart[]
    defaults?: Record<string, string>
    plain?: boolean
    synthetic?: boolean
    titleFor?: TitleFor
}): React.ReactElement {
    const partClassName = [
        "gdocs-ref-live__form-title-part",
        synthetic && "gdocs-ref-live__form-title-part--synthetic",
    ]
        .filter(Boolean)
        .join(" ")
    if (parts.length === 0)
        return (
            <span className="gdocs-ref-live__form-title">
                <span
                    className={` gdocs-ref-live__form-title-part--default`}
                    title="Only the required properties — every optional one at its default"
                >
                    Default form
                </span>
            </span>
        )
    return (
        <span className="gdocs-ref-live__form-title">
            {parts.map((part) => (
                <span key={part.name} className={partClassName}>
                    {plain ? (
                        <code className="gdocs-ref-live__prop-name">
                            {part.name}
                        </code>
                    ) : (
                        <PropName
                            name={part.name}
                            prop={part.prop}
                            defaultValue={defaults?.[part.name]}
                            titleFor={titleFor}
                        />
                    )}
                    {part.value !== undefined && part.value !== "true" && (
                        <span className="gdocs-ref-live__form-title-value">
                            : {part.value}
                        </span>
                    )}
                </span>
            ))}
        </span>
    )
}

// -----------------------------------------------------------------------------
// Component page: the form cards — each observed form of a component, the
// properties it sets, and one real published example at a time.
// -----------------------------------------------------------------------------

/** A prop name; hover shows what setting it does and its declared type. */
function PropName({
    name,
    prop,
    defaultValue,
    titleFor,
}: {
    name: string
    prop: ComponentProp | undefined
    defaultValue: string | undefined
    titleFor?: TitleFor
}): React.ReactElement {
    if (!prop) return <code className="gdocs-ref-live__prop-name">{name}</code>
    return (
        <Tooltip
            title={
                <span className="gdocs-ref-live__prop-hint">
                    {prop.description && (
                        <InlineMarkdownText
                            text={prop.description}
                            titleFor={titleFor}
                        />
                    )}
                    <code className="gdocs-ref-live__prop-hint-type">
                        {prop.type}
                    </code>
                    {defaultValue !== undefined && (
                        <span className="gdocs-ref-live__prop-hint-default">
                            Default when omitted: <code>{defaultValue}</code>
                        </span>
                    )}
                </span>
            }
        >
            <code className="gdocs-ref-live__prop-name gdocs-ref-live__prop-name--hinted">
                {name}
            </code>
        </Tooltip>
    )
}

const instanceKey = (instance: ComponentInstance): string =>
    `${instance.gdocId}-${instance.path}`

// DOM id of a form's card, so the properties table can cross-link into it
const formAnchorId = (signature: string): string =>
    "form-" + (signature.replace(/[^a-z0-9]+/gi, "-") || "default")

/**
 * One observed form of the component: its name, its frequency on the shared
 * vocabulary, the properties it sets, and one real example at a time — the
 * pager walks every published use of this form, fetching further pages on
 * demand so only a single preview is ever mounted per card.
 */
function FormCard({
    component,
    variation,
    scanned,
    propDefaults,
    docTypeFilter,
    pinned,
    collapsed = false,
    onToggle,
    titleFor,
}: {
    component: ComponentReference
    variation: ComponentVariation
    scanned: number
    propDefaults: Record<string, string>
    docTypeFilter: string | undefined
    pinned: ComponentInstance[]
    /** Tail forms start folded to their header; the header toggles them */
    collapsed?: boolean
    onToggle?: () => void
    titleFor?: TitleFor
}): React.ReactElement {
    // Curated picks of this form lead its pager; the representative follows.
    const initialItems = useMemo(() => {
        const items = pinned.filter(
            (instance) => instance.variation === variation.signature
        )
        if (
            !items.some(
                (instance) =>
                    instanceKey(instance) ===
                    instanceKey(variation.representative)
            )
        )
            items.push(variation.representative)
        return items
    }, [pinned, variation])
    const pinnedKeys = useMemo(() => new Set(pinned.map(instanceKey)), [pinned])

    const [items, setItems] = useState<ComponentInstance[]>(initialItems)
    const [total, setTotal] = useState<number | undefined>(variation.count)
    const [index, setIndex] = useState(0)
    const [pageToFetch, setPageToFetch] = useState<number | null>(null)
    const [advancePending, setAdvancePending] = useState(false)

    // A doc-type filter invalidates the unfiltered seed: restart the pager
    // against the filtered listing (total arrives with the first page).
    useEffect(() => {
        setItems(docTypeFilter === undefined ? initialItems : [])
        setTotal(docTypeFilter === undefined ? variation.count : undefined)
        setIndex(0)
        setPageToFetch(docTypeFilter === undefined ? null : 0)
        setAdvancePending(false)
        // initialItems only changes with the response that also recreates
        // this card; the filter is what resets the pager.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docTypeFilter])

    const query = new URLSearchParams({ variation: variation.signature })
    if (docTypeFilter !== undefined) query.set("docType", docTypeFilter)
    if (pageToFetch !== null && pageToFetch > 0)
        query.set("page", String(pageToFetch))
    const response = useAdminJson<ComponentInstancesResponse>(
        pageToFetch === null
            ? undefined
            : `/api/gdocs-reference/components/${component.id}/instances.json?${query.toString()}`
    )

    useEffect(() => {
        if (!response) return
        setTotal(response.total)
        setItems((previous) => {
            const seen = new Set(previous.map(instanceKey))
            const fresh = response.instances.filter(
                (instance) => !seen.has(instanceKey(instance))
            )
            return fresh.length > 0 ? [...previous, ...fresh] : previous
        })
    }, [response])

    useEffect(() => {
        if (!advancePending) return
        if (index + 1 < items.length) {
            setIndex(index + 1)
            setAdvancePending(false)
        } else if (total !== undefined && items.length >= total) {
            setAdvancePending(false)
        }
    }, [advancePending, items, index, total])

    const isLoading = pageToFetch !== null && response === undefined
    const current = items[index]
    const shownTotal = total ?? variation.count
    const onNext = (): void => {
        if (index + 1 < items.length) setIndex(index + 1)
        else if (!isLoading && items.length < shownTotal) {
            setAdvancePending(true)
            setPageToFetch(pageToFetch === null ? 0 : pageToFetch + 1)
        }
    }

    const parts = useMemo(
        () => formDefiningParts(component, variation),
        [component, variation]
    )

    const label = fractionUsageLabel(variation.count, scanned)
    return (
        <div
            className="gdocs-ref-live__form-card"
            id={formAnchorId(variation.signature)}
        >
            {onToggle ? (
                <button
                    type="button"
                    className="gdocs-ref-live__form-card-header gdocs-ref-live__form-card-header--toggle"
                    aria-expanded={!collapsed}
                    onClick={onToggle}
                >
                    <FormTitle
                        parts={parts}
                        defaults={propDefaults}
                        titleFor={titleFor}
                    />
                    <span className="gdocs-ref-live__form-card-header-end">
                        <FrequencyBadge
                            label={label}
                            title={`${variation.count} of ${scanned} published uses`}
                        />
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className="gdocs-ref-live__form-card-chevron"
                        />
                    </span>
                </button>
            ) : (
                <div className="gdocs-ref-live__form-card-header">
                    <FormTitle
                        parts={parts}
                        defaults={propDefaults}
                        titleFor={titleFor}
                    />
                    <FrequencyBadge
                        label={label}
                        title={`${variation.count} of ${scanned} published uses`}
                    />
                </div>
            )}
            {!collapsed && (
                <div className="gdocs-ref-live__form-card-body">
                    <div className="gdocs-ref-live__form-example">
                        {current ? (
                            <>
                                <GdocsReferenceExample
                                    archie={current.archie ?? ""}
                                    previewPath={instancePreviewPath(current)}
                                />
                                <div className="gdocs-ref-live__form-example-footer">
                                    <InstanceProvenance
                                        instance={current}
                                        curated={pinnedKeys.has(
                                            instanceKey(current)
                                        )}
                                    />
                                    {shownTotal > 1 && (
                                        <span className="gdocs-ref-live__pager">
                                            <button
                                                type="button"
                                                className="gdocs-ref-live__pager-button"
                                                disabled={index === 0}
                                                title="Previous example"
                                                onClick={() =>
                                                    setIndex(
                                                        Math.max(0, index - 1)
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon
                                                    icon={faChevronLeft}
                                                />
                                            </button>
                                            example {index + 1} of {shownTotal}
                                            <button
                                                type="button"
                                                className="gdocs-ref-live__pager-button"
                                                disabled={
                                                    index + 1 >= shownTotal ||
                                                    isLoading
                                                }
                                                title="Next example"
                                                onClick={onNext}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faChevronRight}
                                                />
                                            </button>
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="gdocs-ref-live__loading">
                                {isLoading
                                    ? "Loading examples…"
                                    : "No published use matches this filter."}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

/** A sidecar example whose form no published doc uses yet — dashed "new". */
function SyntheticFormCard({
    component,
    info,
    titleFor,
}: {
    component: ComponentReference
    info: SyntheticExampleInfo
    titleFor?: TitleFor
}): React.ReactElement | null {
    return (
        <div className="gdocs-ref-live__form-card gdocs-ref-live__form-card--synthetic">
            <div className="gdocs-ref-live__form-card-header">
                {info.signature ? (
                    <FormTitle
                        parts={formDefiningParts(component, {
                            signature: info.signature,
                        } as ComponentVariation)}
                        synthetic
                        titleFor={titleFor}
                    />
                ) : (
                    <span className="gdocs-ref-live__form-title-part gdocs-ref-live__form-title-part--synthetic gdocs-ref-live__form-title-part--default">
                        Reference example
                    </span>
                )}
                <FrequencyBadge
                    label="unused"
                    dashed
                    title="Not used in any published doc yet — reference example"
                />
            </div>
            <div className="gdocs-ref-live__form-card-synthetic-body">
                <p className="gdocs-ref-live__synthetic-note">
                    No published document uses this form yet — this is the
                    reference example from the docs.
                </p>
                <GdocsReferenceExample
                    archie={info.archie}
                    previewPath={`/gdocs-reference/components/${component.id}/preview?example=${info.exampleIndex}`}
                />
            </div>
        </div>
    )
}

// Forms beyond this many stack as cards only when curated-named; the rest
// wait in a compact long-tail list and expand into a card on demand. (The
// design's per-property facet filter is a possible future refinement.)
const FORM_CARD_LIMIT = 6

/**
 * "Its forms" — the unified section where observed forms, their frequency,
 * one real example each, the dashed "new" reference forms, and the derived
 * properties table live together.
 */
export function ComponentForms({
    component,
    usage,
    typeLinks,
    notes,
    titleFor,
}: {
    component: ComponentReference
    usage: ComponentUsage | undefined
    typeLinks: PropTypeLinks
    notes?: React.ReactNode
    titleFor?: TitleFor
}): React.ReactElement {
    const [docTypeFilter, setDocTypeFilter] = useState<string | undefined>()
    const [expandedTail, setExpandedTail] = useState<Set<string>>(new Set())

    // One unfiltered fetch drives the whole section: forms, synthetic
    // matches, curated pins, per-prop adoption. Per-form example paging and
    // doc-type scoping happen inside each card.
    const response = useAdminJson<ComponentInstancesResponse>(
        component.system
            ? undefined
            : `/api/gdocs-reference/components/${component.id}/instances.json`
    )

    if (!component.system && response === undefined)
        return (
            <section className="gdocs-ref__section">
                <h2 className="gdocs-ref__section-title">Its forms</h2>
                <p className="gdocs-ref-live__loading">
                    Looking up published uses…
                </p>
            </section>
        )

    // Registry-only degradation: platform blocks and DB-less sessions still
    // get the derived properties table.
    if (component.system || response === null || !response)
        return (
            <section className="gdocs-ref__section">
                <ComponentProperties
                    component={component}
                    typeLinks={typeLinks}
                    notes={notes}
                    titleFor={titleFor}
                />
            </section>
        )

    const scanned = response.scanned
    const variations = response.variations
    const unobservedSynthetic = response.syntheticExamples.filter(
        (example) => !example.observed
    )
    const cards = variations.slice(0, FORM_CARD_LIMIT)
    const tail = variations.slice(FORM_CARD_LIMIT)
    const docTypesInUse = usage?.byDocType.map((entry) => entry.docType) ?? []

    return (
        <section className="gdocs-ref__section">
            <div className="gdocs-ref-live__forms-header">
                <h2 className="gdocs-ref__section-title">Its forms</h2>
                {docTypesInUse.length > 1 && (
                    <label className="gdocs-ref-live__forms-scope">
                        Examples from{" "}
                        <select
                            className="gdocs-ref-live__doc-type-select"
                            value={docTypeFilter ?? ""}
                            onChange={(event) =>
                                setDocTypeFilter(
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
                    </label>
                )}
            </div>
            {response.stalePins.length > 0 && (
                <p className="gdocs-ref-live__stale">
                    Stale pinned example
                    {response.stalePins.length > 1 && "s"} in the sidecar:{" "}
                    {response.stalePins
                        .map(
                            (pin) =>
                                pin.slug + (pin.nth ? ` (#${pin.nth})` : "")
                        )
                        .join(", ")}{" "}
                    — the document is unpublished or no longer uses this
                    component.
                </p>
            )}
            {variations.length === 0 && (
                <p className="gdocs-ref-live__loading">
                    No published document uses this component yet.
                </p>
            )}
            {cards.map((variation) => (
                <FormCard
                    key={variation.signature}
                    component={component}
                    variation={variation}
                    scanned={scanned}
                    propDefaults={response.propDefaults}
                    docTypeFilter={docTypeFilter}
                    pinned={response.pinned}
                    titleFor={titleFor}
                />
            ))}
            {unobservedSynthetic.map((example) => (
                <SyntheticFormCard
                    key={`synthetic-${example.exampleIndex}`}
                    component={component}
                    info={example}
                    titleFor={titleFor}
                />
            ))}
            {tail.length > 0 && (
                <div className="gdocs-ref-live__form-tail">
                    <div className="gdocs-ref-live__form-tail-title">
                        {tail.length} less frequent form
                        {tail.length > 1 && "s"}
                    </div>
                    {tail.map((variation) => (
                        <FormCard
                            key={variation.signature}
                            component={component}
                            variation={variation}
                            scanned={scanned}
                            propDefaults={response.propDefaults}
                            docTypeFilter={docTypeFilter}
                            pinned={response.pinned}
                            collapsed={!expandedTail.has(variation.signature)}
                            onToggle={() => {
                                const next = new Set(expandedTail)
                                if (next.has(variation.signature))
                                    next.delete(variation.signature)
                                else next.add(variation.signature)
                                setExpandedTail(next)
                            }}
                            titleFor={titleFor}
                        />
                    ))}
                </div>
            )}
            <ComponentProperties
                component={component}
                live={{
                    propAdoption: response.propAdoption,
                    scanned,
                    propDefaults: response.propDefaults,
                }}
                typeLinks={typeLinks}
                notes={notes}
                titleFor={titleFor}
            />
        </section>
    )
}

// -----------------------------------------------------------------------------
// Component page: the derived properties table
// -----------------------------------------------------------------------------

/**
 * What the properties table links a type name to: the component's own
 * reference page when the type is a block of the authoring vocabulary, its
 * definition on GitHub (via the registry's typeSources) otherwise.
 */
export interface PropTypeLinks {
    componentIdByTypeName: Map<string, string>
    typeSources: Record<string, string>
}

// Is every branch of the type text a quoted string literal? Matches both a
// lone literal ('"info"') and a union ('"wide" | "narrow"').
function isLiteralUnionTypeText(text: string): boolean {
    const branches = text.split("|").map((branch) => branch.trim())
    return (
        branches.length > 0 &&
        branches.every((branch) => /^(['"]).*\1$/.test(branch))
    )
}

/**
 * The Type cell of the properties table. Fixed choices and booleans render as
 * value chips — the words an author actually types, not TS syntax — and
 * every other declared type renders as its type text with known type names
 * linked to their component page or definition.
 */
/** Fixed choices rendered as chips: booleans and literal unions. */
function choiceValues(prop: ComponentProp): string[] | undefined {
    return prop.type === "boolean"
        ? ["true", "false"]
        : isLiteralUnionTypeText(prop.type)
          ? prop.type.split("|").map((branch) => branch.trim().slice(1, -1))
          : undefined
}

function PropTypeCell({
    prop,
    typeLinks,
    defaultValue,
}: {
    prop: ComponentProp
    typeLinks: PropTypeLinks
    defaultValue: string | undefined
}): React.ReactElement {
    const chipValues = choiceValues(prop)
    if (chipValues)
        return (
            <span className="gdocs-ref-live__props-choices" title={prop.type}>
                {chipValues.map((value) => (
                    <code
                        key={value}
                        className={
                            value === defaultValue
                                ? "gdocs-ref-live__props-choice gdocs-ref-live__props-choice--default"
                                : "gdocs-ref-live__props-choice"
                        }
                        title={
                            value === defaultValue
                                ? "What you get when the property is omitted"
                                : undefined
                        }
                    >
                        {value}
                    </code>
                ))}
            </span>
        )

    // The declared type text, with each known type name linked.
    const parts: React.ReactNode[] = []
    let last = 0
    for (const match of prop.type.matchAll(/[A-Za-z_]\w*/g)) {
        const name = match[0]
        const componentId = typeLinks.componentIdByTypeName.get(name)
        const sourceFile = typeLinks.typeSources[name]
        if (componentId === undefined && sourceFile === undefined) continue
        if (match.index > last) parts.push(prop.type.slice(last, match.index))
        parts.push(
            componentId !== undefined ? (
                <Link
                    key={match.index}
                    className="gdocs-ref-live__props-type-link"
                    to={`/gdocs-reference/components/${componentId}`}
                    title={`Open the {.${componentId}} component page`}
                >
                    {name}
                </Link>
            ) : (
                <a
                    key={match.index}
                    className="gdocs-ref-live__props-type-link"
                    href={githubBlobUrl(sourceFile)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View the type definition on GitHub"
                >
                    {name}
                </a>
            )
        )
        last = match.index + name.length
    }
    parts.push(prop.type.slice(last))
    return <code className="gdocs-ref__field-type">{parts}</code>
}

/**
 * Every declared property of the block, from the type definitions — the
 * derived, exhaustive replacement for hand-written "x is optional" prose —
 * joined with live adoption and the observed forms that set each prop.
 * Authored sidecar notes render underneath: reasons stay human, facts stay
 * computed.
 */
function ComponentProperties({
    component,
    live,
    typeLinks,
    notes,
    titleFor,
}: {
    component: ComponentReference
    live?: PropAdoptionInfo
    typeLinks: PropTypeLinks
    notes?: React.ReactNode
    titleFor?: TitleFor
}): React.ReactElement | null {
    if (component.props.length === 0 && !notes) return null
    const hasLive = live !== undefined && live.scanned > 0
    // Effect descriptions are authored in the sidecar's "## Properties"
    // section; components whose sidecar has none keep the narrower table.
    const hasDescriptions = component.props.some((prop) => prop.description)

    const requirement = (prop: ComponentReference["props"][number]): string =>
        isEffectivelyRequired(prop, hasLive ? live : undefined)
            ? "required"
            : "optional"

    // Required props first; the stable sort keeps declaration order within
    // each group.
    const orderedProps = [...component.props].sort(
        (a, b) =>
            Number(requirement(b) === "required") -
            Number(requirement(a) === "required")
    )

    return (
        <div className="gdocs-ref-live__props">
            <div className="gdocs-ref-live__props-header">
                <span className="gdocs-ref-live__props-title">Properties</span>
                <span className="gdocs-ref-live__props-source">
                    derived from <code>{component.typeName}</code> · exhaustive,
                    auto-updated
                    {hasDescriptions && " · effects authored in the sidecar"}
                </span>
            </div>
            {component.props.length > 0 && (
                <table className="gdocs-ref-live__props-table">
                    <thead>
                        <tr>
                            <th>Prop</th>
                            <th>Type</th>
                            <th>Req.</th>
                            {hasDescriptions && <th>What it does</th>}
                            {hasLive && <th>Adoption</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {orderedProps.map((prop) => {
                            const adoption = live?.propAdoption[prop.name] ?? 0
                            const defaultValue = live?.propDefaults?.[prop.name]
                            const content = isContentProp(prop)
                            return (
                                <tr key={prop.name}>
                                    <td>
                                        <code>{prop.name}</code>
                                    </td>
                                    <td>
                                        <PropTypeCell
                                            prop={prop}
                                            typeLinks={typeLinks}
                                            defaultValue={defaultValue}
                                        />
                                    </td>
                                    <td
                                        className={
                                            requirement(prop) === "required"
                                                ? "gdocs-ref-live__props-required"
                                                : "gdocs-ref-live__props-optional"
                                        }
                                    >
                                        {requirement(prop)}
                                        {defaultValue !== undefined &&
                                            !choiceValues(prop) && (
                                                <span className="gdocs-ref-live__props-default">
                                                    default{" "}
                                                    <code>{defaultValue}</code>
                                                </span>
                                            )}
                                    </td>
                                    {hasDescriptions && (
                                        <td className="gdocs-ref-live__props-effect">
                                            {prop.description ? (
                                                <InlineMarkdownText
                                                    text={prop.description}
                                                    titleFor={titleFor}
                                                />
                                            ) : (
                                                <span className="gdocs-ref-live__props-optional">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    )}
                                    {hasLive && (
                                        <td>
                                            {content ? (
                                                <span
                                                    className="gdocs-ref-live__props-optional"
                                                    title="Content blocks aren't indexed for usage analysis"
                                                >
                                                    —
                                                </span>
                                            ) : (
                                                <FrequencyBadge
                                                    label={fractionUsageLabel(
                                                        adoption,
                                                        live.scanned
                                                    )}
                                                    title={`Authored in ${adoption} of ${live.scanned} published uses`}
                                                />
                                            )}
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}
            {notes && (
                <div className="gdocs-ref-live__props-notes">
                    <div className="gdocs-ref-live__props-notes-title">
                        Authored notes
                    </div>
                    {notes}
                </div>
            )}
        </div>
    )
}

// -----------------------------------------------------------------------------
// Template page: skeleton scaffold
// -----------------------------------------------------------------------------

export function SkeletonScaffold({
    template,
}: {
    template: TemplateReference
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
// Template page: a real document, rendered
// -----------------------------------------------------------------------------

// The rendered document is capped at this height and scrolls within it — a
// whole article runs to many screens.
const DOCUMENT_PREVIEW_MAX_HEIGHT = 640

/** Admin route rendering an exemplar as the site does — a profile for its first entity */
function documentPreviewPath(exemplar: ExemplarOutline): string {
    const entity = exemplar.entitySlug
        ? `?entity=${encodeURIComponent(exemplar.entitySlug)}`
        : ""
    return `/gdocs-reference/documents/${encodeURIComponent(exemplar.gdocId)}/preview${entity}`
}

function ExemplarLink({
    exemplar,
}: {
    exemplar: ExemplarOutline
}): React.ReactElement {
    return (
        <a href={liveUrl(exemplar)} target="_blank" rel="noopener">
            {exemplar.title} <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
        </a>
    )
}

/**
 * "What an article looks like": the template's first exemplar — an
 * editorially chosen published document — rendered whole in the same
 * preview frame component examples use, so an author sees a real one before
 * the abstract shape is laid out. Further exemplars are offered as links.
 */
export function ExemplarPreview({
    template,
}: {
    template: TemplateReference
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
                <p className="gdocs-ref-live__loading">
                    Loading a published example…
                </p>
            </section>
        )
    const [first, ...others] = response.exemplars
    const noun = template.title.toLowerCase()
    return (
        <section className="gdocs-ref__section">
            {first && (
                <>
                    <h2 className="gdocs-ref__section-title">
                        What {indefinite(noun)} looks like
                    </h2>
                    <p className="gdocs-ref__section-desc">
                        <em>{first.title}</em>, a real, published{" "}
                        {docTypeNoun(first.docType, false)}, rendered as it
                        appears on the site.{" "}
                        <a href={liveUrl(first)} target="_blank" rel="noopener">
                            Read it on the site{" "}
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                        </a>
                    </p>
                    <GdocsReferenceExample
                        previewPath={documentPreviewPath(first)}
                        maxHeight={DOCUMENT_PREVIEW_MAX_HEIGHT}
                        previewTitle={`“${first.title}”, rendered`}
                    />
                    {others.length > 0 && (
                        <p className="gdocs-ref-live__more-exemplars">
                            Also see{" "}
                            {joinNodes(
                                others.map((exemplar) => (
                                    <ExemplarLink
                                        key={exemplar.slug}
                                        exemplar={exemplar}
                                    />
                                )),
                                " and "
                            )}
                            .
                        </p>
                    )}
                </>
            )}
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
 * each with its usage on the shared vocabulary and the first line of its
 * decision prose.
 */
export function TemplateComponentShortlist({
    template,
    usage,
    components,
}: {
    template: TemplateReference
    usage: GdocsReferenceUsage | undefined | null
    components: ComponentReference[]
}): React.ReactElement | null {
    const rows = useMemo(() => {
        if (!usage) return []
        const docType = template.id as OwidGdocType
        const entries: {
            component: ComponentReference
            label: ComponentUsageLabel
            docsUsingIt: number
            totalDocs: number
            fraction: number
        }[] = []
        for (const componentUsage of usage.components) {
            const byType = componentUsage.byDocType.find(
                (entry) => entry.docType === docType
            )
            if (!byType || byType.label === "rare" || byType.label === "unused")
                continue
            const component = components.find(
                (candidate) => candidate.id === componentUsage.componentId
            )
            if (!component) continue
            entries.push({
                component,
                label: byType.label,
                docsUsingIt: byType.docsUsingIt,
                totalDocs: byType.totalDocs,
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
                {rows.map(({ component, label, docsUsingIt, totalDocs }) => (
                    <li
                        key={component.id}
                        className="gdocs-ref-live__shortlist-row"
                    >
                        <Link
                            className="gdocs-ref-live__shortlist-title"
                            to={`/gdocs-reference/components/${component.id}`}
                        >
                            {component.title}
                        </Link>
                        <FrequencyBadge
                            label={label}
                            title={`Used in ${docsUsingIt} of ${totalDocs} published ${docTypeNoun(
                                template.id as OwidGdocType,
                                totalDocs !== 1
                            )}`}
                        />
                        <span className="gdocs-ref-live__shortlist-desc">
                            {firstSentence(component.prose.intro)}
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
