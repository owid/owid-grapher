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
        pageNumber, // 1-indexed
        totalPageCount,
        basePath,
        queryParams,
        className,
        usePagePrefix = false,
    } = props
    if (totalPageCount <= 1) return null

    const queryParamsString = queryParams ? queryParamsToStr(queryParams) : ""

    const getPageUrl = (pageNumber: number) => {
        if (usePagePrefix) {
            return pageNumber === 1
                ? `${basePath}${queryParamsString}`
                : `${basePath}/page/${pageNumber}${queryParamsString}`
        } else {
            return pageNumber === 1
                ? `${basePath}${queryParamsString}`
                : `${basePath}/${pageNumber}${queryParamsString}`
        }
    }

    const prevPage = pageNumber - 1
    const nextPage = pageNumber + 1

    const isLeftArrowDisabled = prevPage < 1
    const prevTarget = !isLeftArrowDisabled ? getPageUrl(prevPage) : ""

    const isRightArrowDisabled = nextPage > totalPageCount
    const nextTarget = !isRightArrowDisabled ? getPageUrl(nextPage) : ""

    // Select 5 values around the current page number
    const pageNumbers = getPaginationPageNumbers(pageNumber, totalPageCount)

    return (
        <div className={cx("pagination", className)}>
            <a
                href={prevTarget}
                aria-disabled={isLeftArrowDisabled}
                aria-hidden={isLeftArrowDisabled}
                tabIndex={isLeftArrowDisabled ? -1 : 0}
                aria-label={
                    isLeftArrowDisabled
                        ? `Previous page is not available`
                        : `Go to previous page (${prevPage})`
                }
                className={cx("pagination__link", {
                    "pagination__link--disabled": isLeftArrowDisabled,
                })}
            >
                <FontAwesomeIcon icon={faArrowLeft} />
            </a>
            {pageNumbers.map((pageNum) => {
                return (
                    <a
                        href={getPageUrl(pageNum)}
                        key={pageNum}
                        aria-current={
                            pageNum === pageNumber ? "page" : undefined
                        }
                        aria-label={`Go to page ${pageNum}`}
                        aria-disabled={pageNum === pageNumber}
                        className={cx("pagination__link", {
                            "pagination__link--active": pageNum === pageNumber,
                        })}
                    >
                        {pageNum}
                    </a>
                )
            })}
            <a
                href={nextTarget}
                aria-disabled={isRightArrowDisabled}
                aria-hidden={isRightArrowDisabled}
                tabIndex={isRightArrowDisabled ? -1 : 0}
                aria-label={
                    isRightArrowDisabled
                        ? `Next page is not available`
                        : `Go to next page (${nextPage})`
                }
                className={cx("pagination__link", {
                    "pagination__link--disabled": isRightArrowDisabled,
                })}
            >
                <FontAwesomeIcon icon={faArrowRight} />
            </a>
        </div>
    )
}
