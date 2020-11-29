#! /usr/bin/env jest

import fs from "fs-extra"

import { parseQueueContent, getDeploys } from "./queue"
import {
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
} from "../adminSiteServer/utils/node_modules/serverSettings"

describe(parseQueueContent, () => {
    it("parses newline delimited JSON objects", async () => {
        const output = parseQueueContent(
            [
                `{"authorName": "Tester", "message": "Updated chart test-chart-please-ignore"}`,
                `{"authorName": "Tester", "message": "something one"}`,
                ``, // empty line will be ignored
                `invalid json`, // invalid json will be ignored
                `{"authorName": "Tester", "message": "something two"}`,
            ].join("\n")
        )
        expect(output[0].authorName).toEqual("Tester")
        expect(output[0].message).toEqual(
            "Updated chart test-chart-please-ignore"
        )
        expect(output[1].message).toEqual("something one")
        expect(output[2].message).toEqual("something two")
    })
})

describe(getDeploys, () => {
    it("is empty when nothing is in the queues", async () => {
        jest.spyOn(fs, "readFile").mockImplementation(
            (async (): Promise<string> => {
                return ``
            }) as any
        )
        expect(await getDeploys()).toEqual([])
    })

    it("parses queued deploy file", async () => {
        jest.spyOn(fs, "readFile").mockImplementation(
            (async (path: string): Promise<string> => {
                if (path === DEPLOY_QUEUE_FILE_PATH)
                    return [
                        `{"message": "test1"}`,
                        `{"message": "test2"}`,
                    ].join("\n")
                if (path === DEPLOY_PENDING_FILE_PATH) return ``
                return ``
            }) as any
        )
        expect(await getDeploys()).toEqual([
            {
                status: "queued",
                changes: [{ message: "test2" }, { message: "test1" }],
            },
        ])
    })

    it("parses pending deploy file", async () => {
        jest.spyOn(fs, "pathExists").mockImplementation(async () => true)
        jest.spyOn(fs, "readFile").mockImplementation(
            (async (path: string): Promise<string> => {
                if (path === DEPLOY_QUEUE_FILE_PATH)
                    return [
                        `{"message": "test1"}`,
                        `{"message": "test2"}`,
                    ].join("\n")
                if (path === DEPLOY_PENDING_FILE_PATH)
                    return [
                        `{"message": "test3"}`,
                        `{"message": "test4"}`,
                    ].join("\n")
                return ``
            }) as any
        )

        expect(await getDeploys()).toEqual([
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
