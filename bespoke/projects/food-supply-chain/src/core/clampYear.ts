/** The nearest year the entity actually has to the one selected, later year on a tie */
export function clampYear(
    years: number[],
    selected: number
): number | undefined {
    if (years.length === 0) return undefined
    return years.reduce((nearest, year) => {
        const distance = Math.abs(year - selected)
        const nearestDistance = Math.abs(nearest - selected)
        return distance < nearestDistance ||
            (distance === nearestDistance && year > nearest)
            ? year
            : nearest
    })
}
