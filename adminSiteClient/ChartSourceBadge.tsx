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

/**
 * Where a chart is authored: in ETL (in sync or drifted) or in the admin.
 * An ETL badge links to the step's config in owid/etl, unless `onClick` is
 * given.
 */
export function ChartSourceBadge({
    etl,
    onClick,
}: {
    etl?: EtlSource
    onClick?: () => void
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
        "chart-source-badge--button": onClick,
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
                        onClick
                            ? "Click for details"
                            : gitHubUrl
                              ? "Click to open the config in owid/etl"
                              : undefined
                    }
                />
            }
        >
            {onClick ? (
                <button type="button" className={className} onClick={onClick}>
                    {content}
                </button>
            ) : gitHubUrl ? (
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

/** Debug-tab section telling editors the chart is managed by ETL */
export function EtlSourceSection({
    etl,
    highlightOnMount = false,
    onHighlighted,
}: {
    etl: EtlSource
    /** Briefly outline the section and scroll to it when it mounts */
    highlightOnMount?: boolean
    onHighlighted?: () => void
}): React.ReactElement {
    const [isDriftExpanded, setIsDriftExpanded] = React.useState(false)
    // Fixed at mount, so the highlight plays once even if the prop changes
    const [isHighlighted] = React.useState(highlightOnMount)
    const ref = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (!isHighlighted) return
        ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        onHighlighted?.()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const isDrifted = hasEtlDrift(etl.drift)
    const gitHubUrl = makeEtlConfigGitHubUrl(etl.catalogPath)

    return (
        <div
            ref={ref}
            className={cx("etl-source-section", {
                "etl-source-section--highlighted": isHighlighted,
            })}
        >
            <Section name="ETL">
                <p>
                    This chart was created in ETL.
                    {gitHubUrl && (
                        <>
                            {" "}
                            <a
                                href={gitHubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View config in owid/etl{" "}
                                <FontAwesomeIcon
                                    icon={faArrowUpRightFromSquare}
                                />
                            </a>
                        </>
                    )}
                </p>
                <CatalogPathField catalogPath={etl.catalogPath ?? undefined} />
                {isDrifted ? (
                    <div className="etl-source-section__drift-note">
                        <FontAwesomeIcon icon={faUnlink} /> There are changes in
                        the admin since the last ETL push.{" "}
                        <button
                            type="button"
                            className="btn btn-link p-0 align-baseline"
                            onClick={() => setIsDriftExpanded(!isDriftExpanded)}
                        >
                            {isDriftExpanded ? "View less" : "View more"}
                        </button>
                        {isDriftExpanded && (
                            <ul className="mt-2 mb-0">
                                {describeEtlDrift(etl.drift).map(
                                    (description) => (
                                        <li key={description}>{description}</li>
                                    )
                                )}
                            </ul>
                        )}
                    </div>
                ) : (
                    <p>In sync with the last ETL push.</p>
                )}
                <small className="form-text text-muted">
                    Edits saved here override the ETL config: later ETL pushes
                    no longer update the fields you changed.
                </small>
            </Section>
        </div>
    )
}
