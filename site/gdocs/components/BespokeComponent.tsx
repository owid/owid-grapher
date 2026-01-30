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
            data-bespoke-component={block.name}
            data-bespoke-config={JSON.stringify(block.config)}
        >
            {/* Bespoke components are hydrated client-side based on the name */}
        </div>
    )
}
