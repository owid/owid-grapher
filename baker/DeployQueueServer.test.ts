import { expect, it, describe, vi } from "vitest"

import fs from "fs-extra"
import { DeployQueueServer } from "./DeployQueueServer.js"
import {
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
} from "../settings/serverSettings.js"

describe("parseQueueContent", () => {
    const server = new DeployQueueServer()
    it("parses newline delimited JSON objects", async () => {
        const output = server.parseQueueContent(
            [
                `{"authorName": "Tester", "message": "Updated chart test-chart-please-ignore"}`,
                `{"authorName": "Tester", "message": "something one"}`,
                ``, // empty line will be ignored
                `invalid json`, // invalid json will be ignored
                `{"authorName": "Tester", "message": "something two"}`,
                `{"authorName": "Tester", "message": "lightning deploy", "slug": "article-lightning-deploy"}`, // the presence of a slug makes the change eligible to a lightning deploy
            ].join("\n")
        )
        expect(output[0].authorName).toEqual("Tester")
        expect(output[0].message).toEqual(
            "Updated chart test-chart-please-ignore"
        )
        expect(output[1].message).toEqual("something one")
        expect(output[2].message).toEqual("something two")
        expect(output[3].slug).toEqual("article-lightning-deploy")
    })
})

// todo: pretty sure Spyon is an antipattern. Create a deploy class that takes an interface with the subset of fs instead, and then can pass
// a tiny mock FS for testing.
describe("getDeploys", () => {
    const server = new DeployQueueServer()
    it("is empty when nothing is in the queues", async () => {
        vi.spyOn(fs, "readFile").mockImplementation(
            (async (): Promise<string> => {
                return ``
            }) as any
        )
        expect(await server.getDeploys()).toEqual([])
    })

    it("parses queued deploy file", async () => {
        vi.spyOn(fs, "readFile").mockImplementation((async (
            path: string
        ): Promise<string> => {
            if (path === DEPLOY_QUEUE_FILE_PATH)
                return [`{"message": "test1"}`, `{"message": "test2"}`].join(
                    "\n"
                )
            if (path === DEPLOY_PENDING_FILE_PATH) return ``
            return ``
        }) as any)
        expect(await server.getDeploys()).toEqual([
            {
                status: "queued",
                changes: [{ message: "test2" }, { message: "test1" }],
            },
        ])
    })

    it("parses pending deploy file", async () => {
        vi.spyOn(fs, "pathExists").mockImplementation(async () => true)
        vi.spyOn(fs, "readFile").mockImplementation((async (
            path: string
        ): Promise<string> => {
            if (path === DEPLOY_QUEUE_FILE_PATH)
                return [`{"message": "test1"}`, `{"message": "test2"}`].join(
                    "\n"
                )
            if (path === DEPLOY_PENDING_FILE_PATH)
                return [`{"message": "test3"}`, `{"message": "test4"}`].join(
                    "\n"
                )
            return ``
        }) as any)

        expect(await server.getDeploys()).toEqual([
            {
                status: "queued",
                changes: [{ message: "test2" }, { message: "test1" }],
            },
            {
                status: "pending",
                changes: [{ message: "test4" }, { message: "test3" }],
            },
        ])
    })
})
