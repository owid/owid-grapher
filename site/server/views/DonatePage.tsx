import * as React from 'react'
import * as _ from 'lodash'

import * as settings from 'settings'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

export const DonatePage = () => {
    return <html>
        <Head canonicalUrl={`${settings.BAKED_BASE_URL}/donate`} pageTitle="Donate"/>
        <body className="blog">
            <SiteHeader/>

            <main>
                <div className="site-content">
                    <h2>Support our work</h2>
                </div>
            </main>
            <SiteFooter/>
        </body>
    </html>
}