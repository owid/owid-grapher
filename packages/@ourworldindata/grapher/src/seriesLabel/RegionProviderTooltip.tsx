import { SimpleMarkdownText } from "@ourworldindata/components"

export interface RegionProviderTooltipProps {
    description: string
    imageUrl: string
    regions: { name: string; color?: string }[]
}

export function RegionProviderTooltip({
    description,
    imageUrl,
    regions,
}: RegionProviderTooltipProps): React.ReactElement {
    return (
        <div className="region-provider-tooltip">
            <SimpleMarkdownText text={description} />
            <img
                className="region-provider-tooltip__map-image"
                src={imageUrl}
            />
            <ul className="region-provider-tooltip__region-list">
                {regions.map((region) => {
                    return (
                        <li
                            key={region.name}
                            className={`region-provider-tooltip__region`}
                        >
                            <span
                                className="region-provider-tooltip__region-dot"
                                style={{
                                    backgroundColor: region.color ?? "#cccccc",
                                }}
                            />
                            {region.name}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
