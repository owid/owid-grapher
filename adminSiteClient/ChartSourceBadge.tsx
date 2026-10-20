import * as React from "react"
import cx from "clsx"
import { Tooltip } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLink, faUnlink } from "@fortawesome/free-solid-svg-icons"
import {
    EtlSource,
    describeEtlDrift,
    hasEtlDrift,
    makeEtlConfigGitHubUrl,
} from "./etlChartSync.js"
import "./ChartSourceBadge.scss"

/** Where a chart is authored: in ETL (in sync or drifted) or in the admin */
export function ChartSourceBadge({
    etl,
}: {
    etl?: EtlSource
}): React.ReactElement {
    if (!etl)
        return (
            <Tooltip title="Created and edited in the admin">
                <span className="chart-source-badge chart-source-badge--admin">
                    Admin
                </span>
            </Tooltip>
        )

    const isDrifted = hasEtlDrift(etl.drift)
    const gitHubUrl = makeEtlConfigGitHubUrl(etl.catalogPath)
    const className = cx("chart-source-badge", "chart-source-badge--etl", {
        "chart-source-badge--drifted": isDrifted,
    })
    const content = (
        <>
            <FontAwesomeIcon icon={isDrifted ? faUnlink : faLink} /> ETL
        </>
    )

    return (
        <Tooltip title={<EtlSourceTooltip etl={etl} isDrifted={isDrifted} />}>
            {gitHubUrl ? (
                <a
                    className={className}
                    href={gitHubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {content}
                </a>
            ) : (
                <span className={className}>{content}</span>
            )}
        </Tooltip>
    )
}

function EtlSourceTooltip({
    etl,
    isDrifted,
}: {
    etl: EtlSource
    isDrifted: boolean
}): React.ReactElement {
    return (
        <div>
            <div>
                Created in ETL
                {etl.catalogPath ? <> ({etl.catalogPath})</> : null}
            </div>
            {isDrifted ? (
                <>
                    <div>Changed in the admin since the last ETL push:</div>
                    <ul className="chart-source-badge__drift-list">
                        {describeEtlDrift(etl.drift).map((description) => (
                            <li key={description}>{description}</li>
                        ))}
                    </ul>
                </>
            ) : (
                <div>In sync with the last ETL push</div>
            )}
        </div>
    )
}
