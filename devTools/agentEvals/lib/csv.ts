import Papa from "papaparse"

export interface CsvRow {
    entity: string
    code: string
    year: number
    values: Record<string, number | undefined>
}

export interface Observation {
    year: number
    value: number
}

/** A grapher CSV (`Entity,Code,Year,<columns…>`) indexed for lookups. */
export class Dataset {
    readonly columns: string[]
    readonly rows: CsvRow[]
    readonly byEntity = new Map<string, CsvRow[]>()
    private readonly codes = new Map<string, string>()

    constructor(columns: string[], rows: CsvRow[]) {
        this.columns = columns
        this.rows = rows
        for (const row of rows) {
            const list = this.byEntity.get(row.entity) ?? []
            list.push(row)
            this.byEntity.set(row.entity, list)
            if (row.code) this.codes.set(row.entity, row.code)
        }
        for (const list of this.byEntity.values())
            list.sort((a, b) => a.year - b.year)
    }

    entities(): string[] {
        return [...this.byEntity.keys()].sort()
    }

    /**
     * Countries carry a three-letter ISO code. Aggregates (World, continents,
     * income groups, "Asia (UN)") have no code or a synthetic one (OWID_WRL, UN_ASI).
     */
    isAggregate(entity: string): boolean {
        const code = this.codes.get(entity) ?? ""
        return !/^[A-Z]{3}$/.test(code)
    }

    countries(): string[] {
        return this.entities().filter((e) => !this.isAggregate(e))
    }

    /** Columns where most cells that are filled parse as numbers. */
    numericColumns(): string[] {
        return this.columns.filter((column) => {
            let filled = 0
            let numeric = 0
            for (const row of this.rows) {
                const v = row.values[column]
                if (v === undefined) continue
                filled++
                if (Number.isFinite(v)) numeric++
            }
            return filled > 0 && numeric / filled > 0.5
        })
    }

    observations(entity: string, column: string): Observation[] {
        return (this.byEntity.get(entity) ?? [])
            .filter((row) => row.values[column] !== undefined)
            .map((row) => ({ year: row.year, value: row.values[column]! }))
    }

    valueAt(entity: string, column: string, year: number): number | undefined {
        return this.observations(entity, column).find((o) => o.year === year)
            ?.value
    }

    /** Latest observation at or before `maxYear` (or overall). */
    latest(
        entity: string,
        column: string,
        maxYear?: number
    ): Observation | undefined {
        const obs = this.observations(entity, column).filter(
            (o) => maxYear === undefined || o.year <= maxYear
        )
        return obs.at(-1)
    }

    earliest(entity: string, column: string): Observation | undefined {
        return this.observations(entity, column)[0]
    }

    years(column?: string): number[] {
        const set = new Set<number>()
        for (const row of this.rows) {
            if (column === undefined || row.values[column] !== undefined)
                set.add(row.year)
        }
        return [...set].sort((a, b) => a - b)
    }

    maxYear(column?: string): number | undefined {
        return this.years(column).at(-1)
    }

    minYear(column?: string): number | undefined {
        return this.years(column)[0]
    }
}

export function parseDataset(csv: string): Dataset {
    const parsed = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true })
    const [header, ...body] = parsed.data
    if (!header || header[0].toLowerCase() !== "entity")
        throw new Error(
            `Not a grapher CSV (header starts with ${JSON.stringify(header?.[0])})`
        )
    const columns = header.slice(3)
    const rows: CsvRow[] = body.map((cells) => {
        const values: Record<string, number | undefined> = {}
        columns.forEach((column, i) => {
            const cell = cells[i + 3]
            if (cell === undefined || cell === "") return
            const n = Number(cell)
            values[column] = Number.isFinite(n) ? n : NaN
        })
        return {
            entity: cells[0],
            code: cells[1] ?? "",
            year: Number(cells[2]),
            values,
        }
    })
    return new Dataset(columns, rows)
}
