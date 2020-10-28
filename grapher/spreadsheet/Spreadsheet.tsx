import { observer } from "mobx-react"
import React from "react"
import { HotTable } from "@handsontable/react"
import { action, computed } from "mobx"
import { exposeInstanceOnWindow } from "grapher/utils/Util"
import Handsontable from "handsontable"
import { OwidTable } from "coreTable/OwidTable"
import { Matrix, rowsFromMatrix } from "coreTable/CoreTableUtils"

interface SpreadsheetManager {
    table: OwidTable
}

@observer
export class Spreadsheet extends React.Component<{
    manager: SpreadsheetManager
}> {
    private hotTableComponent = React.createRef<HotTable>()

    @action.bound private updateFromHot() {
        const newVersion = this.hotTableComponent.current?.hotInstance.getData() as Matrix
        if (newVersion && this.isChanged(newVersion)) {
            this.manager.table = new OwidTable(rowsFromMatrix(newVersion))
        }
    }

    private isChanged(newVersion: Matrix) {
        return (
            new OwidTable(rowsFromMatrix(newVersion)).toDelimited() !==
            this._version
        )
    }

    componentDidMount() {
        exposeInstanceOnWindow(this, "spreadsheet")
    }

    @computed private get manager() {
        return this.props.manager
    }

    private _version: string = ""
    render() {
        this._version = this.manager.table.toDelimited()
        const data = this.manager.table.toMatrix()
        const hotSettings: Handsontable.GridSettings = {
            data,
            manualColumnResize: [150, 200],
            wordWrap: false,
            colHeaders: false,
            contextMenu: true,
            allowInsertRow: true,
            allowInsertColumn: true,
            autoColumnSize: true,
            width: "100%",
            stretchH: "all",
            minCols: 6,
            minRows: 10,
            height: 250,
            rowHeights: 23,
            rowHeaders: true,
            afterChange: () => this.updateFromHot(),
        }

        return (
            <HotTable
                settings={hotSettings}
                ref={this.hotTableComponent as any}
                licenseKey={"non-commercial-and-evaluation"}
            />
        )
    }
}
