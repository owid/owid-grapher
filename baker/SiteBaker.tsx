import fs from "fs-extra"
import { writeFile } from "node:fs/promises"
import path from "path"
import { glob } from "glob"
import { keyBy, without, uniq } from "lodash"
import cheerio from "cheerio"
import fetch from "node-fetch"
import ProgressBar from "progress"
import * as wpdb from "../db/wpdb.js"
import * as db from "../db/db.js"
import {
    BLOG_POSTS_PER_PAGE,
    BASE_DIR,
    WORDPRESS_DIR,
    IMAGE_HOSTING_CDN_URL,
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
    GDOCS_DETAILS_ON_DEMAND_ID,
} from "../settings/serverSettings.js"

import {
    renderFrontPage,
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
    renderPost,
    renderGdoc,
} from "../baker/siteRenderers.js"
import {
    bakeGrapherUrls,
    getGrapherExportsByUrl,
    GrapherExports,
} from "../baker/GrapherBakingUtils.js"
import { makeSitemap } from "../baker/sitemap.js"
import { bakeCountries } from "../baker/countryProfiles.js"
import {
    countries,
    FullPost,
    OwidGdocPublished,
    ImageMetadata,
    clone,
    getFilenameWithoutExtension,
    extractDetailsFromSyntax,
} from "@ourworldindata/utils"
import { execWrapper } from "../db/execWrapper.js"
import { logErrorAndMaybeSendToSlack } from "../serverUtils/slackLog.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { getRedirects, flushCache as redirectsFlushCache } from "./redirects.js"
import { bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers } from "./GrapherBaker.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import {
    bakeAllExplorerRedirects,
    bakeAllPublishedExplorers,
} from "./ExplorerBaker.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { postsTable } from "../db/model/Post.js"
import { Gdoc } from "../db/model/Gdoc/Gdoc.js"
import { Image } from "../db/model/Image.js"
import sharp from "sharp"
import { generateEmbedSnippet } from "../site/viteUtils.js"

// These aren't all "wordpress" steps
// But they're only run when you have the full stack available
const wordpressSteps = [
    "assets",
    "blogIndex",
    "embeds",
    "googleScholar",
    "redirects",
    "rss",
    "wordpressPosts",
] as const

const nonWordpressSteps = [
    "specialPages",
    "countries",
    "countryProfiles",
    "charts",
    "gdocPosts",
    "gdriveImages",
    "dods",
] as const

export const bakeSteps = [...wordpressSteps, ...nonWordpressSteps]

export type BakeStep = (typeof bakeSteps)[number]

export type BakeStepConfig = Set<BakeStep>

const defaultSteps = new Set(bakeSteps)

function getProgressBarTotal(bakeSteps: BakeStepConfig): number {
    // There are 3 non-optional steps: flushCache, removeDeletedPosts, and flushCache (again)
    const minimum = 3
    let total = minimum + bakeSteps.size
    // Redirects has two progress bar ticks
    if (bakeSteps.has("redirects")) total++
    // Add a tick for the validation step that occurs when these two steps run
    if (bakeSteps.has("dods") && bakeSteps.has("charts")) total++
    return total
}

export class SiteBaker {
    private grapherExports!: GrapherExports
    private bakedSiteDir: string
    baseUrl: string
    progressBar: ProgressBar
    explorerAdminServer: ExplorerAdminServer
    bakeSteps: BakeStepConfig

    constructor(
        bakedSiteDir: string,
        baseUrl: string,
        bakeSteps: BakeStepConfig = defaultSteps
    ) {
        this.bakedSiteDir = bakedSiteDir
        this.baseUrl = baseUrl
        this.bakeSteps = bakeSteps
        this.progressBar = new ProgressBar(
            "BakeAll [:bar] :current/:total :elapseds :name\n",
            {
                total: getProgressBarTotal(bakeSteps),
            }
        )
        this.explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)
    }

    private async bakeEmbeds() {
        if (!this.bakeSteps.has("embeds")) return
        // Find all grapher urls used as embeds in all posts on the site
        const rows = await wpdb.singleton.query(
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
        grapherUrls = uniq(grapherUrls)

        await bakeGrapherUrls(grapherUrls)

        this.grapherExports = await getGrapherExportsByUrl()
        this.progressBar.tick({ name: "✅ baked embeds" })
    }

    private async bakeCountryProfiles() {
        if (!this.bakeSteps.has("countryProfiles")) return
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
        this.progressBar.tick({ name: "✅ baked country profiles" })
    }

    // Bake an individual post/page
    async bakeGDocPost(post: OwidGdocPublished) {
        const html = renderGdoc(post)
        const outPath = path.join(this.bakedSiteDir, `${post.slug}.html`)
        await fs.mkdirp(path.dirname(outPath))
        await this.stageWrite(outPath, html)
    }

    // Bake an individual post/page
    private async bakePost(post: FullPost) {
        const html = await renderPost(post, this.baseUrl, this.grapherExports)

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

    private async removeDeletedPosts() {
        const postsApi = await wpdb.getPosts()

        const postSlugs = []
        for (const postApi of postsApi) {
            const post = await wpdb.getFullPost(postApi)
            postSlugs.push(post.slug)
        }

        const gdocPosts = await Gdoc.getPublishedGdocs()

        for (const post of gdocPosts) {
            postSlugs.push(post.slug)
        }

        // Delete any previously rendered posts that aren't in the database
        for (const slug of this.getPostSlugsToRemove(postSlugs)) {
            const outPath = `${this.bakedSiteDir}/${slug}.html`
            await fs.unlink(outPath)
            this.stage(outPath, `DELETING ${outPath}`)
        }

        this.progressBar.tick({ name: "✅ removed deleted posts" })
    }

    private async bakePosts() {
        if (!this.bakeSteps.has("wordpressPosts")) return
        // In the backporting workflow, the users create gdoc posts for posts. As long as these are not yet published,
        // we still want to bake them from the WP posts. Once the users presses publish there though, we want to stop
        // baking them from the wordpress post. Here we fetch all the slugs of posts that have been published via gdocs
        // and exclude them from the baking process.
        const alreadyPublishedViaGdocsSlugs = await db.knexRaw(`-- sql
            select slug from posts_with_gdoc_publish_status
            where isGdocPublished = TRUE`)
        const alreadyPublishedViaGdocsSlugsSet = new Set(
            alreadyPublishedViaGdocsSlugs.map((row: any) => row.slug)
        )

        const postsApi = await wpdb.getPosts(
            undefined,
            (postrow) => !alreadyPublishedViaGdocsSlugsSet.has(postrow.slug)
        )

        const postSlugs = []
        for (const postApi of postsApi) {
            const post = await wpdb.getFullPost(postApi)

            postSlugs.push(post.slug)
            await this.bakePost(post)
        }

        // Maxes out resources (TODO: RCA)
        // await Promise.all(bakingPosts.map(post => this.bakePost(post)))

        this.progressBar.tick({ name: "✅ baked posts" })
    }

    // Bake all GDoc posts
    async bakeGDocPosts() {
        if (!this.bakeSteps.has("gdocPosts")) return
        const publishedGdocs = await Gdoc.getPublishedGdocs()

        // Prefetch publishedGdocs and imageMetadata instead of each instance fetching
        const publishedGdocsDictionary = keyBy(publishedGdocs.map(clone), "id")
        const imageMetadataDictionary = await Image.find().then((images) =>
            keyBy(images, "filename")
        )

        for (const publishedGdoc of publishedGdocs) {
            publishedGdoc.imageMetadata = imageMetadataDictionary
            publishedGdoc.linkedDocuments = publishedGdocsDictionary
            const publishedExplorersBySlug =
                await this.explorerAdminServer.getAllPublishedExplorersBySlug()

            await publishedGdoc.validate(publishedExplorersBySlug)
            if (publishedGdoc.errors.length) {
                await logErrorAndMaybeSendToSlack(
                    `Error(s) baking "${
                        publishedGdoc.slug
                    }" :\n  ${publishedGdoc.errors
                        .map((error) => error.message)
                        .join("\n  ")}`
                )
            }
            await this.bakeGDocPost(publishedGdoc as OwidGdocPublished)
        }

        this.progressBar.tick({ name: "✅ baked google doc posts" })
    }

    // Bake unique individual pages
    private async bakeSpecialPages() {
        if (!this.bakeSteps.has("specialPages")) return
        await this.stageWrite(
            `${this.bakedSiteDir}/index.html`,
            await renderFrontPage()
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
            await makeSitemap(this.explorerAdminServer)
        )

        await bakeAllExplorerRedirects(
            this.bakedSiteDir,
            this.explorerAdminServer
        )

        await bakeAllPublishedExplorers(
            `${this.bakedSiteDir}/${EXPLORERS_ROUTE_FOLDER}`,
            this.explorerAdminServer
        )

        await this.stageWrite(
            `${this.bakedSiteDir}/charts.html`,
            await renderChartsPage(this.explorerAdminServer)
        )
        this.progressBar.tick({ name: "✅ baked special pages" })
    }

    private async validateGrapherDodReferences() {
        if (!this.bakeSteps.has("dods") || !this.bakeSteps.has("charts")) return
        if (!GDOCS_DETAILS_ON_DEMAND_ID) {
            console.error(
                "GDOCS_DETAILS_ON_DEMAND_ID not set. Unable to validate dods."
            )
            return
        }

        const details = await Gdoc.getDetailsOnDemandGdoc()

        if (!details) {
            this.progressBar.tick({
                name: "✅ no details exist. skipping grapher dod validation step",
            })
            return
        }

        const charts: { slug: string; subtitle: string; note: string }[] =
            await db.queryMysql(`
            SELECT config->>'$.slug' as slug, config->>'$.subtitle' as subtitle, config->>'$.note' as note
            FROM charts
            WHERE JSON_EXTRACT(config, "$.isPublished") = true
            AND (JSON_EXTRACT(config, "$.subtitle") LIKE "%#dod:%")
            OR (JSON_EXTRACT(config, "$.note") LIKE "%#dod:%")
            ORDER BY JSON_EXTRACT(config, "$.slug") ASC
        `)

        for (const chart of charts) {
            const detailIds = new Set(
                extractDetailsFromSyntax(`${chart.note} ${chart.subtitle}`)
            )
            for (const detailId of detailIds) {
                if (!details[detailId]) {
                    logErrorAndMaybeSendToSlack(
                        `Grapher with slug ${chart.slug} references dod "${detailId}" which does not exist`
                    )
                }
            }
        }

        this.progressBar.tick({ name: "✅ validated grapher dods" })
    }

    private async bakeDetailsOnDemand() {
        if (!this.bakeSteps.has("dods")) return
        if (!GDOCS_DETAILS_ON_DEMAND_ID) {
            console.error(
                "GDOCS_DETAILS_ON_DEMAND_ID not set. Unable to bake dods."
            )
            return
        }

        const details = await Gdoc.getDetailsOnDemandGdoc()

        if (details) {
            await this.stageWrite(
                `${this.bakedSiteDir}/dods.json`,
                JSON.stringify(details)
            )
            // This task completes too quickly and doesn't tick correctly without this
            await new Promise((resolve) => {
                setTimeout(() => {
                    this.progressBar.tick({ name: "✅ baked dods.json" })
                    resolve(true)
                }, 250)
            })
        } else {
            throw Error("Details on demand not found")
        }
    }

    // Pages that are expected by google scholar for indexing
    private async bakeGoogleScholar() {
        if (!this.bakeSteps.has("googleScholar")) return
        await this.stageWrite(
            `${this.bakedSiteDir}/entries-by-year/index.html`,
            await entriesByYearPage()
        )

        const rows = (await db
            .knexTable(postsTable)
            .where({ status: "publish" })
            .join("post_tags", { "post_tags.post_id": "posts.id" })
            .join("tags", { "tags.id": "post_tags.tag_id" })
            .where({ "tags.name": "Entries" })
            .select(db.knexRaw("distinct year(published_at) as year"))
            .orderBy("year", "DESC")) as { year: number }[]

        const years = rows.map((r) => r.year)

        for (const year of years) {
            await this.stageWrite(
                `${this.bakedSiteDir}/entries-by-year/${year}.html`,
                await entriesByYearPage(year)
            )
        }

        this.progressBar.tick({ name: "✅ baked google scholar" })
    }

    // Bake the blog index
    private async bakeBlogIndex() {
        if (!this.bakeSteps.has("blogIndex")) return
        const allPosts = await wpdb.getBlogIndex()
        const numPages = Math.ceil(allPosts.length / BLOG_POSTS_PER_PAGE)

        for (let i = 1; i <= numPages; i++) {
            const slug = i === 1 ? "blog" : `blog/page/${i}`
            const html = await renderBlogByPageNum(i)
            await this.stageWrite(`${this.bakedSiteDir}/${slug}.html`, html)
        }
        this.progressBar.tick({ name: "✅ baked blog index" })
    }

    // Bake the RSS feed
    private async bakeRSS() {
        if (!this.bakeSteps.has("rss")) return
        await this.stageWrite(
            `${this.bakedSiteDir}/atom.xml`,
            await makeAtomFeed()
        )
        this.progressBar.tick({ name: "✅ baked rss" })
    }

    private async bakeDriveImages() {
        if (!this.bakeSteps.has("gdriveImages")) return
        const images: Image[] = await db
            .queryMysql(
                `SELECT * FROM images WHERE id IN (SELECT DISTINCT imageId FROM posts_gdocs_x_images)`
            )
            .then((results: ImageMetadata[]) =>
                results.map((result) => Image.create<Image>(result))
            )

        this.ensureDir("images/published")
        const imagesDirectory = path.join(
            this.bakedSiteDir,
            "images",
            "published"
        )

        await Promise.all(
            images.map(async (image) => {
                const remoteFilePath = path.join(
                    IMAGE_HOSTING_CDN_URL,
                    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
                    image.filename
                )
                return fetch(remoteFilePath)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(
                                `Fetching image failed: ${response.status} ${response.statusText} ${response.url}`
                            )
                        }
                        return response.buffer()
                    })
                    .then(async (buffer) => {
                        if (!image.isSvg) {
                            await Promise.all(
                                image.sizes!.map((width) => {
                                    const localResizedFilepath = path.join(
                                        imagesDirectory,
                                        `${image.filenameWithoutExtension}_${width}.webp`
                                    )
                                    return sharp(buffer)
                                        .resize(width)
                                        .webp({
                                            lossless: true,
                                        })
                                        .toFile(localResizedFilepath)
                                })
                            )
                        } else {
                            // A PNG alternative to the SVG for the "Download image" link
                            const pngFilename = `${getFilenameWithoutExtension(
                                image.filename
                            )}.png`
                            await sharp(buffer)
                                .resize(2000)
                                .png()
                                .toFile(path.join(imagesDirectory, pngFilename))
                        }
                        // For SVG, and a non-webp fallback copy of the image
                        await writeFile(
                            path.join(imagesDirectory, image.filename),
                            buffer
                        )
                    })
            })
        )
        this.progressBar.tick({ name: "✅ baked google drive images" })
    }

    // Bake the static assets
    private async bakeAssets() {
        if (!this.bakeSteps.has("assets")) return
        await execWrapper(
            `rsync -havL --delete ${WORDPRESS_DIR}/web/app/uploads ${this.bakedSiteDir}/`
        )

        await execWrapper(
            `rm -rf ${this.bakedSiteDir}/assets && cp -r ${BASE_DIR}/dist/assets ${this.bakedSiteDir}/assets`
        )
        await execWrapper(
            `rsync -hav --delete ${BASE_DIR}/public/* ${this.bakedSiteDir}/`
        )

        await fs.writeFile(
            `${this.bakedSiteDir}/grapher/embedCharts.js`,
            generateEmbedSnippet()
        )
        this.stage(`${this.bakedSiteDir}/grapher/embedCharts.js`)
        this.progressBar.tick({ name: "✅ baked assets" })
    }

    async bakeRedirects() {
        if (!this.bakeSteps.has("redirects")) return
        const redirects = await getRedirects()
        this.progressBar.tick({ name: "✅ got redirects" })
        await this.stageWrite(
            path.join(this.bakedSiteDir, `_redirects`),
            redirects.join("\n")
        )
        this.progressBar.tick({ name: "✅ baked redirects" })
    }

    async bakeWordpressPages() {
        await this.bakeRedirects()
        await this.bakeEmbeds()
        await this.bakeBlogIndex()
        await this.bakeRSS()
        await this.bakeAssets()
        await this.bakeGoogleScholar()
        await this.bakePosts()
    }

    private async _bakeNonWordpressPages() {
        if (this.bakeSteps.has("countries")) {
            await bakeCountries(this)
        }
        await this.bakeSpecialPages()
        await this.bakeCountryProfiles()
        if (this.bakeSteps.has("charts")) {
            await bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers(
                this.bakedSiteDir
            )
            this.progressBar.tick({
                name: "✅ bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers",
            })
        }
        await this.bakeDetailsOnDemand()
        await this.validateGrapherDodReferences()
        await this.bakeGDocPosts()
        await this.bakeDriveImages()
    }

    async bakeNonWordpressPages() {
        await db.getConnection()
        const progressBarTotal = nonWordpressSteps
            .map((step) => this.bakeSteps.has(step))
            .filter((hasStep) => hasStep).length
        this.progressBar = new ProgressBar(
            "BakeAll [:bar] :current/:total :elapseds :name\n",
            {
                total: progressBarTotal,
            }
        )
        await this._bakeNonWordpressPages()
    }

    async bakeAll() {
        // Ensure caches are correctly initialized
        this.flushCache()
        await this.removeDeletedPosts()
        await this.bakeWordpressPages()
        await this._bakeNonWordpressPages()
        this.flushCache()
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
            return await execWrapper(cmd)
        } catch (error) {
            // Log error to Slack, but do not throw error
            return logErrorAndMaybeSendToSlack(error)
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
        progressBar.tick({ name: "✅ ready to deploy" })
        // Deploy directly to Netlify (faster than using the github hook)
        if (deployDirectlyToNetlix) {
            await this.execAndLogAnyErrorsToSlack(
                `cd ${this.bakedSiteDir} && ${BASE_DIR}/node_modules/.bin/netlify deploy -d . --prodIfUnlocked --timeout 6000`
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
        // await this.execWrapper(`cd ${BAKED_SITE_DIR} && ${BASE_DIR}/node_modules/.bin/prettier --write "./*.html"`)

        if (authorEmail && authorName && commitMsg)
            await this.execAndLogAnyErrorsToSlack(
                `cd ${this.bakedSiteDir} && git add -A . && git commit --allow-empty --author='${authorName} <${authorEmail}>' -a -m '${commitMsg}' && git push origin master`
            )
        else
            await this.execAndLogAnyErrorsToSlack(
                `cd ${this.bakedSiteDir} && git add -A . && git commit --allow-empty -a -m '${commitMsg}' && git push origin master`
            )
        progressBar.tick({ name: "✅ committed and pushed to github" })
    }

    endDbConnections() {
        wpdb.singleton.end()
        db.closeTypeOrmAndKnexConnections()
    }

    private flushCache() {
        // Clear caches to allow garbage collection while waiting for next run
        wpdb.flushCache()
        siteBakingFlushCache()
        redirectsFlushCache()
        this.progressBar.tick({ name: "✅ cache flushed" })
    }
}
