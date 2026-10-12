import { useId } from "react"
import { RadioButton } from "../RadioButton.js"
import { OwidColumnDef } from "@ourworldindata/types"

export function DownloadApiOptions({
    onlyVisible,
    onOnlyVisibleChange,
    shortColNames,
    onShortColNamesChange,
    firstYColDef,
    completeDataset,
}: {
    onlyVisible: boolean
    onOnlyVisibleChange: (onlyVisible: boolean) => void
    shortColNames: boolean
    onShortColNamesChange: (shortColNames: boolean) => void
    firstYColDef?: OwidColumnDef
    /**
     * Offers the pre-built complete-dataset files as a third scope, on the
     * pages that have them. Those files are published as-is, so the
     * column-name options don't apply while this scope is selected and are
     * hidden rather than shown as no-ops.
     */
    completeDataset?: {
        checked: boolean
        onChange: (checked: boolean) => void
    }
}) {
    const groupPrefix = useId()
    const exLongName = firstYColDef?.name
    const exShortName = firstYColDef?.shortName
    const completeDatasetChecked = completeDataset?.checked ?? false
    const shortNamesAvailable = !!exShortName && !completeDatasetChecked

    const selectChartScope = (nextOnlyVisible: boolean): void => {
        completeDataset?.onChange(false)
        onOnlyVisibleChange(nextOnlyVisible)
    }

    return (
        <>
            {/* Same scopes, same names and same order as the download buttons
                further up the page -- widest download first. Each label is a
                button title plus the qualifier from that button's description,
                so the two lists can't drift into describing one scope with two
                different words. */}
            <section className="download-api-options__config-list">
                {completeDataset && (
                    <RadioButton
                        label="Download full dataset, including every indicator, not just the ones in this chart"
                        group={`${groupPrefix}-onlyVisible`}
                        checked={completeDatasetChecked}
                        onChange={() => completeDataset.onChange(true)}
                    />
                )}
                <RadioButton
                    label="Download chart data, including all entities and time points"
                    group={`${groupPrefix}-onlyVisible`}
                    checked={!onlyVisible && !completeDatasetChecked}
                    onChange={() => selectChartScope(false)}
                />
                <RadioButton
                    label="Download displayed data, only the entities and time points currently visible in the chart"
                    group={`${groupPrefix}-onlyVisible`}
                    checked={onlyVisible && !completeDatasetChecked}
                    onChange={() => selectChartScope(true)}
                />
            </section>
            {shortNamesAvailable && (
                <section className="download-api-options__config-list">
                    <div>
                        <RadioButton
                            label="Long column names"
                            group={`${groupPrefix}-shortColNames`}
                            checked={!shortColNames}
                            onChange={() => onShortColNamesChange(false)}
                        />
                        <p>
                            e.g. <code>{exLongName}</code>
                        </p>
                    </div>
                    <div>
                        <RadioButton
                            label="Shortened column names"
                            group={`${groupPrefix}-shortColNames`}
                            checked={shortColNames}
                            onChange={() => onShortColNamesChange(true)}
                        />
                        <p>
                            e.g.{" "}
                            <code style={{ wordBreak: "break-all" }}>
                                {exShortName}
                            </code>
                        </p>
                    </div>
                </section>
            )}
        </>
    )
}
