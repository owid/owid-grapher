import { observer } from "mobx-react"
import React from "react"
import { ChartEditor } from "./ChartEditor.js"

@observer
export class EditorExportTab extends React.Component<{ editor: ChartEditor }> {
    render() {
        return <div className="EditorTextTab"></div>
    }
}
