import { LICENSE_ID } from "@ourworldindata/utils"
import { IS_ARCHIVE } from "../../../settings/clientSettings.js"
import { PROD_URL } from "../../SiteConstants.js"

const BASE_URL = IS_ARCHIVE ? PROD_URL : ""

/** The "Reuse this work freely" section at the foot of a gdoc page */
export function LicenseSection({ isDeprecated }: { isDeprecated?: boolean }) {
    return (
        <section
            id={LICENSE_ID}
            className="grid grid-cols-12-full-width col-start-1 col-end-limit"
        >
            <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                {!isDeprecated && (
                    <>
                        <img
                            src="/owid-logo.svg"
                            alt="Our World in Data logo"
                            loading="lazy"
                            width={104}
                            height={57}
                        />
                        <h3>Reuse this work freely</h3>
                    </>
                )}

                <p>
                    All visualizations, data, and articles produced by Our World
                    in Data are completely open access under the{" "}
                    <a href="https://creativecommons.org/licenses/by/4.0/">
                        Creative Commons BY license
                    </a>
                    . You have the permission to use, distribute, and reproduce
                    these in any medium, provided the source and authors are
                    credited.
                </p>
                <p>
                    The data produced by third parties and made available by Our
                    World in Data is subject to the license terms from the
                    original third-party authors. We will always indicate the
                    original source of the data in our documentation, so you
                    should always check the license of any such third-party data
                    before use and redistribution.
                </p>
                {!isDeprecated && (
                    <p>
                        All of{" "}
                        <a
                            href={`${BASE_URL}/faqs#how-can-i-embed-one-of-your-interactive-charts-in-my-website`}
                        >
                            our charts can be embedded
                        </a>{" "}
                        in any site.
                    </p>
                )}
            </div>
        </section>
    )
}
