import { describe, expect, it } from "vitest"
import { BCryptHasher } from "./hashers.js"

describe(BCryptHasher, () => {
    it("should encode a password", async () => {
        const hasher = new BCryptHasher()
        hasher.saltRounds = 4 // for faster tests
        const password = "password"
        const hash = await hasher.encode(password)
        expect(hash).toContain("bcrypt")
    })

    it("should verify a hashed password", async () => {
        const hasher = new BCryptHasher()
        hasher.saltRounds = 4 // for faster tests
        const password = "password"
        const hash = await hasher.encode(password)
        const result = await hasher.verify(password, hash)
        expect(result).toBe(true)
    })

    it("should verify a pre-hashed password", async () => {
        const hasher = new BCryptHasher()
        const password = "password"
        const hashedPasswords =
            // hashes for "password"
            [
                "bcrypt$$2b$12$TF65ro5CW6A5Ai2qvVOSsO9h/rZbYMI19kX2CLV/7F5VeeHZkTJaC",
                "bcrypt$$2b$04$JlvbPo81NHviVoeMv1DVTu0QmhB9K21jnaaYgMC.qShgQ0uyhfR.S",
            ]

        for (const hashedPassword of hashedPasswords) {
            const result = await hasher.verify(password, hashedPassword)
            expect(result).toBe(true)
        }
    })

    it("should not verify a wrong password", async () => {
        const hasher = new BCryptHasher()
        const password = "wrongPassword"
        const hashedPassword =
            "bcrypt$$2b$12$TF65ro5CW6A5Ai2qvVOSsO9h/rZbYMI19kX2CLV/7F5VeeHZkTJaC" // hash for "password"
        const result = await hasher.verify(password, hashedPassword)
        expect(result).toBe(false)
    })
})
