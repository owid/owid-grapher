import { observer } from "mobx-react"
import React from "react"
import { HotTable } from "@handsontable/react"
import { action, computed } from "mobx"
import { exposeInstanceOnWindow } from "../../clientUtils/Util"
import Handsontable from "handsontable"
import { OwidTable } from "../../coreTable/OwidTable"
import { CoreMatrix } from "../../coreTable/CoreTableConstants"
import { registerAllModules } from "handsontable/registry"

// Register all Handsontable modules
registerAllModules()

interface SpreadsheetManager {
    table: OwidTable
}

@observer
export class Spreadsheet extends React.Component<{
    manager: SpreadsheetManager
}> {
    private hotTableComponent = React.createRef<HotTable>()

    @action.bound private updateFromHot(): void {
        const newVersion =
            this.hotTableComponent.current?.hotInstance?.getData() as CoreMatrix
        if (!newVersion || !this.isChanged(newVersion)) return

        this.manager.table = new OwidTable(newVersion)
    }

    private isChanged(newVersion: CoreMatrix): boolean {
        return new OwidTable(newVersion).toDelimited() !== this._version
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this, "spreadsheet")
    }

    @computed private get manager(): SpreadsheetManager {
        return this.props.manager
    }

    private _version: string = ""
    render(): JSX.Element {
        const { table } = this.manager
        this._version = table.toDelimited()
        const data = table.toMatrix()
        const hotSettings: Handsontable.GridSettings = {
            afterChange: () => this.updateFromHot(),
            allowInsertColumn: true,
            allowInsertRow: true,
            autoColumnSize: true,
            colHeaders: false,
            contextMenu: true,
            data,
            height: 250,
            minSpareRows: 2,
            minSpareCols: 2,
            rowHeaders: true,
            rowHeights: 23,
            stretchH: "all",
            width: "100%",
            wordWrap: false,
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
