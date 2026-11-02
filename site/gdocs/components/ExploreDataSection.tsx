import { PropsWithChildren } from "react"
import cx from "clsx"
import {
    ExploreDataSectionAlignment,
    EXPLORE_DATA_SECTION_ID,
    EXPLORE_DATA_SECTION_DEFAULT_TITLE,
} from "@ourworldindata/types"
import { useDocumentContext } from "../DocumentContext.js"
import { sentenceCaseIfNotTopicPage } from "@ourworldindata/utils"

type ExploreDataSectionProps = PropsWithChildren<{
    title?: string
    className?: string
    align: ExploreDataSectionAlignment
}>

export const ExploreDataSection = ({
    title = EXPLORE_DATA_SECTION_DEFAULT_TITLE,
    className,
    align,
    children,
}: ExploreDataSectionProps) => {
    const { gdocType } = useDocumentContext()
    const titleCaseCorrected = sentenceCaseIfNotTopicPage(title, gdocType)
    return (
        <section
            id={EXPLORE_DATA_SECTION_ID}
            className={cx(
                className,
                "explore-data-section",
                `explore-data-section--${align}`,
                "no-dividers"
            )}
        >
            <header className="explore-data-section__header col-start-2 span-cols-12 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                <div className="icon" aria-hidden="true">
                    {icon}
                </div>
                <h1>{titleCaseCorrected}</h1>
            </header>
            {children}
        </section>
    )
}

const icon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none">
        <path
            fill="#ce261e"
            d="M5.283 10.788h2.264v6.659H5.283zm3.774-3.996h2.264v11.321H9.057zm3.773 2.664h2.264v7.991H12.83z"
        />
        <path
            fill="#355174"
            d="M9.75 0A9.75 9.75 0 0 0 0 9.75c0 5.383 4.365 9.748 9.75 9.748 2.107 0 4.16-.684 5.846-1.95l5.686 5.685c.22.218.573.218.793 0l1.157-1.158a.56.56 0 0 0 0-.792l-5.684-5.684a9.75 9.75 0 0 0 1.95-5.85C19.498 4.365 15.133 0 9.75 0m0 1.95a7.8 7.8 0 0 1-.001 15.599 7.8 7.8 0 0 1-7.8-7.8 7.8 7.8 0 0 1 7.8-7.8Z"
        />
    </svg>
)
