import type { BespokeVizRegistry, BespokeVizUsage } from "@ourworldindata/types"
import { Link } from "./Link.js"
import {
    bundleUsageLabel,
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

const bundlePagePath = (bundleId: string): string =>
    `/gdocs-reference/components/bespoke-component/${bundleId}`

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
