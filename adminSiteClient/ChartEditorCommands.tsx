import { useMemo } from "react"
import { observer } from "mobx-react"
import {
    faArrowUpRightFromSquare,
    faEye,
    faEyeSlash,
    faFloppyDisk,
} from "@fortawesome/free-solid-svg-icons"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { isChartEditorInstance } from "./ChartEditor.js"
import { AdminCommand, COMMAND_CATEGORIES } from "./commandPalette/commandRegistry.js"
import { PageCommands } from "./commandPalette/commandRegistryReact.js"

/**
 * Contributes the chart editor's actions to the command palette for as long
 * as the editor is mounted. Observed so that toggling published state or
 * making edits keeps the offered commands in sync.
 */
export const ChartEditorCommands = observer(function ChartEditorCommands({
    editor,
}: {
    editor: AbstractChartEditor
}): React.ReactElement {
    const chartEditor = isChartEditorInstance(editor) ? editor : undefined
    const { grapherState } = editor
    const isPublished = !!grapherState.isPublished
    const { displaySlug } = grapherState
    const isModified = editor.isModified

    const commands = useMemo((): AdminCommand[] => {
        const category = COMMAND_CATEGORIES.thisPage
        const commands: AdminCommand[] = []

        if (isModified)
            commands.push({
                id: "chart-editor.save",
                title: "Save chart",
                category,
                icon: faFloppyDisk,
                actions: [
                    { label: "Save", run: () => void editor.saveGrapher() },
                ],
            })

        if (chartEditor)
            commands.push({
                id: "chart-editor.toggle-published",
                title: isPublished ? "Unpublish chart" : "Publish chart",
                category,
                icon: isPublished ? faEyeSlash : faEye,
                actions: [
                    {
                        label: isPublished ? "Unpublish" : "Publish",
                        run: () =>
                            isPublished
                                ? chartEditor.unpublishGrapher()
                                : chartEditor.publishGrapher(),
                    },
                ],
            })

        if (isPublished && displaySlug)
            commands.push({
                id: "chart-editor.view-on-site",
                title: "View chart on site",
                category,
                icon: faArrowUpRightFromSquare,
                actions: [
                    {
                        label: "View on site",
                        href: `${BAKED_GRAPHER_URL}/${displaySlug}`,
                        external: true,
                    },
                ],
            })

        return commands
    }, [editor, chartEditor, isPublished, displaySlug, isModified])

    return <PageCommands commands={commands} />
})
