import cx from "clsx"

export function MetadataBoxKeyData({
    children,
}: {
    children: React.ReactNode
}): React.ReactElement {
    return <dl className="metadata-box-key-data">{children}</dl>
}

interface MetadataBoxKeyDataRowProps {
    label: string
    isFullWidth?: boolean
    /** Hides the label visually */
    isLabelScreenReaderOnly?: boolean
    labelClassName?: string
    className?: string
    children: React.ReactNode
}

export function MetadataBoxKeyDataRow({
    label,
    isFullWidth,
    isLabelScreenReaderOnly,
    labelClassName,
    className,
    children,
}: MetadataBoxKeyDataRowProps): React.ReactElement {
    return (
        <div
            className={cx("metadata-box-key-data__row", className, {
                "metadata-box-key-data__row--full-width": isFullWidth,
            })}
        >
            <dt
                className={
                    isLabelScreenReaderOnly
                        ? "sr-only"
                        : cx("metadata-box-key-data__key", labelClassName)
                }
            >
                {label}
            </dt>
            <dd className="metadata-box-key-data__value">{children}</dd>
        </div>
    )
}
