import { ExplorerGrammar } from "explorer/grammars/ExplorerGrammar"
import { ExplorerProgram } from "explorer/client/ExplorerProgram"
import { CellPosition, ParsedCell } from "explorer/gridLang/GridLangConstants"
import Handsontable from "handsontable"
import {
    ExplorersRouteGrapherConfigs,
    ExplorersRouteQueryParam,
} from "explorer/client/ExplorerConstants"
import { Grapher } from "grapher/core/Grapher"
import { CoreTable } from "coreTable/CoreTable"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { GrapherGrammar } from "explorer/grammars/GrapherGrammar"
import { pick } from "grapher/utils/Util"
import { ColumnGrammar } from "explorer/grammars/ColumnGrammar"

abstract class HotCommand {
    protected program: ExplorerProgram
    protected setProgramCallback?: (newProgram: string) => void
    constructor(
        program: ExplorerProgram,
        setProgramCallback?: (newProgram: string) => void
    ) {
        this.program = program
        this.setProgramCallback = setProgramCallback
    }

    abstract name(hot: Handsontable): string
    abstract callback(hot: Handsontable): void
    abstract disabled(hot: Handsontable): boolean
    abstract hidden(hot: Handsontable): boolean

    protected selectedPosition(hot: Handsontable) {
        const coords = hot.getSelectedLast()
        if (!coords) return undefined
        return { row: coords[0], column: coords[1] } as CellPosition
    }

    protected cell(hot: Handsontable) {
        const pos = this.selectedPosition(hot)
        return pos ? this.program.getCell(pos) : undefined
    }

    protected searchResults(hot: Handsontable) {
        const pos = this.selectedPosition(hot)
        return pos ? this.program.findAll(pos) : []
    }

    // handles the "this" binding needed by HOT
    toHotCommand(): Handsontable.contextMenu.MenuItemConfig {
        const baseCommand = this
        return {
            name: function () {
                return baseCommand.name(this)
            },
            callback: function () {
                return baseCommand.callback(this)
            },
            disabled: function () {
                return baseCommand.disabled(this)
            },
            hidden: function () {
                return baseCommand.hidden(this)
            },
        }
    }
}

export class SelectAllHitsCommand extends HotCommand {
    name(hot: Handsontable) {
        const cell = this.cell(hot)
        if (!cell) return `Nothing selected`
        const searchResults = this.searchResults(hot)
        if (searchResults.length === 1) return `1 match of '${cell.value}'`
        return `Select ${searchResults.length} matches of '${cell.value}'`
    }

    callback(hot: Handsontable) {
        const searchResults = this.searchResults(hot)
        if (!searchResults.length) return
        hot.selectCells(
            searchResults.map(
                (pos) =>
                    [pos.row, pos.column, pos.row, pos.column] as [
                        number,
                        number,
                        number,
                        number
                    ]
            )
        )
    }

    hidden() {
        return false
    }

    disabled(hot: Handsontable) {
        return this.searchResults(hot).length < 2
    }
}

// todo: remove post Graphers to Git
export class InlineGrapherCommand extends HotCommand {
    name(hot: Handsontable) {
        const cell = this.cell(hot)
        return `⚡ Inline Grapher config and column defs for ${cell?.value}`
    }

    async callback(hot: Handsontable) {
        const cell = this.cell(hot)

        if (!cell) return

        const delimited = await fetch(
            `/admin/api/${ExplorersRouteGrapherConfigs}?${ExplorersRouteQueryParam}=${cell.value}`
        )
        const configs: GrapherInterface[] = await delimited.json()
        const keysToKeep = Object.keys(GrapherGrammar) // todo: slugs, yscale, colorscale

        const clone = this.program.clone
        for await (const config of configs) {
            const grapher = new Grapher(config)
            await grapher.downloadLegacyDataFromUrl(grapher.dataUrl)
            clone.patch(pick(grapher.toObject(), keysToKeep))
            clone.appendLine(`table`)
            const colorScale = grapher.colorScale.toDSL()
            const defs = grapher.inputTable.defs.map((def) =>
                Object.assign({}, def, colorScale)
            )

            const colTable = new CoreTable(
                defs,
                Object.keys(ColumnGrammar).map((key) => ({ slug: key }))
            )

            clone.appendBlock(
                `${ExplorerGrammar.columns.keyword}`,
                colTable.toTsv()
            )
        }

        this.setProgramCallback!(clone.toString())
    }

    disabled() {
        return false
    }

    hidden(hot: Handsontable) {
        const cell = this.cell(hot)
        return cell
            ? cell.cellDef?.keyword !== ExplorerGrammar.grapherId.keyword
            : true
    }
}

export class AutofillColDefCommand extends HotCommand {
    name() {
        return "⚡ Autofill missing column definitions"
    }

    async callback(hot: Handsontable) {
        const selectedPosition = this.selectedPosition(hot)
        if (!selectedPosition) return
        const tableSlugCell = this.program.getCell({
            ...selectedPosition,
            column: selectedPosition.column + 1,
        })

        const newProgram = await this.getNewProgram(tableSlugCell)
        this.setProgramCallback!(newProgram.toString())
    }

    protected async getNewProgram(tableSlugCell: ParsedCell) {
        const remoteTable = await this.program.tryFetchTableForTableSlugIfItHasUrl(
            tableSlugCell.value
        )

        return this.program.autofillMissingColumnDefinitionsForTableCommand(
            tableSlugCell.value,
            remoteTable
        )
    }

    disabled() {
        return false
    }

    hidden(hot: Handsontable) {
        const cell = this.cell(hot)
        return cell
            ? cell.cellDef?.keyword !== ExplorerGrammar.table.keyword
            : true
    }
}

export class InlineDataCommand extends AutofillColDefCommand {
    name() {
        return "⚡ Inline data and autofill columns"
    }

    protected async getNewProgram(tableSlugCell: ParsedCell) {
        return await this.program.replaceTableWithInlineDataAndAutofilledColumnDefsCommand(
            tableSlugCell.value
        )
    }
}
