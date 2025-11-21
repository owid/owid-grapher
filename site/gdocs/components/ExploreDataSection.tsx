import { PropsWithChildren } from "react"
import cx from "classnames"
import { ExploreDataSectionAlignment } from "@ourworldindata/types"

type ExploreDataSectionProps = PropsWithChildren<{
    title?: string
    className?: string
    align: ExploreDataSectionAlignment
}>

export const ExploreDataSection = ({
    title = "Explore the data",
    className,
    align,
    children,
}: ExploreDataSectionProps) => {
    return (
        <section
            className={cx(
                className,
                "explore-data-section",
                `explore-data-section--${align}`
            )}
        >
            <header className="explore-data-section__header col-start-2 span-cols-12">
                <div className="icon">{icon}</div>
                <h1>{title}</h1>
            </header>
            {children}
        </section>
    )
}

const icon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none">
        <path
            fill="#CE261E"
            d="M5.283 10.788h2.264v6.659H5.283zM9.057 6.792h2.264v11.321H9.057zM12.83 9.456h2.264v7.991H12.83z"
        />
        <path
            fill="#46688F"
            d="M9.75 0C4.364 0 0 4.365 0 9.75c0 5.383 4.365 9.748 9.75 9.748 2.107 0 4.16-.684 5.846-1.95l5.686 5.685c.22.218.573.218.793 0l1.157-1.158a.561.561 0 0 0 0-.792l-5.684-5.684a9.746 9.746 0 0 0 1.95-5.85C19.498 4.365 15.133 0 9.75 0Zm0 1.95c4.307 0 7.799 3.491 7.799 7.8 0 4.307-3.492 7.799-7.8 7.799a7.799 7.799 0 0 1-7.8-7.8c0-4.308 3.492-7.8 7.8-7.8Z"
        />
    </svg>
)
