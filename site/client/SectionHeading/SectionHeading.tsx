import * as React from "react"
import { TocHeading } from "site/server/formatting"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"

export const SectionHeading = ({
    title,
    tocHeadings,
    children
}: {
    title: string
    tocHeadings: TocHeading[]
    children: any
}) => {
    const sectionHeadingIdx = tocHeadings.findIndex(
        heading => !heading.isSubheading && heading.text === title
    )
    const subHeadings = []

    for (let i = sectionHeadingIdx + 1; i < tocHeadings.length; i++) {
        if (tocHeadings[i].isSubheading === true) {
            subHeadings.push(tocHeadings[i])
        } else {
            break
        }
    }

    return (
        <div className="section-heading">
            <div className="wrapper">
                {children}
                {subHeadings.length !== 0 && (
                    <>
                        <div className="in-this-section">
                            <div className="label">In this section</div>
                            <div className="border"></div>
                        </div>
                        <ul className="subheadings">
                            {subHeadings.map(subHeading => (
                                <li>
                                    <a href={`#${subHeading.slug}`}>
                                        <FontAwesomeIcon icon={faArrowDown} />
                                        {subHeading.html ? (
                                            <span
                                                dangerouslySetInnerHTML={{
                                                    __html: subHeading.html
                                                }}
                                            ></span>
                                        ) : (
                                            subHeading.text
                                        )}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    )
}
