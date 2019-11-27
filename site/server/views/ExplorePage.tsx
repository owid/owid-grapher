import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"

export const ExplorePage = () => (
  <html>
    <Head
      canonicalUrl={`${settings.BAKED_BASE_URL}/explore`}
      pageTitle="Explore"
    >
    </Head>
    <body className="ExplorePage">
      <SiteHeader />
      <blockquote>
        “We shall not cease from exploration, and the end of all our exploring will be to arrive
        where we started and know the place for the first time.”
      </blockquote>
      <SiteFooter />
    </body>
  </html>
)
