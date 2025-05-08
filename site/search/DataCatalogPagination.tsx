import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { getPaginationPageNumbers } from "@ourworldindata/utils"
import cx from "classnames"
import { useEffect } from "react"

export const DataCatalogPagination = ({
    setPage,
    nbPages,
    currentPage,
}: {
    setPage: (page: number) => void
    currentPage: number
    nbPages: number
}) => {
    useEffect(() => {
        if (currentPage > nbPages) {
            setPage(0)
        }
    }, [currentPage, nbPages, setPage])

    if (nbPages < 2) return null

    function handlePageClick(page: number) {
        setPage(page)
        window.scrollTo({
            top: 0,
        })
    }

    const pages = getPaginationPageNumbers(currentPage, nbPages)

    return (
        <ol className="data-catalog-pagination span-cols-12 col-start-2">
            <li className="data-catalog-pagination__item">
                <button
                    onClick={() => handlePageClick(currentPage - 1)}
                    aria-label="Go to previous page"
                    disabled={currentPage === 0}
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
            </li>
            {pages.map((page) => (
                <li
                    key={page}
                    className={cx({
                        "data-catalog-pagination__item": true,
                        "data-catalog-pagination__item--is-active":
                            page === currentPage,
                    })}
                >
                    <button
                        onClick={() => handlePageClick(page)}
                        aria-label={`Go to page ${page + 1}`}
                        disabled={page === currentPage}
                    >
                        {page + 1}
                    </button>
                </li>
            ))}
            <li className="data-catalog-pagination__item">
                <button
                    onClick={() => handlePageClick(currentPage + 1)}
                    aria-label="Go to next page"
                    disabled={currentPage === nbPages - 1}
                >
                    <FontAwesomeIcon icon={faArrowRight} />
                </button>
            </li>
        </ol>
    )
}
