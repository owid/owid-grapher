import cx from "classnames"
import {
    getPaginationPageNumbers,
    queryParamsToStr,
} from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"

export interface PaginationProps {
    pageNumber: number
    totalPageCount: number
    basePath: string
    queryParams?: Record<string, string>
    className?: string
    usePagePrefix?: boolean
}

export const Pagination = (props: PaginationProps) => {
    const {
        pageNumber,
        totalPageCount,
        basePath,
        queryParams,
        className,
        usePagePrefix = false,
    } = props
    if (totalPageCount <= 1) return null

    const queryParamsString = queryParams ? queryParamsToStr(queryParams) : ""

    const getPageUrl = (page: number) => {
        if (usePagePrefix) {
            return page === 1
                ? `${basePath}${queryParamsString}`
                : `${basePath}/page/${page}${queryParamsString}`
        } else {
            return page === 1
                ? `${basePath}${queryParamsString}`
                : `${basePath}/${page}${queryParamsString}`
        }
    }

    // pageNumber is 0-indexed for data-insights compatibility, but 1-indexed for others
    const currentPage = usePagePrefix ? pageNumber : pageNumber + 1
    const prevPage = currentPage - 1
    const nextPage = currentPage + 1

    const prevTarget = prevPage >= 1 ? getPageUrl(prevPage) : ""
    const isLeftArrowDisabled = prevPage < 1

    const nextTarget = nextPage <= totalPageCount ? getPageUrl(nextPage) : ""
    const isRightArrowDisabled = nextPage > totalPageCount

    // Select 5 values around the current page number
    const displayPageNumber = usePagePrefix ? pageNumber - 1 : pageNumber
    const pageNumbers = getPaginationPageNumbers(
        displayPageNumber,
        totalPageCount
    )

    return (
        <div className={cx("pagination", className)}>
            <a
                href={prevTarget}
                aria-disabled={isLeftArrowDisabled}
                className={cx("pagination__link", {
                    "pagination__link--disabled": isLeftArrowDisabled,
                })}
            >
                <FontAwesomeIcon icon={faArrowLeft} />
            </a>
            {pageNumbers.map((i) => {
                const pageNum = i + 1
                return (
                    <a
                        href={getPageUrl(pageNum)}
                        key={i}
                        className={cx("pagination__link", {
                            "pagination__link--active": pageNum === currentPage,
                        })}
                    >
                        {pageNum}
                    </a>
                )
            })}
            <a
                href={nextTarget}
                aria-disabled={isRightArrowDisabled}
                className={cx("pagination__link", {
                    "pagination__link--disabled": isRightArrowDisabled,
                })}
            >
                <FontAwesomeIcon icon={faArrowRight} />
            </a>
        </div>
    )
}
