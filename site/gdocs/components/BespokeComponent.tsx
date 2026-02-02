import { EnrichedBlockBespokeComponent } from "@ourworldindata/types"

export function BespokeComponent({
    className,
    block,
}: {
    className?: string
    block: EnrichedBlockBespokeComponent
}) {
    return (
        <div
            className={className}
            data-bespoke-bundle={block.bundle}
            data-bespoke-variant={block.variant}
            data-bespoke-config={JSON.stringify(block.config)}
        >
            {/* Bespoke components are hydrated client-side based on the bundle */}
        </div>
    )
}
