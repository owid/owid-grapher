export function RegionLegend({
    continents,
    getColor,
}: {
    continents: string[]
    getColor: (continent: string) => string
}): React.ReactElement {
    return (
        <ul className="democracy-legend" aria-label="World regions">
            {continents.map((continent) => (
                <li key={continent} className="democracy-legend__item">
                    <span
                        className="democracy-legend__swatch"
                        style={{ backgroundColor: getColor(continent) }}
                    />
                    {continent}
                </li>
            ))}
        </ul>
    )
}
