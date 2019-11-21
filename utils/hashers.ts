import * as bcrypt from "bcrypt"

export class BCryptHasher {
    algorithm = "bcrypt"
    iterations = 12

    async salt(): Promise<string> {
        return bcrypt.genSalt(this.iterations)
    }

    async encode(password: string): Promise<string> {
        const salt = await this.salt()
        const key = await bcrypt.hash(password, salt)
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
