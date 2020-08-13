import { SwitcherOptions } from "./SwitcherOptions"
import { trimGrid } from "charts/Util"

export const explorerFileSuffix = ".explorer.tsv"

const nodeDelimiter = "\n"
const cellDelimiter = "\t"
const edgeDelimiter = "\t"

enum Keywords {
    switcher = "switcher",
    isPublished = "isPublished",
    title = "title",
    subtitle = "subtitle"
}

export class DataExplorerProgram {
    constructor(slug: string, tsv: string) {
        this.lines = tsv.replace(/\r/g, "").split(this.nodeDelimiter)
        this.slug = slug
    }

    get filename() {
        return this.slug + explorerFileSuffix
    }

    static fullPath(slug: string) {
        return `explorers/${slug}${explorerFileSuffix}`
    }

    get fullPath() {
        return DataExplorerProgram.fullPath(this.slug)
    }

    slug: string

    static defaultExplorerProgram = `${Keywords.title}\tData Explorer
${Keywords.isPublished}\tfalse
${Keywords.switcher}
\tchartId\tDevice
\t35\tInternet
\t46\tMobile`

    private nodeDelimiter = nodeDelimiter
    private cellDelimiter = cellDelimiter
    private edgeDelimiter = edgeDelimiter

    private lines: string[]

    private getLineValue(keyword: string) {
        const line = this.lines.find(line =>
            line.startsWith(keyword + this.cellDelimiter)
        )
        return line ? line.split(this.cellDelimiter)[1] : undefined
    }

    private getLineIndex(key: string) {
        return this.lines.findIndex(
            line => line.startsWith(key + this.cellDelimiter) || line === key
        )
    }

    private setLineValue(key: string, value: string | undefined) {
        const index = this.getLineIndex(key)
        const newLine = key + this.cellDelimiter + value
        if (index === -1 && value !== undefined) this.lines.push(newLine)
        else if (value === undefined) this.lines = this.lines.splice(index, 1)
        else this.lines[index] = newLine
    }

    private getBlock(key: string) {
        const ends = this.getBlockEnds(key)
        if (!ends) return undefined
        return this.lines
            .slice(ends.start, ends.end)
            .map(line => line.substr(1))
            .join(this.nodeDelimiter)
    }

    get requiredChartIds() {
        return SwitcherOptions.getRequiredChartIds(this.switcherCode || "")
    }

    static fromArrays(slug: string, table: any[][]) {
        const str = table
            .map(row => row.join(cellDelimiter))
            .join(nodeDelimiter)
        return new DataExplorerProgram(slug, str)
    }

    toArrays() {
        return this.lines.map(line => line.split(this.cellDelimiter))
    }

    toString() {
        return this.prettify()
    }

    private prettify() {
        return trimGrid(this.toArrays())
            .map(line => line.join(this.cellDelimiter))
            .join(this.nodeDelimiter)
    }

    get switcher() {
        return new SwitcherOptions(this.switcherCode || "", "")
    }

    private getBlockEnds(key: string) {
        const keyLine = this.getLineIndex(key)
        if (keyLine === -1) return undefined
        const blockStart = keyLine + 1
        let length = this.lines
            .slice(blockStart)
            .findIndex(line => !line.startsWith(this.edgeDelimiter))
        if (length === -1) length = this.lines.slice(blockStart).length
        return { start: blockStart, end: blockStart + length, length }
    }

    private setBlock(key: string, value: string | undefined) {
        if (!value) return this.deleteBlock(key)

        const ends = this.getBlockEnds(key)
        if (!ends) return this.appendBlock(key, value)

        this.lines = this.lines.splice(
            ends.start,
            ends.length,
            key,
            ...value
                .split(this.nodeDelimiter)
                .map(line => this.edgeDelimiter + line)
        )
    }

    private appendBlock(key: string, value: string) {
        this.lines.push(key)
        value
            .split(this.nodeDelimiter)
            .forEach(line => this.lines.push(this.edgeDelimiter + line))
    }

    private deleteBlock(key: string) {
        const ends = this.getBlockEnds(key)
        if (!ends) return

        this.lines = this.lines.splice(ends.start, ends.length)
    }

    get title(): string | undefined {
        return this.getLineValue(Keywords.title)
    }

    set title(value: string | undefined) {
        this.setLineValue(Keywords.title, value)
    }

    get subtitle(): string | undefined {
        return this.getLineValue(Keywords.subtitle)
    }

    set subtitle(value: string | undefined) {
        this.setLineValue(Keywords.subtitle, value)
    }

    get isPublished() {
        return this.getLineValue(Keywords.isPublished) === "true"
    }

    set isPublished(value: boolean) {
        this.setLineValue(Keywords.isPublished, value ? "true" : "false")
    }

    get switcherCode() {
        return this.getBlock(Keywords.switcher)
    }

    set switcherCode(value: string | undefined) {
        this.setBlock(Keywords.switcher, value)
    }
}
