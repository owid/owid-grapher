export interface MarkdownTable {
    /** Text of the nearest preceding heading (any level), without the hashes. */
    heading: string
    /** The last non-empty line before the table, with bold markers stripped — e.g. "Life expectancy, in years." */
    intro: string
    headers: string[]
    rows: string[][]
}

function splitRow(line: string): string[] {
    return line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
}

function isSeparator(line: string): boolean {
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)
}

export function parseMarkdownTables(markdown: string): MarkdownTable[] {
    const lines = markdown.split("\n")
    const tables: MarkdownTable[] = []
    let heading = ""
    let lastText = ""
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const h = line.match(/^#{1,6}\s+(.*)$/)
        if (h) {
            heading = h[1].trim()
            lastText = ""
            continue
        }
        if (line.trim().startsWith("|") && isSeparator(lines[i + 1] ?? "")) {
            const headers = splitRow(line)
            const intro = lastText.replace(/\*\*/g, "").trim()
            const rows: string[][] = []
            let j = i + 2
            while (j < lines.length && lines[j].trim().startsWith("|")) {
                rows.push(splitRow(lines[j]))
                j++
            }
            tables.push({ heading, intro, headers, rows })
            i = j - 1
            lastText = ""
            continue
        }
        if (line.trim()) lastText = line
    }
    return tables
}
