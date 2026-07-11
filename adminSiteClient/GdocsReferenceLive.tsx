import { Fragment, useEffect, useMemo, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowUpRightFromSquare,
    faChevronLeft,
    faChevronRight,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons"
import {
    COMPONENT_USAGE_LABELS,
    ComponentDoc,
    ComponentDraftResponse,
    ComponentInstance,
    ComponentInstancesResponse,
    ComponentPropDoc,
    ComponentUsage,
    ComponentUsageLabel,
    ComponentVariation,
    ExemplarOutline,
    ExemplarSection,
    GdocsReferenceUsage,
    OwidGdocType,
    SyntheticExampleInfo,
    TemplateDoc,
    TemplateExemplarsResponse,
} from "@ourworldindata/types"
import { Link } from "./Link.js"
import {
    CopyButton,
    CopyPromptButton,
    GdocsReferenceExample,
} from "./GdocsReferenceExample.js"
import {
    docTypeNoun,
    FREQUENCY_DOTS,
    fractionUsageLabel,
    githubBlobUrl,
    humanizeVariation,
    indefinite,
    joinWithAnd,
    liveUrl,
    MAJOR_DOC_TYPES,
    useAdminJson,
} from "./gdocsReferenceLiveHelpers.js"

/**
 * The live (database-backed) half of the writing reference UI: the frequency
 * vocabulary, the where-it's-used sentence, the forms section with real examples,
 * the derived properties table, and the template exemplar x-rays. Everything
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
 * data insights"). Enough for an author's decision without a per-type chart
 * competing with the forms below; the raw counts live in tooltips. Each doc
 * type links to its template page when one exists.
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
                                group.entries.map((entry) =>
                                    docTypeName(
                                        entry.docType,
                                        `Used in ${entry.docsUsingIt} of ${entry.totalDocs} published ${docTypeNoun(
                                            entry.docType,
                                            entry.totalDocs !== 1
                                        )}`
                                    )
                                ),
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

/** The label a form reads as: the humanized form signature. */
function formLabel(variation: ComponentVariation): string {
    return variation.signature === ""
        ? "The standard form"
        : humanizeVariation(variation.signature)
}

/** The name chip of a form. */
function FormNameChip({
    variation,
}: {
    variation: ComponentVariation
}): React.ReactElement {
    return (
        <span className="gdocs-ref-live__form-name">
            {formLabel(variation)}
        </span>
    )
}

// -----------------------------------------------------------------------------
// Component page: the form builder — reading a form and building one are one
// gesture apart. Every property in a card's Sets column is click-to-cycle;
// the first cycle flips the card into a visibly distinct draft state whose
// example re-renders live, and Copy exports whatever the author has shaped.
// -----------------------------------------------------------------------------

/** Overrides an author cycled in the builder: a value sets the prop, null removes it. */
type DraftOverrides = Record<string, string | null>

// Child blocks are omitted from the stored configs the usage index is built
// on, so adoption of block-content props is unmeasurable — and the builder
// cannot cycle a list of blocks. (Span props are flattened to plain text and
// kept, so they stay measurable and cyclable.)
function isContentProp(prop: ComponentPropDoc): boolean {
    return /Enriched/.test(prop.type)
}

interface PropAdoptionInfo {
    propAdoption: Record<string, number>
    scanned: number
}

// Declared required on the enriched type, but the parser fills a default when
// omitted — proven by uses whose minimal source drops it.
function isEffectivelyRequired(
    prop: ComponentPropDoc,
    live: PropAdoptionInfo | undefined
): boolean {
    if (prop.optional) return false
    if (
        live &&
        live.scanned > 0 &&
        !isContentProp(prop) &&
        (live.propAdoption[prop.name] ?? 0) < live.scanned
    )
        return false
    return true
}

/**
 * One stop on a property's cycle ring. The base stop stands for "whatever the
 * example this draft started from authors" — reaching it removes the override
 * instead of restating the value, so cycling all the way around a ring leaves
 * no draft behind.
 */
interface CycleStop {
    value: string | null
    isBase?: boolean
}

/** The literal values a declared type text allows, e.g. `"narrow" | "wide"`. */
function literalValues(type: string): string[] {
    const values: string[] = []
    for (const token of type.split("|").map((part) => part.trim())) {
        const quoted = /^"([^"]*)"$/.exec(token)
        if (quoted) values.push(quoted[1])
        else if (/^-?\d+(\.\d+)?$/.test(token)) values.push(token)
        else if (token === "boolean") values.push("true", "false")
        else if (token === "true" || token === "false") values.push(token)
    }
    return values
}

/**
 * Values of a value-salient prop observed across the component's forms —
 * they fill the ring for enum-typed props whose declared type text carries
 * no literals (e.g. `PullQuoteAlignment`).
 */
function observedValues(
    variations: ComponentVariation[],
    name: string
): string[] {
    const values: string[] = []
    for (const variation of variations) {
        for (const part of variation.signature.split("+")) {
            const colon = part.indexOf(":")
            if (colon > 0 && part.slice(0, colon) === name)
                values.push(part.slice(colon + 1))
        }
    }
    return values
}

/**
 * Scalar prop values readable off the example's minimal ArchieML — display
 * material for the value chips, and the "back to base" stop of each ring.
 * Multiline and nested values simply stay unknown (the chip reads "set").
 */
function parseArchieScalars(
    archie: string | undefined,
    propNames: Set<string>
): Map<string, string> {
    const map = new Map<string, string>()
    if (!archie) return map
    for (const line of archie.split("\n")) {
        const match = /^([A-Za-z][\w-]*):\s*(.+)$/.exec(line)
        if (match && propNames.has(match[1]) && !map.has(match[1]))
            map.set(match[1], match[2].trim())
    }
    return map
}

/** One property row of a form card's Sets column, with its cycle ring. */
interface BuilderRow {
    name: string
    /** Chip text before any override: the authored value, "set", or "none" */
    baseDisplay: string
    baseSet: boolean
    stops: CycleStop[]
    required: boolean
    content: boolean
}

function buildRows(
    doc: ComponentDoc,
    variation: ComponentVariation,
    baseScalars: Map<string, string>,
    variations: ComponentVariation[],
    live: PropAdoptionInfo | undefined
): BuilderRow[] {
    const valueProps = new Set(doc.valueProps ?? [])
    const signatureParts =
        variation.signature === "" ? [] : variation.signature.split("+")
    const signatureNames = new Set(
        signatureParts.map((part) => part.split(":")[0])
    )
    const signatureValue = (name: string): string | undefined => {
        for (const part of signatureParts) {
            const colon = part.indexOf(":")
            if (colon > 0 && part.slice(0, colon) === name)
                return part.slice(colon + 1)
        }
        return undefined
    }

    const rows = doc.props.map((prop): BuilderRow => {
        const required = isEffectivelyRequired(prop, live)
        const content = isContentProp(prop)
        const baseKnown =
            signatureValue(prop.name) ?? baseScalars.get(prop.name)
        // Required props are part of every instance even when the signature
        // omits them as universal scaffolding.
        const baseSet =
            signatureNames.has(prop.name) ||
            baseKnown !== undefined ||
            (required && !content)
        const stops: CycleStop[] = [
            { value: baseSet ? (baseKnown ?? null) : null, isBase: true },
        ]
        if (!content) {
            const literals = [
                ...new Set([
                    ...literalValues(prop.type),
                    ...(valueProps.has(prop.name)
                        ? observedValues(variations, prop.name)
                        : []),
                ]),
            ]
            for (const literal of literals) {
                if (baseSet && baseKnown === literal) continue
                stops.push({ value: literal })
            }
            // Free-form props (no literal values to offer) only toggle
            // between the example's own value and none — the builder never
            // invents a string.
            if (!required && baseSet) stops.push({ value: null })
        }
        return {
            name: prop.name,
            baseDisplay: baseKnown ?? (baseSet ? "set" : "none"),
            baseSet,
            stops,
            required,
            content,
        }
    })

    // Set props lead (they are what the form is), then the unset cyclable
    // ones, then the fixed scaffolding — stable within each group.
    const rank = (row: BuilderRow): number =>
        row.baseSet && row.stops.length > 1 ? 0 : row.stops.length > 1 ? 1 : 2
    return rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
        .map(({ row }) => row)
}

/**
 * The signature the drafted combination would have, from the surviving props
 * of its minimal source — the same parts model the server uses, so the draft
 * can be recognized as an observed form when it lands on one.
 */
function draftSignature(
    draftProps: Record<string, unknown>,
    doc: ComponentDoc,
    variations: ComponentVariation[],
    live: PropAdoptionInfo
): string {
    const valueProps = new Set(doc.valueProps ?? [])
    // A prop authored on every scanned instance and absent from every form
    // signature is universal scaffolding — the server excludes it from
    // signatures, so the draft's signature must too.
    const signatureNames = new Set(
        variations.flatMap((variation) =>
            variation.signature === ""
                ? []
                : variation.signature
                      .split("+")
                      .map((part) => part.split(":")[0])
        )
    )
    const parts: string[] = []
    for (const [name, value] of Object.entries(draftProps)) {
        if (
            live.scanned > 0 &&
            (live.propAdoption[name] ?? 0) >= live.scanned &&
            !signatureNames.has(name)
        )
            continue
        parts.push(
            valueProps.has(name) &&
                (typeof value === "string" || typeof value === "number")
                ? `${name}:${value}`
                : name
        )
    }
    return parts.sort().join("+")
}

/** One clickable property row: name on the left, its cycling value chip on the right. */
function BuilderPropRow({
    row,
    override,
    hasOverride,
    onCycle,
    disabled,
}: {
    row: BuilderRow
    override: string | null | undefined
    hasOverride: boolean
    onCycle: (name: string, stop: CycleStop) => void
    disabled: boolean
}): React.ReactElement {
    const cyclable = !disabled && row.stops.length > 1
    const display = hasOverride
        ? (override ?? "none")
        : row.baseSet
          ? row.baseDisplay
          : "none"
    const valueClassName = [
        "gdocs-ref-live__form-prop-value",
        display === "none" && "gdocs-ref-live__form-prop-value--none",
        hasOverride && "gdocs-ref-live__form-prop-value--overridden",
    ]
        .filter(Boolean)
        .join(" ")
    const onClick = (): void => {
        const currentIndex = hasOverride
            ? row.stops.findIndex(
                  (stop) => !stop.isBase && stop.value === override
              )
            : 0
        const next =
            row.stops[(currentIndex + 1) % row.stops.length] ?? row.stops[0]
        onCycle(row.name, next)
    }
    return (
        <div className="gdocs-ref-live__form-prop">
            <code className="gdocs-ref-live__form-prop-name">{row.name}</code>
            {cyclable ? (
                <button
                    type="button"
                    className={valueClassName}
                    title="Click to cycle values"
                    onClick={onClick}
                >
                    <span className="gdocs-ref-live__form-prop-value-text">
                        {display}
                    </span>
                    <FontAwesomeIcon icon={faRotateRight} />
                </button>
            ) : row.content ? (
                <span
                    className="gdocs-ref-live__form-prop-fixed"
                    title={
                        row.required
                            ? "Always authored — not a choice the builder can cycle"
                            : "Block content — not a choice the builder can cycle"
                    }
                >
                    {row.required ? "required" : "—"}
                </span>
            ) : (
                <span
                    className={valueClassName}
                    title={
                        row.required
                            ? "Always authored — not a choice the builder can cycle"
                            : "Free-form value — the builder can only cycle it when this example sets one"
                    }
                >
                    <span className="gdocs-ref-live__form-prop-value-text">
                        {display}
                    </span>
                </span>
            )}
        </div>
    )
}

/**
 * The Sets column of a form card: every declared property with its value on
 * this form, click-to-cycle. Signature parts of props the registry does not
 * declare (rare) still render as static chips so no form ever hides a part.
 */
function BuilderProps({
    rows,
    extraParts,
    overrides,
    onCycle,
    disabled,
    isDraft,
}: {
    rows: BuilderRow[]
    extraParts: string[]
    overrides: DraftOverrides
    onCycle: (name: string, stop: CycleStop) => void
    disabled: boolean
    isDraft: boolean
}): React.ReactElement {
    const anyCyclable = !disabled && rows.some((row) => row.stops.length > 1)
    return (
        <div
            className={
                isDraft
                    ? "gdocs-ref-live__form-sets gdocs-ref-live__form-sets--draft"
                    : "gdocs-ref-live__form-sets"
            }
        >
            <div className="gdocs-ref-live__form-sets-title">
                {isDraft ? "Properties" : "Sets"}
            </div>
            {anyCyclable && (
                <div className="gdocs-ref-live__form-sets-hint">
                    click a value to cycle
                </div>
            )}
            {rows.length === 0 && extraParts.length === 0 && (
                <div className="gdocs-ref-live__form-sets-empty">
                    Nothing — the base form.
                </div>
            )}
            <div className="gdocs-ref-live__form-props">
                {rows.map((row) => (
                    <BuilderPropRow
                        key={row.name}
                        row={row}
                        override={overrides[row.name]}
                        hasOverride={row.name in overrides}
                        onCycle={onCycle}
                        disabled={disabled}
                    />
                ))}
                {extraParts.map((part) => {
                    const [key, value] = part.split(":")
                    return (
                        <span key={part} className="gdocs-ref-live__form-set">
                            {value === undefined || value === "true"
                                ? key
                                : `${key}: ${value}`}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

const instanceKey = (instance: ComponentInstance): string =>
    `${instance.gdocId}-${instance.path}`

// DOM id of a form's card, so the properties table can cross-link into it
const formAnchorId = (signature: string): string =>
    "form-" + (signature.replace(/[^a-z0-9]+/gi, "-") || "standard")

/**
 * One observed form of the component: its name, its frequency on the shared
 * vocabulary, the properties it sets, and one real example at a time — the
 * pager walks every published use of this form, fetching further pages on
 * demand so only a single preview is ever mounted per card.
 *
 * Every value in the Sets column cycles on click: the first cycle flips the
 * card into a draft state — visibly not an observed form — whose example
 * re-renders live and whose ArchieML the author can copy into a doc.
 */
function FormCard({
    doc,
    variation,
    variations,
    scanned,
    propAdoption,
    docTypeFilter,
    pinned,
}: {
    doc: ComponentDoc
    variation: ComponentVariation
    variations: ComponentVariation[]
    scanned: number
    propAdoption: Record<string, number>
    docTypeFilter: string | undefined
    pinned: ComponentInstance[]
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
    // The builder's cycled props; any entry flips the card into draft mode.
    const [overrides, setOverrides] = useState<DraftOverrides>({})

    // A doc-type filter invalidates the unfiltered seed: restart the pager
    // against the filtered listing (total arrives with the first page), and
    // drop any draft — its base example no longer matches the scope.
    useEffect(() => {
        setItems(docTypeFilter === undefined ? initialItems : [])
        setTotal(docTypeFilter === undefined ? variation.count : undefined)
        setIndex(0)
        setPageToFetch(docTypeFilter === undefined ? null : 0)
        setAdvancePending(false)
        setOverrides({})
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
            : `/api/gdocs-reference/components/${doc.id}/instances.json?${query.toString()}`
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // ---- the builder: cycled props reshape the current example into a draft
    const isDraft = Object.keys(overrides).length > 0
    const live = useMemo(
        () => ({ propAdoption, scanned }),
        [propAdoption, scanned]
    )
    const propNames = useMemo(
        () => new Set(doc.props.map((prop) => prop.name)),
        [doc]
    )
    const baseScalars = useMemo(
        () => parseArchieScalars(current?.archie, propNames),
        [current, propNames]
    )
    const rows = useMemo(
        () => buildRows(doc, variation, baseScalars, variations, live),
        [doc, variation, baseScalars, variations, live]
    )
    // Signature parts of props the registry does not declare still render
    const extraParts = useMemo(
        () =>
            variation.signature === ""
                ? []
                : variation.signature
                      .split("+")
                      .filter((part) => !propNames.has(part.split(":")[0])),
        [variation, propNames]
    )

    const draftQuery =
        isDraft && current
            ? `gdocId=${encodeURIComponent(current.gdocId)}&path=${encodeURIComponent(
                  current.path
              )}&overrides=${encodeURIComponent(JSON.stringify(overrides))}`
            : undefined
    const draftResponse = useAdminJson<ComponentDraftResponse>(
        draftQuery ? `/api/gdocs-reference/draft.json?${draftQuery}` : undefined
    )
    // Held across cycle clicks so the card never blanks while re-fetching.
    const [draft, setDraft] = useState<
        ComponentDraftResponse | null | undefined
    >(undefined)
    useEffect(() => {
        if (!isDraft) setDraft(undefined)
        else if (draftResponse !== undefined) setDraft(draftResponse)
    }, [isDraft, draftResponse])

    const onCycle = (name: string, stop: CycleStop): void => {
        setOverrides((previous) => {
            const next = { ...previous }
            if (stop.isBase) delete next[name]
            else next[name] = stop.value
            return next
        })
    }

    // The drafted combination, recognized when it lands on an observed form.
    const draftMatch = draft
        ? variations.find(
              (candidate) =>
                  candidate.signature ===
                  draftSignature(draft.props, doc, variations, live)
          )
        : undefined

    const label = fractionUsageLabel(variation.count, scanned)
    return (
        <div
            className={
                isDraft
                    ? "gdocs-ref-live__form-card gdocs-ref-live__form-card--draft"
                    : "gdocs-ref-live__form-card"
            }
            id={formAnchorId(variation.signature)}
        >
            {isDraft ? (
                <div className="gdocs-ref-live__form-card-header gdocs-ref-live__form-card-header--draft">
                    <span className="gdocs-ref-live__draft-badge">
                        Draft — building a form
                    </span>
                    <span className="gdocs-ref-live__draft-origin">
                        started from <em>{formLabel(variation)}</em>
                    </span>
                    <span className="gdocs-ref-live__draft-actions">
                        <button
                            type="button"
                            className="gdocs-ref-live__draft-reset"
                            title="Back to the observed form"
                            onClick={() => setOverrides({})}
                        >
                            <FontAwesomeIcon icon={faRotateRight} /> Reset
                        </button>
                        {draft && (
                            <>
                                <CopyButton
                                    text={draft.archie}
                                    label="Copy draft"
                                    className="gdocs-ref-live__draft-copy"
                                />
                                <CopyPromptButton
                                    componentId={doc.id}
                                    archie={draft.archie}
                                    className="gdocs-ref-live__draft-copy"
                                />
                            </>
                        )}
                    </span>
                </div>
            ) : (
                <div className="gdocs-ref-live__form-card-header">
                    <FormNameChip variation={variation} />
                    <FrequencyBadge
                        label={label}
                        title={`${variation.count} of ${scanned} published uses`}
                    />
                </div>
            )}
            <div className="gdocs-ref-live__form-card-body">
                <BuilderProps
                    rows={rows}
                    extraParts={extraParts}
                    overrides={overrides}
                    onCycle={onCycle}
                    disabled={!current}
                    isDraft={isDraft}
                />
                {isDraft && current ? (
                    <div className="gdocs-ref-live__form-example">
                        {draft ? (
                            <>
                                <GdocsReferenceExample
                                    archie={draft.archie}
                                    previewPath={`${instancePreviewPath(current)}&overrides=${encodeURIComponent(
                                        JSON.stringify(overrides)
                                    )}`}
                                    componentId={doc.id}
                                />
                                <p className="gdocs-ref-live__draft-note">
                                    {draftMatch ? (
                                        <>
                                            This combination is the observed
                                            form{" "}
                                            <em>{formLabel(draftMatch)}</em>.
                                        </>
                                    ) : (
                                        <>
                                            This combination isn’t an observed
                                            form yet —{" "}
                                            <strong>Copy draft</strong> to paste
                                            it into your doc.
                                        </>
                                    )}
                                </p>
                            </>
                        ) : draft === null ? (
                            <p className="gdocs-ref-live__loading">
                                This combination can’t be built from this
                                example — Reset to go back.
                            </p>
                        ) : (
                            <p className="gdocs-ref-live__loading">
                                Building the draft…
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="gdocs-ref-live__form-example">
                        {current ? (
                            <>
                                <GdocsReferenceExample
                                    archie={current.archie ?? ""}
                                    previewPath={instancePreviewPath(current)}
                                    componentId={doc.id}
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
                )}
            </div>
        </div>
    )
}

/** A sidecar example whose form no published doc uses yet — dashed "new". */
function SyntheticFormCard({
    doc,
    info,
}: {
    doc: ComponentDoc
    info: SyntheticExampleInfo
}): React.ReactElement | null {
    const label = info.signature
        ? humanizeVariation(info.signature)
        : "Reference example"
    return (
        <div className="gdocs-ref-live__form-card gdocs-ref-live__form-card--synthetic">
            <div className="gdocs-ref-live__form-card-header">
                <span className="gdocs-ref-live__form-name gdocs-ref-live__form-name--synthetic">
                    {label}
                </span>
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
                    previewPath={`/gdocs-reference/components/${doc.id}/preview?example=${info.exampleIndex}`}
                    componentId={doc.id}
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
    doc,
    usage,
    typeLinks,
    notes,
}: {
    doc: ComponentDoc
    usage: ComponentUsage | undefined
    typeLinks: PropTypeLinks
    notes?: React.ReactNode
}): React.ReactElement {
    const [docTypeFilter, setDocTypeFilter] = useState<string | undefined>()
    const [expandedTail, setExpandedTail] = useState<Set<string>>(new Set())

    // One unfiltered fetch drives the whole section: forms, synthetic
    // matches, curated pins, per-prop adoption. Per-form example paging and
    // doc-type scoping happen inside each card.
    const response = useAdminJson<ComponentInstancesResponse>(
        doc.system
            ? undefined
            : `/api/gdocs-reference/components/${doc.id}/instances.json`
    )

    if (!doc.system && response === undefined)
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
    if (doc.system || response === null || !response)
        return (
            <section className="gdocs-ref__section">
                <ComponentProperties
                    doc={doc}
                    typeLinks={typeLinks}
                    notes={notes}
                />
            </section>
        )

    const scanned = response.scanned
    const variations = response.variations
    const unobservedSynthetic = response.syntheticExamples.filter(
        (example) => !example.observed
    )
    const cards = variations.filter(
        (variation, index) =>
            index < FORM_CARD_LIMIT || expandedTail.has(variation.signature)
    )
    const tail = variations.filter((variation) => !cards.includes(variation))
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
                    doc={doc}
                    variation={variation}
                    variations={variations}
                    scanned={scanned}
                    propAdoption={response.propAdoption}
                    docTypeFilter={docTypeFilter}
                    pinned={response.pinned}
                />
            ))}
            {unobservedSynthetic.map((example) => (
                <SyntheticFormCard
                    key={`synthetic-${example.exampleIndex}`}
                    doc={doc}
                    info={example}
                />
            ))}
            {tail.length > 0 && (
                <div className="gdocs-ref-live__form-tail">
                    <div className="gdocs-ref-live__form-tail-title">
                        {tail.length} less frequent form
                        {tail.length > 1 && "s"}
                    </div>
                    {tail.map((variation) => (
                        <button
                            key={variation.signature}
                            type="button"
                            className="gdocs-ref-live__form-tail-row"
                            title={`${variation.count} of ${scanned} published uses — click to expand`}
                            onClick={() =>
                                setExpandedTail(
                                    new Set([
                                        ...expandedTail,
                                        variation.signature,
                                    ])
                                )
                            }
                        >
                            <FormNameChip variation={variation} />
                            <FrequencyGlyph
                                label={fractionUsageLabel(
                                    variation.count,
                                    scanned
                                )}
                            />
                        </button>
                    ))}
                </div>
            )}
            <ComponentProperties
                doc={doc}
                live={{ propAdoption: response.propAdoption, scanned }}
                variations={variations}
                typeLinks={typeLinks}
                notes={notes}
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
function PropTypeCell({
    prop,
    typeLinks,
}: {
    prop: ComponentPropDoc
    typeLinks: PropTypeLinks
}): React.ReactElement {
    const chipValues =
        prop.type === "boolean"
            ? ["true", "false"]
            : isLiteralUnionTypeText(prop.type)
              ? prop.type.split("|").map((branch) => branch.trim().slice(1, -1))
              : undefined
    if (chipValues)
        return (
            <span className="gdocs-ref-live__props-choices" title={prop.type}>
                {chipValues.map((value) => (
                    <code key={value} className="gdocs-ref-live__props-choice">
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
    doc,
    live,
    variations,
    typeLinks,
    notes,
}: {
    doc: ComponentDoc
    live?: { propAdoption: Record<string, number>; scanned: number }
    variations?: ComponentVariation[]
    typeLinks: PropTypeLinks
    notes?: React.ReactNode
}): React.ReactElement | null {
    if (doc.props.length === 0 && !notes) return null
    const hasLive = live !== undefined && live.scanned > 0

    const formsSettingProp = (name: string): ComponentVariation[] =>
        (variations ?? []).filter((variation) =>
            variation.signature
                .split("+")
                .some((part) => part.split(":")[0] === name)
        )

    const requirement = (prop: ComponentDoc["props"][number]): string =>
        isEffectivelyRequired(prop, hasLive ? live : undefined)
            ? "required"
            : "optional"

    // Required props first; the stable sort keeps declaration order within
    // each group.
    const orderedProps = [...doc.props].sort(
        (a, b) =>
            Number(requirement(b) === "required") -
            Number(requirement(a) === "required")
    )

    return (
        <div className="gdocs-ref-live__props">
            <div className="gdocs-ref-live__props-header">
                <span className="gdocs-ref-live__props-title">Properties</span>
                <span className="gdocs-ref-live__props-source">
                    derived from <code>{doc.typeName}</code> · exhaustive,
                    auto-updated
                </span>
            </div>
            {doc.props.length > 0 && (
                <table className="gdocs-ref-live__props-table">
                    <thead>
                        <tr>
                            <th>Prop</th>
                            <th>Type</th>
                            <th>Req.</th>
                            {hasLive && <th>Adoption</th>}
                            {hasLive && <th>Used by</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {orderedProps.map((prop) => {
                            const adoption = live?.propAdoption[prop.name] ?? 0
                            const forms = formsSettingProp(prop.name)
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
                                    </td>
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
                                    {hasLive && (
                                        <td className="gdocs-ref-live__props-used-by">
                                            {content
                                                ? "—"
                                                : adoption >= live.scanned
                                                  ? "every form"
                                                  : forms.length > 0
                                                    ? forms.map(
                                                          (
                                                              variation,
                                                              index
                                                          ) => (
                                                              <span
                                                                  key={
                                                                      variation.signature
                                                                  }
                                                              >
                                                                  {index > 0 &&
                                                                      ", "}
                                                                  <a
                                                                      href={`#${formAnchorId(variation.signature)}`}
                                                                  >
                                                                      {humanizeVariation(
                                                                          variation.signature
                                                                      )}
                                                                  </a>
                                                              </span>
                                                          )
                                                      )
                                                    : adoption > 0
                                                      ? "less frequent forms"
                                                      : "no published use yet"}
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
 * each with its usage on the shared vocabulary and the first line of its
 * decision prose.
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
            const doc = components.find(
                (component) => component.id === componentUsage.componentId
            )
            if (!doc) continue
            entries.push({
                doc,
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
                {rows.map(({ doc, label, docsUsingIt, totalDocs }) => (
                    <li key={doc.id} className="gdocs-ref-live__shortlist-row">
                        <Link
                            className="gdocs-ref-live__shortlist-title"
                            to={`/gdocs-reference/components/${doc.id}`}
                        >
                            {doc.title}
                        </Link>
                        <FrequencyBadge
                            label={label}
                            title={`Used in ${docsUsingIt} of ${totalDocs} published ${docTypeNoun(
                                template.id as OwidGdocType,
                                totalDocs !== 1
                            )}`}
                        />
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
