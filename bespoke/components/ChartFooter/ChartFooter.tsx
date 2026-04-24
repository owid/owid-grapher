import cx from "classnames"
import { Tippy } from "@ourworldindata/utils"
import { useTippyContainer } from "../../hooks/useTippyContainer.js"

const CC_BY_TOOLTIP =
    "Our World in Data charts are licensed under Creative Commons; you are free to use, share, and adapt this material. Click through to the CC BY page for more information. Please bear in mind that the underlying source data for all our charts might be subject to different license terms from third-party authors."

export function ChartFooter({
    source,
    note,
    className,
}: {
    source: React.ReactNode
    note?: React.ReactNode
    className?: string
}) {
    const { ref: footerRef, getTippyContainer } =
        useTippyContainer<HTMLElement>()

    const ccBy = (
        <Tippy
            content={CC_BY_TOOLTIP}
            appendTo={getTippyContainer}
            arrow={false}
        >
            <a
                className="chart-footer__cc"
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
            >
                CC BY
            </a>
        </Tippy>
    )

    return (
        <footer ref={footerRef} className={cx("chart-footer", className)}>
            {note ? (
                <>
                    <div>
                        <strong>Data source:</strong> {source}
                    </div>
                    <div className="chart-footer__row chart-footer__note-row">
                        <div className="chart-footer__note">
                            <strong>Note:</strong> {note}
                        </div>
                        {ccBy}
                    </div>
                </>
            ) : (
                <div className="chart-footer__row">
                    <div>
                        <strong>Data source:</strong> {source}
                    </div>
                    {ccBy}
                </div>
            )}
        </footer>
    )
}
