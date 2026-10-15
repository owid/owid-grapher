import { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faCode,
    faPenToSquare,
} from "@fortawesome/free-solid-svg-icons"
import type {
    BespokeVizRegistry,
    BespokeVizUsage,
    BundleConfigField,
    BundleReference,
    BundleUsage,
    ComponentInstance,
} from "@ourworldindata/types"
import { Link } from "./Link.js"
import { GdocsReferenceExample } from "./GdocsReferenceExample.js"
import {
    GdocsReferenceMarkdown,
    InlineMarkdownText,
    TitleFor,
} from "./GdocsReferenceMarkdown.js"
import { InstanceProvenance } from "./GdocsReferenceLive.js"
import { BESPOKE_COMPONENT_ID } from "./gdocsReferenceNav.js"
import {
    BundleVariantEntry,
    bundleUsageLabel,
    githubBlobUrl,
    githubEditUrl,
    instancePreviewPath,
    orderBundleVariants,
    sortBundlesByUse,
    useAdminJson,
} from "./gdocsReferenceLiveHelpers.js"

/**
 * The bespoke component's own pages in the writing reference. A bespoke
 * block embeds one of the bundles the dev team built, so its reference page
 * lists those bundles rather than the raw forms of the block.
 */

const REGISTRY_PATH = "/api/gdocs-reference/bespoke-viz.json"
const USAGE_PATH = "/api/gdocs-reference/bespoke-viz/usage.json"

const COMPONENT_PAGE_PATH = `/gdocs-reference/components/${BESPOKE_COMPONENT_ID}`

const bundlePagePath = (bundleId: string): string =>
    `${COMPONENT_PAGE_PATH}/${bundleId}`

// Preview paths, without /admin (GdocsReferenceExample adds it)
const bundlePreviewPath = (bundleId: string): string =>
    `/gdocs-reference/bespoke-viz/${encodeURIComponent(bundleId)}/preview`

const variantPreviewPath = (bundleId: string, variantName: string): string =>
    `${bundlePreviewPath(bundleId)}?variant=${encodeURIComponent(variantName)}`

const examplePreviewPath = (bundleId: string, exampleIndex: number): string =>
    `${bundlePreviewPath(bundleId)}?example=${exampleIndex}`

/** "Bundles" — every bundle of the registry, most used first. */
export function BespokeBundleIndex(): React.ReactElement {
    const registry = useAdminJson<BespokeVizRegistry>(REGISTRY_PATH)
    const usage = useAdminJson<BespokeVizUsage>(USAGE_PATH)

    if (registry === undefined || usage === undefined)
        return (
            <section className="gdocs-ref__section">
                <h2 className="gdocs-ref__section-title">Bundles</h2>
                <p className="gdocs-ref-live__loading">Loading the bundles…</p>
            </section>
        )

    if (registry === null)
        return (
            <section className="gdocs-ref__section">
                <h2 className="gdocs-ref__section-title">Bundles</h2>
                <p className="gdocs-ref__note">
                    We couldn't load the bundle list.
                </p>
            </section>
        )

    const usageById = new Map(
        (usage?.bundles ?? []).map((entry) => [entry.bundle, entry])
    )
    const bundles = sortBundlesByUse(registry.bundles, usage)

    return (
        <section className="gdocs-ref__section">
            <h2 className="gdocs-ref__section-title">
                Bundles
                <span className="gdocs-ref__section-count">
                    {bundles.length}
                </span>
            </h2>
            <ul className="gdocs-ref-bespoke__index">
                {bundles.map((bundle) => (
                    <li key={bundle.id} className="gdocs-ref-bespoke__row">
                        <div className="gdocs-ref-bespoke__row-name">
                            <Link
                                to={bundlePagePath(bundle.id)}
                                className="gdocs-ref-bespoke__row-title"
                            >
                                {bundle.id}
                            </Link>
                        </div>
                        <div className="gdocs-ref-bespoke__row-variants">
                            {bundle.variants
                                .map((variant) => variant.name)
                                .join(" · ")}
                        </div>
                        {/* No usage line at all when the lookup failed:
                            "not used yet" would be a false claim. */}
                        {usage && (
                            <div className="gdocs-ref-bespoke__row-usage">
                                {bundleUsageLabel(usageById.get(bundle.id))}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    )
}

// -----------------------------------------------------------------------------
// Bundle page
// -----------------------------------------------------------------------------

/** The header shared by every state of the bundle page. */
function BundleHeader({ bundleId }: { bundleId: string }): React.ReactElement {
    return (
        <header className="gdocs-ref__detail-header">
            <nav className="gdocs-ref-bespoke__breadcrumb">
                <Link to={COMPONENT_PAGE_PATH}>Bespoke Component</Link>
                <span aria-hidden="true"> › </span>
                <code>{bundleId}</code>
            </nav>
            <div className="gdocs-ref__detail-title-row">
                <h1 className="gdocs-ref__detail-title">{bundleId}</h1>
                <span className="gdocs-ref__category-pill">Bespoke bundle</span>
            </div>
        </header>
    )
}

/**
 * One bundle of the bespoke component: its variants (each with a copyable
 * default block and its published uses) and its config keys.
 */
export function BespokeBundlePage({
    bundleId,
    titleFor,
}: {
    bundleId: string
    titleFor?: TitleFor
}): React.ReactElement {
    const registry = useAdminJson<BespokeVizRegistry>(REGISTRY_PATH)
    const usage = useAdminJson<BespokeVizUsage>(USAGE_PATH)

    if (registry === undefined || usage === undefined)
        return (
            <article className="gdocs-ref__detail">
                <BundleHeader bundleId={bundleId} />
                <p className="gdocs-ref-live__loading">Loading the bundle…</p>
            </article>
        )

    if (registry === null)
        return (
            <article className="gdocs-ref__detail">
                <BundleHeader bundleId={bundleId} />
                <p className="gdocs-ref__note">We couldn't load this bundle.</p>
            </article>
        )

    const bundle = registry.bundles.find((entry) => entry.id === bundleId)
    if (!bundle)
        return (
            <div className="gdocs-ref__empty">
                No such bundle: <code>{bundleId}</code>.{" "}
                <Link to={COMPONENT_PAGE_PATH}>
                    See the bundles of the bespoke component.
                </Link>
            </div>
        )

    // undefined: the bundle has no published use; null: the lookup failed
    const bundleUsage =
        usage === null
            ? null
            : usage.bundles.find((entry) => entry.bundle === bundle.id)
    const previewPathForExample = (index: number): string =>
        examplePreviewPath(bundle.id, index)

    return (
        <article className="gdocs-ref__detail">
            <BundleHeader bundleId={bundle.id} />
            {bundle.prose.intro && (
                <GdocsReferenceMarkdown
                    body={bundle.prose.intro}
                    section="intro"
                    examples={bundle.examples}
                    previewPathForExample={previewPathForExample}
                    titleFor={titleFor}
                />
            )}
            <p className="gdocs-ref-bespoke__block-props">
                Block properties such as <code>size</code> and{" "}
                <code>fallbackImageFilename</code> are documented on the{" "}
                <Link to={COMPONENT_PAGE_PATH}>Bespoke Component</Link> page.
            </p>
            {/* Keyed so the expanded tail doesn't carry over to the next
                bundle */}
            <BundleVariants
                key={bundle.id}
                bundle={bundle}
                usage={bundleUsage}
                titleFor={titleFor}
            />
            <BundleConfigTable
                bundle={bundle}
                usage={bundleUsage}
                titleFor={titleFor}
            />
            {bundle.prose.notes && (
                <GdocsReferenceMarkdown
                    body={bundle.prose.notes}
                    section="notes"
                    examples={bundle.examples}
                    previewPathForExample={previewPathForExample}
                    titleFor={titleFor}
                />
            )}
            <footer className="gdocs-ref__detail-footer">
                <a
                    href={githubEditUrl(bundle.sidecarFile ?? bundle.entryFile)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <FontAwesomeIcon icon={faPenToSquare} /> Suggest an edit to
                    this page
                </a>
                <a
                    href={githubBlobUrl(bundle.entryFile)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <FontAwesomeIcon icon={faCode} /> View the bundle's code (
                    {bundle.entryFile})
                </a>
            </footer>
        </article>
    )
}

/** "Its variants": open cards first, then the collapsed tail. */
function BundleVariants({
    bundle,
    usage,
    titleFor,
}: {
    bundle: BundleReference
    usage: BundleUsage | undefined | null
    titleFor?: TitleFor
}): React.ReactElement {
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const { open, collapsed, stale } = orderBundleVariants(bundle, usage)
    const usageKnown = usage !== null

    const toggle = (name: string): void => {
        const next = new Set(expanded)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        setExpanded(next)
    }

    const card = (
        entry: BundleVariantEntry,
        inTail: boolean
    ): React.ReactElement => (
        <VariantCard
            key={entry.variant.name}
            bundle={bundle}
            entry={entry}
            usageKnown={usageKnown}
            collapsed={inTail && !expanded.has(entry.variant.name)}
            onToggle={inTail ? () => toggle(entry.variant.name) : undefined}
            titleFor={titleFor}
        />
    )

    // "not used yet" would be a false claim when the lookup failed
    const tailTitle = usageKnown
        ? `${collapsed.length} variant${collapsed.length > 1 ? "s" : ""} not used yet`
        : `${collapsed.length} more variant${collapsed.length > 1 ? "s" : ""}`

    return (
        <section className="gdocs-ref__section">
            <h2 className="gdocs-ref__section-title">
                Its variants
                <span className="gdocs-ref__section-count">
                    {bundle.variants.length}
                </span>
            </h2>
            {stale.length > 0 && (
                <p className="gdocs-ref-live__stale">
                    Published uses with a variant this bundle doesn't have:{" "}
                    {stale
                        .map(
                            (entry) =>
                                `${entry.variant ?? "(no variant)"} (${entry.uses} use${entry.uses === 1 ? "" : "s"})`
                        )
                        .join(", ")}
                    .
                </p>
            )}
            {open.map((entry) => card(entry, false))}
            {collapsed.length > 0 && (
                <div className="gdocs-ref-live__form-tail">
                    <div className="gdocs-ref-live__form-tail-title">
                        {tailTitle}
                    </div>
                    {collapsed.map((entry) => card(entry, true))}
                </div>
            )}
        </section>
    )
}

/**
 * One variant of the bundle: its description, the default block to copy
 * and its published uses. docs.md examples stay in the prose. A collapsed
 * card renders its header only, so it mounts no preview.
 */
function VariantCard({
    bundle,
    entry,
    usageKnown,
    collapsed,
    onToggle,
    titleFor,
}: {
    bundle: BundleReference
    entry: BundleVariantEntry
    usageKnown: boolean
    collapsed: boolean
    onToggle?: () => void
    titleFor?: TitleFor
}): React.ReactElement {
    const { variant, usage } = entry
    const title = (
        <span className="gdocs-ref-live__form-title">
            <span className="gdocs-ref-live__form-title-part">
                {variant.name}
            </span>
        </span>
    )
    const badge = usageKnown ? (
        <span
            className={
                usage
                    ? "gdocs-ref-bespoke__uses"
                    : "gdocs-ref-bespoke__uses gdocs-ref-bespoke__uses--none"
            }
        >
            {bundleUsageLabel(usage)}
        </span>
    ) : null

    return (
        <div className="gdocs-ref-live__form-card">
            {onToggle ? (
                <button
                    type="button"
                    className="gdocs-ref-live__form-card-header gdocs-ref-live__form-card-header--toggle"
                    aria-expanded={!collapsed}
                    onClick={onToggle}
                >
                    {title}
                    <span className="gdocs-ref-live__form-card-header-end">
                        {badge}
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className="gdocs-ref-live__form-card-chevron"
                        />
                    </span>
                </button>
            ) : (
                <div className="gdocs-ref-live__form-card-header">
                    {title}
                    {badge}
                </div>
            )}
            {!collapsed && (
                <div className="gdocs-ref-bespoke__variant-body">
                    {variant.description && (
                        <p className="gdocs-ref-bespoke__variant-description">
                            <InlineMarkdownText
                                text={variant.description}
                                titleFor={titleFor}
                            />
                        </p>
                    )}
                    <h3 className="gdocs-ref-bespoke__variant-subtitle">
                        Default block
                    </h3>
                    <GdocsReferenceExample
                        archie={variant.archie}
                        previewPath={variantPreviewPath(
                            bundle.id,
                            variant.name
                        )}
                        previewTitle={`${bundle.id} ${variant.name}`}
                    />
                    {usage && usage.instances.length > 0 && (
                        <>
                            <h3 className="gdocs-ref-bespoke__variant-subtitle">
                                Published uses
                            </h3>
                            <VariantUsesCarousel instances={usage.instances} />
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

/** The variant's published uses, one at a time: only the current one mounts. */
function VariantUsesCarousel({
    instances,
}: {
    instances: ComponentInstance[]
}): React.ReactElement {
    const [index, setIndex] = useState(0)
    const current = instances[Math.min(index, instances.length - 1)]
    return (
        <div className="gdocs-ref-bespoke__uses-carousel">
            <GdocsReferenceExample
                archie={current.archie}
                previewPath={instancePreviewPath(current)}
                previewTitle={`Used in ${current.title}`}
            />
            <div className="gdocs-ref-live__form-example-footer">
                <InstanceProvenance instance={current} />
                {instances.length > 1 && (
                    <span className="gdocs-ref-live__pager">
                        <button
                            type="button"
                            className="gdocs-ref-live__pager-button"
                            disabled={index === 0}
                            title="Previous use"
                            onClick={() => setIndex(Math.max(0, index - 1))}
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        use {index + 1} of {instances.length}
                        <button
                            type="button"
                            className="gdocs-ref-live__pager-button"
                            disabled={index + 1 >= instances.length}
                            title="Next use"
                            onClick={() =>
                                setIndex(
                                    Math.min(instances.length - 1, index + 1)
                                )
                            }
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </span>
                )}
            </div>
        </div>
    )
}

/** The values a config key takes, as chips: enum values and booleans. */
function configChoices(field: BundleConfigField): string[] | undefined {
    if (field.type === "enum") return field.values
    if (field.type === "boolean") return ["true", "false"]
    return undefined
}

function ConfigTypeCell({
    field,
}: {
    field: BundleConfigField
}): React.ReactElement {
    const choices = configChoices(field)
    if (choices)
        return (
            <span className="gdocs-ref-live__props-choices">
                {choices.map((value) => (
                    <code
                        key={value}
                        className={
                            value === field.default
                                ? "gdocs-ref-live__props-choice gdocs-ref-live__props-choice--default"
                                : "gdocs-ref-live__props-choice"
                        }
                        title={
                            value === field.default
                                ? "What you get when the key is unset"
                                : undefined
                        }
                    >
                        {value}
                    </code>
                ))}
            </span>
        )
    return (
        <>
            <code className="gdocs-ref__field-type">{field.type}</code>
            {field.default !== undefined && (
                <span className="gdocs-ref-live__props-default">
                    default <code>{field.default}</code>
                </span>
            )}
        </>
    )
}

/** Every config key of the bundle, in CONFIG_SPEC order, with adoption. */
function BundleConfigTable({
    bundle,
    usage,
    titleFor,
}: {
    bundle: BundleReference
    usage: BundleUsage | undefined | null
    titleFor?: TitleFor
}): React.ReactElement {
    const uses = usage?.uses ?? 0
    const showAdoption = uses > 0
    return (
        <section className="gdocs-ref__section">
            <h2 className="gdocs-ref__section-title">Config</h2>
            {bundle.config.length === 0 ? (
                <p className="gdocs-ref__note">
                    This bundle has no config keys.
                </p>
            ) : (
                <div className="gdocs-ref-live__props">
                    <div className="gdocs-ref-live__props-header">
                        <span className="gdocs-ref-live__props-title">
                            Config keys
                        </span>
                        <span className="gdocs-ref-live__props-source">
                            derived from <code>CONFIG_SPEC</code> · set them in
                            the block's <code>{"{.config}"}</code>
                        </span>
                    </div>
                    <table className="gdocs-ref-live__props-table">
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Type</th>
                                <th>What it does</th>
                                {showAdoption && <th>Adoption</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {bundle.config.map((field) => {
                                const adoption =
                                    usage?.configAdoption[field.name] ?? 0
                                return (
                                    <tr key={field.name}>
                                        <td>
                                            <code>{field.name}</code>
                                        </td>
                                        <td>
                                            <ConfigTypeCell field={field} />
                                        </td>
                                        <td className="gdocs-ref-live__props-effect">
                                            <InlineMarkdownText
                                                text={field.description}
                                                titleFor={titleFor}
                                            />
                                            {field.type === "custom" &&
                                                field.format && (
                                                    <span className="gdocs-ref-bespoke__config-format">
                                                        Format:{" "}
                                                        <InlineMarkdownText
                                                            text={field.format}
                                                            titleFor={titleFor}
                                                        />
                                                    </span>
                                                )}
                                        </td>
                                        {showAdoption && (
                                            <td
                                                className="gdocs-ref-bespoke__config-adoption"
                                                title={`Set in ${adoption} of ${uses} published uses`}
                                            >
                                                {adoption} of {uses}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}
