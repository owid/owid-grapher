import cx from "clsx"
import { Children } from "react"

interface MetadataBoxSectionProps {
    title?: string
    id?: string
    className?: string
    children: React.ReactNode
}

export function MetadataBoxSection({
    title,
    id,
    className,
    children,
}: MetadataBoxSectionProps): React.ReactElement | null {
    if (Children.toArray(children).length === 0) return null
    return (
        <section className={cx("metadata-box-section", className)}>
            {title && (
                <h2 className="metadata-box-section__title" id={id}>
                    {title}
                </h2>
            )}
            {children}
        </section>
    )
}
