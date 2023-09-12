import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm"

@Entity("origins")
export class Origin extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ type: "varchar", nullable: true }) title!: string | null
    @Column({ type: "varchar", nullable: true }) titleSnapshot!: string | null
    @Column({ type: "text", nullable: true }) datasetDescriptionOwid!:
        | string
        | null
    @Column({ type: "text", nullable: true }) description!: string | null
    @Column({ type: "varchar", nullable: true }) producer!: string | null
    @Column({ type: "varchar", nullable: true }) attribution!: string | null
    @Column({ type: "varchar", nullable: true }) attributionShort!:
        | string
        | null
    @Column({ type: "text", nullable: true }) citationFull!: string | null
    @Column({ type: "text", nullable: true }) urlMain!: string | null
    @Column({ type: "text", nullable: true }) urlDownload!: string | null
    @Column({ type: "date", nullable: true }) dateAccessed!: Date | null
    @Column({ type: "varchar", nullable: true }) datePublished!: string | null
    @Column({ type: "varchar", nullable: true }) versionProducer!: string | null
    // Note: there is an N:M relationship between origins and variables but
    // because variables is not a typeORM class but a knew class we don't
    // expose it here.
}
