export const UsersXImagesTableName = "users_x_images"

export interface DbInsertUsersXImages {
    createdAt?: Date
    imageId: number
    userId: number
}

export type DbRawUsersXImages = Required<DbInsertUsersXImages>
