import * as React from "react"
import cx from "clsx"
import { Tooltip } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowUpRightFromSquare,
    faLink,
    faUnlink,
} from "@fortawesome/free-solid-svg-icons"
import { CatalogPathField, Section } from "./Forms.js"
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
        <Tooltip
            styles={{ root: { maxWidth: 360 } }}
            title={
                <EtlSourceTooltip
                    etl={etl}
                    isDrifted={isDrifted}
                    footer={
                        gitHubUrl
                            ? "Click to open the config in owid/etl"
                            : undefined
                    }
                />
            }
        >
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
    footer,
}: {
    etl: EtlSource
    isDrifted: boolean
    footer?: string
}): React.ReactElement {
    const { overriddenFields, slugOverride } = etl.drift
    return (
        <div className="chart-source-tooltip">
            <div className="chart-source-tooltip__title">Created in ETL</div>
            {etl.catalogPath && (
                <div className="chart-source-tooltip__catalog-path">
                    {etl.catalogPath}
                </div>
            )}
            <div className="chart-source-tooltip__status">
                <FontAwesomeIcon icon={isDrifted ? faUnlink : faLink} />{" "}
                {isDrifted
                    ? "Changed in the admin since the last ETL push"
                    : "In sync with the last ETL push"}
            </div>
            {isDrifted && (
                <dl className="chart-source-tooltip__drift">
                    {overriddenFields.length > 0 && (
                        <>
                            <dt>Overridden fields</dt>
                            <dd className="chart-source-tooltip__fields">
                                {overriddenFields.map((field) => (
                                    <code key={field}>{field}</code>
                                ))}
                            </dd>
                        </>
                    )}
                    {slugOverride && (
                        <>
                            <dt>Slug</dt>
                            <dd>
                                <code>{slugOverride.slug}</code> in the admin,{" "}
                                <code>{slugOverride.etlSlug}</code> in ETL
                            </dd>
                        </>
                    )}
                </dl>
            )}
            {footer && (
                <div className="chart-source-tooltip__footer">{footer}</div>
            )}
        </div>
    )
}

/** Basic-tab section telling editors the chart is managed by ETL */
export function EtlSourceSection({
    etl,
}: {
    etl: EtlSource
}): React.ReactElement {
    const isDrifted = hasEtlDrift(etl.drift)
    const gitHubUrl = makeEtlConfigGitHubUrl(etl.catalogPath)

    return (
        <Section name="ETL">
            <p>
                <ChartSourceBadge etl={etl} /> This chart was created in ETL.
            </p>
            <CatalogPathField catalogPath={etl.catalogPath ?? undefined} />
            {gitHubUrl && (
                <p>
                    <a
                        href={gitHubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open its config in owid/etl{" "}
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    </a>
                </p>
            )}
            {isDrifted ? (
                <>
                    <p className="mb-1">
                        Changed in the admin since the last ETL push:
                    </p>
                    <ul>
                        {describeEtlDrift(etl.drift).map((description) => (
                            <li key={description}>{description}</li>
                        ))}
                    </ul>
                </>
            ) : (
                <p>In sync with the last ETL push.</p>
            )}
            <small className="form-text text-muted">
                Edits saved here override the ETL config: later ETL pushes no
                longer update the fields you changed.
            </small>
        </Section>
    )
}
