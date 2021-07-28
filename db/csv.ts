import parse from "csv-parse"

export const parseCSV = async (csv: string): Promise<string[][]> =>
    new Promise<string[][]>((resolve, reject) => {
        parse(
            csv,
            { relax_column_count: true, skip_empty_lines: true, trim: true },
            (err, rows) => {
                if (err) reject(err)
                else resolve(rows)
            }
        )
    })
