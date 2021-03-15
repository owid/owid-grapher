import * as bcrypt from "bcrypt"

export class BCryptHasher {
    private algorithm = "bcrypt"
    private iterations = 12

    private async salt() {
        return bcrypt.genSalt(this.iterations)
    }

    async encode(password: string) {
        const salt = await this.salt()
        const key = await bcrypt.hash(password, salt)
        return `${this.algorithm}$${key}`
    }

    async verify(password: string, hashToken: string) {
        const hashPassword = hashToken.substring(
            this.algorithm.length + 1,
            hashToken.length
        )
        return await bcrypt.compare(password, hashPassword)
    }
}
