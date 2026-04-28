import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
} from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faTriangleExclamation,
    faCircleExclamation,
} from "@fortawesome/free-solid-svg-icons"

export function PreviewErrorBanner({
    errors,
}: {
    errors: OwidGdocErrorMessage[]
}) {
    if (!errors.length) return null

    const errorCount = errors.filter(
        (e) => e.type === OwidGdocErrorMessageType.Error
    ).length
    const warningCount = errors.length - errorCount

    return (
        <div
            className="preview-error-banner"
            role="alert"
            data-no-snippet
            data-testid="preview-error-banner"
        >
            <div className="preview-error-banner__header">
                <FontAwesomeIcon icon={faTriangleExclamation} />
                <span>
                    Preview validation:{" "}
                    {errorCount > 0 &&
                        `${errorCount} error${errorCount === 1 ? "" : "s"}`}
                    {errorCount > 0 && warningCount > 0 && ", "}
                    {warningCount > 0 &&
                        `${warningCount} warning${warningCount === 1 ? "" : "s"}`}
                </span>
            </div>
            <ul className="preview-error-banner__list">
                {errors.map((error, i) => (
                    <li
                        key={i}
                        className={`preview-error-banner__item preview-error-banner__item--${error.type}`}
                    >
                        <FontAwesomeIcon
                            icon={
                                error.type === OwidGdocErrorMessageType.Error
                                    ? faCircleExclamation
                                    : faTriangleExclamation
                            }
                        />
                        <span className="preview-error-banner__property">
                            {error.property}
                        </span>
                        <span className="preview-error-banner__message">
                            {error.message}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
