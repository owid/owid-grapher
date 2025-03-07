import bcrypt from "bcryptjs"

export class BCryptHasher {
    private algorithm = "bcrypt"
    saltRounds = 12 // only exposed for testing, where we use fewer rounds for faster tests

    async encode(password: string): Promise<string> {
        const key = await bcrypt.hash(password, this.saltRounds)
        return `${this.algorithm}$${key}`
    }

    async verify(password: string, hashToken: string): Promise<boolean> {
        const hashPassword = hashToken.substring(
            this.algorithm.length + 1,
            hashToken.length
        )
        return await bcrypt.compare(password, hashPassword)
    }
}
