import { Bounds, PointVector } from "@ourworldindata/utils"
import { EntityName } from "@ourworldindata/types"
import { CARTOGRAM_COUNTRY_CODE_TO_ENTITY_NAME } from "./CartogramCountryCodes"

export const CARTOGRAM_POPULATION_PER_CELL = 500_000

export interface CartogramCell {
    x: number
    y: number
    countryCode: string
}

export interface CartogramRenderFeature {
    id: EntityName
    countryCode: string
    cells: { x: number; y: number }[]
    fillPath: string
    outlinePath: string
    population: number
    bounds: Bounds
    center: PointVector
}

export interface CartogramLayout {
    year: number
    url: string
    cells: CartogramCell[]
    features: CartogramRenderFeature[]
    bounds: Bounds
}

export function parseCartogramCsv(csv: string): CartogramCell[] {
    const lines = csv.trim().split(/\r?\n/)
    const [header, ...rows] = lines
    if (header !== "X,Y,CountryCode")
        throw new Error(`Unexpected cartogram CSV header: ${header}`)

    return rows.map((row, index) => {
        const [rawX, rawY, rawCountryCode, ...rest] = row.split(",")
        if (rest.length > 0 || rawX === undefined || rawY === undefined)
            throw new Error(`Invalid cartogram CSV row ${index + 2}: ${row}`)

        const x = Number(rawX)
        const y = Number(rawY)
        const countryCode = rawCountryCode?.padStart(3, "0")

        if (!Number.isInteger(x) || !Number.isInteger(y) || !countryCode)
            throw new Error(`Invalid cartogram CSV row ${index + 2}: ${row}`)

        if (!CARTOGRAM_COUNTRY_CODE_TO_ENTITY_NAME[countryCode])
            throw new Error(
                `No OWID entity mapping for cartogram country code ${countryCode}`
            )

        return { x, y, countryCode }
    })
}

const makeCellKey = (x: number, y: number): string => `${x},${y}`

function makeCellPath(x: number, y: number): string {
    return `M${x},${y}h1v1h-1Z`
}

function makeEdgePath(x1: number, y1: number, x2: number, y2: number): string {
    return `M${x1},${y1}L${x2},${y2}`
}

export function buildCartogramLayout({
    year,
    url,
    cells,
}: {
    year: number
    url: string
    cells: CartogramCell[]
}): CartogramLayout {
    if (cells.length === 0) {
        return { year, url, cells, features: [], bounds: Bounds.empty() }
    }

    const maxY = Math.max(...cells.map((cell) => cell.y))
    const cellsByCode = new Map<string, { x: number; y: number }[]>()

    for (const cell of cells) {
        const svgCell = { x: cell.x, y: maxY - cell.y }
        const cellsForCode = cellsByCode.get(cell.countryCode) ?? []
        cellsForCode.push(svgCell)
        cellsByCode.set(cell.countryCode, cellsForCode)
    }

    const features = Array.from(cellsByCode.entries()).map(
        ([countryCode, featureCells]) => {
            const entityName =
                CARTOGRAM_COUNTRY_CODE_TO_ENTITY_NAME[countryCode]
            const cellSet = new Set(
                featureCells.map((cell) => makeCellKey(cell.x, cell.y))
            )
            const fillPath = featureCells
                .map((cell) => makeCellPath(cell.x, cell.y))
                .join("")
            const outlinePath = featureCells
                .flatMap((cell) => {
                    const { x, y } = cell
                    const paths: string[] = []
                    if (!cellSet.has(makeCellKey(x, y - 1)))
                        paths.push(makeEdgePath(x, y, x + 1, y))
                    if (!cellSet.has(makeCellKey(x + 1, y)))
                        paths.push(makeEdgePath(x + 1, y, x + 1, y + 1))
                    if (!cellSet.has(makeCellKey(x, y + 1)))
                        paths.push(makeEdgePath(x + 1, y + 1, x, y + 1))
                    if (!cellSet.has(makeCellKey(x - 1, y)))
                        paths.push(makeEdgePath(x, y + 1, x, y))
                    return paths
                })
                .join("")

            const minX = Math.min(...featureCells.map((cell) => cell.x))
            const maxX = Math.max(...featureCells.map((cell) => cell.x))
            const minY = Math.min(...featureCells.map((cell) => cell.y))
            const maxFeatureY = Math.max(...featureCells.map((cell) => cell.y))
            const bounds = new Bounds(
                minX,
                minY,
                maxX - minX + 1,
                maxFeatureY - minY + 1
            )

            return {
                id: entityName,
                countryCode,
                cells: featureCells,
                fillPath,
                outlinePath,
                population: featureCells.length * CARTOGRAM_POPULATION_PER_CELL,
                bounds,
                center: bounds.centerPos,
            }
        }
    )

    return {
        year,
        url,
        cells,
        features,
        bounds: Bounds.merge(features.map((feature) => feature.bounds)),
    }
}
