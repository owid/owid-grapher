import { useRef } from "react"
import cx from "classnames"
import { Link, Tooltip, TooltipTrigger } from "react-aria-components"

export function ChartFooter({
    source,
    note,
    className,
}: {
    source: string
    note?: string
    className?: string
}) {
    const footerRef = useRef<HTMLElement>(null)

    return (
        <footer ref={footerRef} className={cx("chart-footer", className)}>
            <div className="chart-footer__source-and-cc">
                <div>
                    <strong>Data source:</strong> {source}
                </div>
                <TooltipTrigger>
                    <Link
                        className="chart-footer__cc"
                        href="https://creativecommons.org/licenses/by/4.0/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        CC BY
                    </Link>
                    <Tooltip
                        className="chart-footer__tooltip"
                        UNSTABLE_portalContainer={
                            footerRef.current ?? undefined
                        }
                    >
                        Our World in Data charts are licensed under Creative
                        Commons; you are free to use, share, and adapt this
                        material. Click through to the CC BY page for more
                        information. Please bear in mind that the underlying
                        source data for all our charts might be subject to
                        different license terms from third-party authors.
                    </Tooltip>
                </TooltipTrigger>
            </div>
            {note && (
                <div className="chart-footer__note">
                    <strong>Note:</strong> {note}
                </div>
            )}
        </footer>
    )
}
