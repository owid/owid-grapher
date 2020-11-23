import * as fs from "fs-extra"
import * as path from "path"
import * as glob from "glob"
import { without } from "lodash"
import * as lodash from "lodash"
import * as cheerio from "cheerio"
import ProgressBar = require("progress")
import * as wpdb from "db/wpdb"
import * as db from "db/db"
import * as settings from "settings"
import { formatPost, extractFormattingOptions } from "site/server/formatting"
import { LongFormPage } from "site/server/views/LongFormPage"
import { BASE_DIR, WORDPRESS_DIR } from "serverSettings"
import {
    renderToHtmlPage,
    renderFrontPage,
    renderSubscribePage,
    renderBlogByPageNum,
    renderChartsPage,
    renderMenuJson,
    renderSearchPage,
    renderDonatePage,
    entriesByYearPage,
    makeAtomFeed,
    feedbackPage,
    renderNotFoundPage,
    renderCountryProfile,
    flushCache as siteBakingFlushCache,
} from "site/server/siteRenderers"
import {
    bakeGrapherUrls,
    getGrapherExportsByUrl,
    GrapherExports,
} from "site/server/grapherUtil"
import { makeSitemap } from "site/server/sitemap"
import * as React from "react"
import { embedSnippet } from "site/server/embedCharts"
import { Post } from "db/model/Post"
import { bakeCountries } from "site/server/countryProfiles"
import { countries } from "utils/countries"
import { exec } from "utils/server/serverUtil"
import { log } from "utils/server/log"
import {
    getLegacyCovidExplorerAsExplorerProgramForSlug,
    legacyGrapherToCovidExplorerRedirectTable,
} from "explorer/legacyCovidExplorerRedirects"
import { countryProfileSpecs } from "site/server/countryProfileProjects"
import {
    bakeAllPublishedExplorers,
    renderExplorerPage,
} from "explorer/admin/ExplorerBaker"
import { getRedirects } from "./redirects"
import { bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers } from "./GrapherBaker"

const { BLOG_POSTS_PER_PAGE } = settings

export class SiteBaker {
    private grapherExports!: GrapherExports
    private bakedSiteDir: string

    constructor(bakedSiteDir: string) {
        this.bakedSiteDir = bakedSiteDir
    }

    private async bakeEmbeds() {
        // Find all grapher urls used as embeds in all posts on the site
        const rows = await wpdb.query(
            `SELECT post_content FROM wp_posts WHERE (post_type='page' OR post_type='post' OR post_type='wp_block') AND post_status='publish'`
        )
        let grapherUrls = []
        for (const row of rows) {
            const $ = cheerio.load(row.post_content)
            grapherUrls.push(
                ...$("iframe")
                    .toArray()
                    .filter((el) =>
                        (el.attribs["src"] || "").match(/\/grapher\//)
                    )
                    .map((el) => el.attribs["src"].trim())
            )
        }
        grapherUrls = lodash.uniq(grapherUrls)

        await bakeGrapherUrls(grapherUrls)

        this.grapherExports = await getGrapherExportsByUrl()
    }

    private async bakeCountryProfiles() {
        countryProfileSpecs.forEach(async (spec) => {
            // Delete all country profiles before regenerating them
            await fs.remove(`${this.bakedSiteDir}/${spec.rootPath}`)

            // Not necessary, as this is done by stageWrite already
            // await this.ensureDir(profile.rootPath)
            for (const country of countries) {
                const html = await renderCountryProfile(
                    spec,
                    country,
                    this.grapherExports
                ).catch(() =>
                    console.error(
                        `${country.name} country profile not baked for project "${spec.project}". Check that both pages "${spec.landingPageSlug}" and "${spec.genericProfileSlug}" exist and are published.`
                    )
                )

                if (html) {
                    const outPath = path.join(
                        this.bakedSiteDir,
                        `${spec.rootPath}/${country.slug}.html`
                    )
                    await this.stageWrite(outPath, html)
                }
            }
        })
    }

    // Bake an individual post/page
    private async bakePost(post: wpdb.FullPost) {
        const pageType = await wpdb.getPageType(post)
        const formattingOptions = extractFormattingOptions(post.content)
        const formatted = await formatPost(
            post,
            formattingOptions,
            this.grapherExports
        )
        const html = renderToHtmlPage(
            <LongFormPage
                pageType={pageType}
                post={formatted}
                formattingOptions={formattingOptions}
            />
        )

        const outPath = path.join(this.bakedSiteDir, `${post.slug}.html`)
        await fs.mkdirp(path.dirname(outPath))
        await this.stageWrite(outPath, html)
    }

    // Returns the slugs of posts which exist on the filesystem but are not in the DB anymore.
    // This happens when posts have been saved in previous bakes but have been since then deleted, unpublished or renamed.
    // Among all existing slugs on the filesystem, some are not coming from WP. They are baked independently and should not
    // be deleted if WP does not list them (e.g. grapher/*).
    private getPostSlugsToRemove(postSlugsFromDb: string[]) {
        const existingSlugs = glob
            .sync(`${this.bakedSiteDir}/**/*.html`)
            .map((path) =>
                path.replace(`${this.bakedSiteDir}/`, "").replace(".html", "")
            )
            .filter(
                (path) =>
                    !path.startsWith("uploads") &&
                    !path.startsWith("grapher") &&
                    !path.startsWith("countries") &&
                    !path.startsWith("country") &&
                    !path.startsWith("subscribe") &&
                    !path.startsWith("blog") &&
                    !path.startsWith("entries-by-year") &&
                    !path.startsWith("explore") &&
                    !countryProfileSpecs.some((spec) =>
                        path.startsWith(spec.rootPath)
                    ) &&
                    path !== "donate" &&
                    path !== "feedback" &&
                    path !== "charts" &&
                    path !== "search" &&
                    path !== "index" &&
                    path !== "identifyadmin" &&
                    path !== "404" &&
                    path !== "google8272294305985984"
            )

        return without(existingSlugs, ...postSlugsFromDb)
    }

    // Bake all Wordpress posts, both blog posts and entry pages
    private async bakePosts() {
        const postsApi = await wpdb.getPosts()

        const postSlugs = []
        for (const postApi of postsApi) {
            const post = await wpdb.getFullPost(postApi)

            postSlugs.push(post.slug)
            await this.bakePost(post)
        }

        // Maxes out resources (TODO: RCA)
        // await Promise.all(bakingPosts.map(post => this.bakePost(post)))

        // Delete any previously rendered posts that aren't in the database
        for (const slug of this.getPostSlugsToRemove(postSlugs)) {
            const outPath = `${this.bakedSiteDir}/${slug}.html`
            await fs.unlink(outPath)
            this.stage(outPath, `DELETING ${outPath}`)
        }
    }

    // Bake unique individual pages
    private async bakeSpecialPages() {
        await this.stageWrite(
            `${this.bakedSiteDir}/index.html`,
            await renderFrontPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/subscribe.html`,
            await renderSubscribePage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/donate.html`,
            await renderDonatePage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/feedback.html`,
            await feedbackPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/charts.html`,
            await renderChartsPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/search.html`,
            await renderSearchPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/404.html`,
            await renderNotFoundPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/headerMenu.json`,
            await renderMenuJson()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/sitemap.xml`,
            await makeSitemap()
        )

        await bakeAllPublishedExplorers()
    }

    // Pages that are expected by google scholar for indexing
    private async bakeGoogleScholar() {
        await this.stageWrite(
            `${this.bakedSiteDir}/entries-by-year/index.html`,
            await entriesByYearPage()
        )

        const rows = (await db
            .table(Post.table)
            .where({ status: "publish" })
            .join("post_tags", { "post_tags.post_id": "posts.id" })
            .join("tags", { "tags.id": "post_tags.tag_id" })
            .where({ "tags.name": "Entries" })
            .select(db.raw("distinct year(published_at) as year"))
            .orderBy("year", "DESC")) as { year: number }[]

        const years = rows.map((r) => r.year)

        for (const year of years) {
            await this.stageWrite(
                `${this.bakedSiteDir}/entries-by-year/${year}.html`,
                await entriesByYearPage(year)
            )
        }
    }

    // Bake the blog index
    private async bakeBlogIndex() {
        const allPosts = await wpdb.getBlogIndex()
        const numPages = Math.ceil(allPosts.length / BLOG_POSTS_PER_PAGE)

        for (let i = 1; i <= numPages; i++) {
            const slug = i === 1 ? "blog" : `blog/page/${i}`
            const html = await renderBlogByPageNum(i)
            await this.stageWrite(`${this.bakedSiteDir}/${slug}.html`, html)
        }
    }

    // Bake the RSS feed
    private async bakeRSS() {
        await this.stageWrite(
            `${this.bakedSiteDir}/atom.xml`,
            await makeAtomFeed()
        )
    }

    // Bake the static assets
    private async bakeAssets() {
        await exec(
            `rsync -havL --delete ${WORDPRESS_DIR}/web/app/uploads ${this.bakedSiteDir}/`
        )
        await exec(
            `rm -rf ${this.bakedSiteDir}/assets && cp -r ${BASE_DIR}/dist/webpack ${this.bakedSiteDir}/assets`
        )
        await exec(
            `rsync -hav --delete ${BASE_DIR}/public/* ${this.bakedSiteDir}/`
        )

        await fs.writeFile(
            `${this.bakedSiteDir}/grapher/embedCharts.js`,
            embedSnippet()
        )
        this.stage(`${this.bakedSiteDir}/grapher/embedCharts.js`)
    }

    private async bakeGrapherToExplorerRedirects() {
        const rows = legacyGrapherToCovidExplorerRedirectTable.rows
        for (const row of rows) {
            const { slug, explorerQueryStr } = row
            // todo: restore functionality
            const program = await getLegacyCovidExplorerAsExplorerProgramForSlug(
                slug
            )
            const html = await renderExplorerPage(program!)
            await this.stageWrite(
                `${this.bakedSiteDir}/grapher/${slug}.html`,
                html
            )
        }
    }

    async bakeAll() {
        const progressBar = new ProgressBar(
            "BakeAll [:bar] :current/:total :elapseds :name\n",
            {
                total: 15,
            }
        )

        // Ensure caches are correctly initialized
        this.flushCache()
        progressBar.tick({ name: "✅ cache flushed" })
        const redirects = await getRedirects()
        progressBar.tick({ name: "✅ got redirects" })
        await this.stageWrite(
            path.join(this.bakedSiteDir, `_redirects`),
            redirects.join("\n")
        )
        progressBar.tick({ name: "✅ baked redirects" })
        await this.bakeEmbeds()
        progressBar.tick({ name: "✅ baked embeds" })
        await this.bakeBlogIndex()
        progressBar.tick({ name: "✅ baked blog index" })
        await bakeCountries(this)
        progressBar.tick({ name: "✅ baked countries" })
        await this.bakeRSS()
        progressBar.tick({ name: "✅ baked rss" })
        await this.bakeAssets()
        progressBar.tick({ name: "✅ baked assets" })
        await this.bakeSpecialPages()
        progressBar.tick({ name: "✅ baked special pages" })
        await this.bakeGoogleScholar()
        progressBar.tick({ name: "✅ baked google scholar" })
        await this.bakeCountryProfiles()
        progressBar.tick({ name: "✅ baked country profiles" })
        await this.bakePosts()
        progressBar.tick({ name: "✅ baked posts" })
        await bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers(
            this.bakedSiteDir
        )
        progressBar.tick({
            name:
                "✅ bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers",
        })
        await this.bakeGrapherToExplorerRedirects()
        progressBar.tick({ name: "✅ bakeGrapherToExplorerRedirects" })
        // Clear caches to allow garbage collection while waiting for next run
        this.flushCache()
        progressBar.tick({ name: "✅ cache flushed" })
    }

    async ensureDir(relPath: string) {
        const outPath = path.join(this.bakedSiteDir, relPath)
        await fs.mkdirp(outPath)
    }

    async writeFile(relPath: string, content: string) {
        const outPath = path.join(this.bakedSiteDir, relPath)
        await fs.writeFile(outPath, content)
        this.stage(outPath)
    }

    private async stageWrite(outPath: string, content: string) {
        await fs.mkdirp(path.dirname(outPath))
        await fs.writeFile(outPath, content)
        this.stage(outPath)
    }

    private stage(outPath: string, msg?: string) {
        console.log(msg || outPath)
    }

    private async execAndLogAnyErrorsToSlack(cmd: string) {
        console.log(cmd)
        try {
            return await exec(cmd)
        } catch (error) {
            // Log error to Slack, but do not throw error
            return log.error(error)
        }
    }

    async deployToNetlifyAndPushToGitPush(
        commitMsg: string,
        authorEmail?: string,
        authorName?: string
    ) {
        const deployDirectlyToNetlix = fs.existsSync(
            path.join(this.bakedSiteDir, ".netlify/state.json")
        )
        const progressBar = new ProgressBar(
            "DeployToNetlify [:bar] :current/:total :elapseds :name\n",
            {
                total: 3 + (deployDirectlyToNetlix ? 1 : 0),
            }
        )
        progressBar.tick({ name: "✅ read to deploy" })
        // Deploy directly to Netlify (faster than using the github hook)
        if (deployDirectlyToNetlix) {
            await this.execAndLogAnyErrorsToSlack(
                `cd ${this.bakedSiteDir} && ${BASE_DIR}/node_modules/.bin/netlify deploy -d . --prod --timeout 6000`
            )
            progressBar.tick({ name: "✅ deployed directly to netlify" })
        }

        // Ensure there is a git repo in there
        await this.execAndLogAnyErrorsToSlack(
            `cd ${this.bakedSiteDir} && git init`
        )

        progressBar.tick({ name: "✅ ensured git repo" })

        // Prettify HTML source for easier debugging
        // Target root level HTML files only (entries and posts) for performance
        // reasons.
        // TODO: check again --only-changed
        // await this.exec(`cd ${BAKED_SITE_DIR} && ${BASE_DIR}/node_modules/.bin/prettier --write "./*.html"`)

        if (authorEmail && authorName && commitMsg)
            await this.execAndLogAnyErrorsToSlack(
                `cd ${this.bakedSiteDir} && git add -A . && git commit --author='${authorName} <${authorEmail}>' -a -m '${commitMsg}' && git push origin master`
            )
        else
            await this.execAndLogAnyErrorsToSlack(
                `cd ${this.bakedSiteDir} && git add -A . && git commit -a -m '${commitMsg}' && git push origin master`
            )
        progressBar.tick({ name: "✅ committed and pushed to github" })
    }

    endDbConnections() {
        wpdb.end()
        db.end()
    }

    private flushCache() {
        wpdb.flushCache()
        siteBakingFlushCache()
    }
}
