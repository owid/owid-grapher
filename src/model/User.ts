import {Entity, PrimaryGeneratedColumn, Column, BaseEntity} from "typeorm"
const hashers = require('node-django-hashers')

@Entity("users")
export default class User extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() name!: string
    @Column() email!: string
    @Column({ name: 'password' }) cryptedPassword!: string
    @Column({ name: 'full_name' }) fullName!: string
    @Column({ name: 'is_active' }) isActive: boolean = true
    @Column({ name: 'is_superuser' }) isSuperuser: boolean = false
    @Column() created_at!: Date
    @Column() updated_at!: Date

    async setPassword(password: string) {
        const h = new hashers.BCryptPasswordHasher()
        this.cryptedPassword = await h.encode(password)
    }
}