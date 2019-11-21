import * as parse from "csv-parse"
import { ReadStream } from "fs"

export async function parseCSV(csv: string): Promise<string[][]> {
    return new Promise<string[][]>((resolve, reject) => {
        parse(
            csv,
            { relax_column_count: true, skip_empty_lines: true, trim: true },
            (err, rows) => {
                if (err) reject(err)
                else resolve(rows)
            }
        )
    })
}

export class CSVStreamParser {
    parser: any
    error: any
    isEnded: boolean = false
    isReadable: boolean = false

    rowResolve?: (value: any) => void
    rowReject?: (error: any) => void

    constructor(input: ReadStream) {
        const parser = parse({
            relax_column_count: true,
            skip_empty_lines: true,
            trim: true
        })

        parser.on("readable", () => {
            this.isReadable = true
            this.update()
        })
        parser.on("error", (err: any) => {
            this.error = err
            this.update()
        })
        parser.on("end", () => {
            this.isEnded = true
            this.update()
        })

        input.pipe(parser)
        this.parser = parser
    }

    update() {
        if (!this.rowResolve || !this.rowReject) return

        if (this.error) {
            this.rowReject(this.error)
            this.rowResolve = undefined
            this.rowReject = undefined
        } else if (this.isEnded) {
            this.rowResolve(undefined)
            this.rowResolve = undefined
            this.rowReject = undefined
        } else if (this.isReadable) {
            const row = this.parser.read()
            if (row) {
                this.rowResolve(row)
                this.rowResolve = undefined
                this.rowReject = undefined
            } else {
                this.isReadable = false
            }
        }
    }

    async nextRow(): Promise<string[] | undefined> {
        return new Promise<string[] | undefined>((resolve, reject) => {
            this.rowResolve = resolve
            this.rowReject = reject
            this.update()
        })
    }
}
