import React from "react"
import { existsSync, readdir, writeFile, mkdirp, readFile } from "fs-extra"
import path from "path"
import { queryMysql } from "../db/db"
import { getBlockContent } from "../db/wpdb"
import {
    EXPLORER_FILE_SUFFIX,
    ExplorerProgram,
} from "../explorer/ExplorerProgram"
import { Router } from "express"
import { ExplorerPage } from "../site/ExplorerPage"
import {
    EXPLORERS_GIT_CMS_FOLDER,
    EXPLORERS_PREVIEW_ROUTE,
    GetAllExplorersRoute,
    ExplorersRouteResponse,
    DefaultNewExplorerSlug,
    EXPLORERS_ROUTE_FOLDER,
} from "../explorer/ExplorerConstants"
import simpleGit, { SimpleGit } from "simple-git"
import { slugify } from "../clientUtils/Util"
import { GitCommit, JsonError } from "../clientUtils/owidTypes"
import {
    explorerRedirectTable,
    getExplorerRedirectForPath,
} from "./ExplorerRedirects"
import { explorerUrlMigrationsById } from "../explorer/urlMigrations/ExplorerUrlMigrations"

export class ExplorerAdminServer {
    constructor(gitDir: string, baseUrl: string) {
        this.gitDir = gitDir
        this.baseUrl = baseUrl
    }

    private baseUrl: string
    private gitDir: string

    // we store explorers in a subdir of the gitcms for now. idea is we may store other things in there later.
    private get absoluteFolderPath() {
        return this.gitDir + "/" + EXPLORERS_GIT_CMS_FOLDER + "/"
    }

    private _simpleGit?: SimpleGit
    private get simpleGit() {
        if (!this._simpleGit)
            this._simpleGit = simpleGit({
                baseDir: this.gitDir,
                binary: "git",
                maxConcurrentProcesses: 1,
            })
        return this._simpleGit
    }

    async getAllExplorersCommand() {
        // Download all explorers for the admin index page
        try {
            const explorers = await this.getAllExplorers()
            const branches = await this.simpleGit.branchLocal()
            const gitCmsBranchName = await branches.current
            const needsPull = false // todo: add

            return {
                success: true,
                gitCmsBranchName,
                needsPull,
                explorers: explorers.map((explorer) => explorer.toJson()),
            } as ExplorersRouteResponse
        } catch (err) {
            console.log(err)
            return {
                success: false,
                errorMessage: err,
            } as ExplorersRouteResponse
        }
    }

    addMockBakedSiteRoutes(app: Router) {
        app.get(`/${EXPLORERS_ROUTE_FOLDER}/:slug`, async (req, res) => {
            res.set("Access-Control-Allow-Origin", "*")
            const explorers = await this.getAllPublishedExplorers()
            const explorerProgram = explorers.find(
                (program) => program.slug === req.params.slug
            )
            if (explorerProgram)
                res.send(await this.renderExplorerPage(explorerProgram))
            else
                throw new JsonError(
                    "A published explorer with that slug was not found",
                    404
                )
        })
        app.get("/*", async (req, res, next) => {
            const explorerRedirect = getExplorerRedirectForPath(req.path)
            // If no explorer redirect exists, continue to next express handler
            if (!explorerRedirect) return next()

            const { migrationId, baseQueryStr } = explorerRedirect
            const { explorerSlug } = explorerUrlMigrationsById[migrationId]
            const program = await this.getExplorerFromSlug(explorerSlug)
            res.send(
                await this.renderExplorerPage(program, {
                    explorerUrlMigrationId: migrationId,
                    baseQueryStr,
                })
            )
        })
    }

    addAdminRoutes(app: Router) {
        app.get("/errorTest.csv", async (req, res) => {
            // Add `table /admin/errorTest.csv?code=404` to test fetch download failures
            const code =
                req.query.code && !isNaN(parseInt(req.query.code))
                    ? req.query.code
                    : 400

            res.status(code)

            return `Simulating code ${code}`
        })

        app.get(`/${GetAllExplorersRoute}`, async (req, res) => {
            res.send(await this.getAllExplorersCommand())
        })

        app.get(`/${EXPLORERS_PREVIEW_ROUTE}/:slug`, async (req, res) => {
            const slug = slugify(req.params.slug)
            const filename = slug + EXPLORER_FILE_SUFFIX
            if (slug === DefaultNewExplorerSlug)
                return res.send(
                    await this.renderExplorerPage(
                        new ExplorerProgram(DefaultNewExplorerSlug, "")
                    )
                )
            if (!slug || !existsSync(this.absoluteFolderPath + filename))
                return res.send(`File not found`)
            const explorer = await this.getExplorerFromFile(filename)
            return res.send(await this.renderExplorerPage(explorer))
        })
    }

    // todo: make private? once we remove covid legacy stuff?
    async getExplorerFromFile(filename: string) {
        const fullPath = this.absoluteFolderPath + filename
        const content = await readFile(fullPath, "utf8")
        const commits = await this.simpleGit.log({ file: fullPath, n: 1 })
        return new ExplorerProgram(
            filename.replace(EXPLORER_FILE_SUFFIX, ""),
            content,
            commits.latest as GitCommit
        )
    }

    async getExplorerFromSlug(slug: string) {
        return this.getExplorerFromFile(`${slug}${EXPLORER_FILE_SUFFIX}`)
    }

    async bakeAllPublishedExplorers(outputFolder: string) {
        const published = await this.getAllPublishedExplorers()
        await this.bakeExplorersToDir(outputFolder, published)
    }

    private async getAllPublishedExplorers() {
        const explorers = await this.getAllExplorers()
        return explorers.filter((exp) => exp.isPublished)
    }

    private async getAllExplorers() {
        if (!existsSync(this.absoluteFolderPath)) return []
        const files = await readdir(this.absoluteFolderPath)
        const explorerFiles = files.filter((filename) =>
            filename.endsWith(EXPLORER_FILE_SUFFIX)
        )

        const explorers: ExplorerProgram[] = []
        for (const filename of explorerFiles) {
            const explorer = await this.getExplorerFromFile(filename)

            explorers.push(explorer)
        }
        return explorers
    }

    private async write(outPath: string, content: string) {
        await mkdirp(path.dirname(outPath))
        await writeFile(outPath, content)
        console.log(outPath)
    }

    private async bakeExplorersToDir(
        directory: string,
        explorers: ExplorerProgram[] = []
    ) {
        for (const explorer of explorers) {
            await this.write(
                `${directory}/${explorer.slug}.html`,
                await this.renderExplorerPage(explorer)
            )
        }
    }

    async bakeAllExplorerRedirects(outputFolder: string) {
        const explorers = await this.getAllExplorers()
        const redirects = explorerRedirectTable.rows
        for (const redirect of redirects) {
            const { migrationId, path: redirectPath, baseQueryStr } = redirect
            const transform = explorerUrlMigrationsById[migrationId]
            if (!transform) {
                throw new Error(
                    `No explorer URL migration with id '${migrationId}'. Fix the list of explorer redirects and retry.`
                )
            }
            const { explorerSlug } = transform
            const program = explorers.find(
                (program) => program.slug === explorerSlug
            )
            if (!program) {
                throw new Error(
                    `No explorer with slug '${explorerSlug}'. Fix the list of explorer redirects and retry.`
                )
            }
            const html = await this.renderExplorerPage(program, {
                explorerUrlMigrationId: migrationId,
                baseQueryStr,
            })
            await this.write(
                path.join(outputFolder, `${redirectPath}.html`),
                html
            )
        }
    }
}
