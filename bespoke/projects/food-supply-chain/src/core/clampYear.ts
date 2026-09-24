/** The nearest year the entity actually has to the one selected, later year on a tie */
export function clampYear(
    years: number[],
    selected: number
): number | undefined {
    if (years.length === 0) return undefined
    return years.reduce((nearest, year) =>
        Math.abs(year - selected) <= Math.abs(nearest - selected)
            ? year
            : nearest
    )
}
