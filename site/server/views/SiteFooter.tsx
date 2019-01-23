import * as React from 'react'
import { webpack } from 'utils/server/staticGen'

export const SiteFooter = () => {
    return <footer className="SiteFooter">
        <div>
            <a href="/" className="logo">Our World in Data</a> is a <a href="https://creativecommons.org/licenses/by-sa/4.0/">creative commons</a> publication about human civilization at a global scale.
        </div>
        <nav>
            <a href="/about">About</a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLScTaT03ggC7yo8KzRLvoCJY-5mtfuA6jOHheLLFtD5lSHkXlg/viewform">Feedback</a>
            <a href="/subscribe">Subscribe</a>
            <a href="https://twitter.com/OurWorldInData">Twitter</a>
            <a href="https://www.facebook.com/OurWorldinData">Facebook</a>
            <a href="https://github.com/owid">GitHub</a>
            <a href="/support">Donate</a>
        </nav>
        <script src={webpack('commons.js', 'site')}/>
        <script src={webpack('owid.js', 'site')}/>
        <script dangerouslySetInnerHTML={{__html: `
            runHeaderMenus()
            Grapher.embedAll()
        `}}/>
    </footer>
}