import { supabase } from '~/server/utils/supabase'
import { requireAdmin, requireUser } from '~/server/utils/auth'

// 頭像（Storage 的 avatars bucket，公開）。志工的記在 profiles.avatar_path，貓的記在 cat_profiles.avatar_path。
// 檔案放在 users/<user id>/ 或 cats/<cat id>/ 底下，換頭像會刪掉舊檔
export const AVATAR_BUCKET = 'avatars'
export const avatarStorage = () => supabase.storage.from(AVATAR_BUCKET)

// target：'me'（自己）或 'cat'（貓，只有管理員）。回傳要改哪張表的哪一筆、檔案放哪個資料夾
export async function resolveAvatarTarget(event, { target, catId }) {
    if (target === 'me') {
        const userId = await requireUser(event)
        return { table: 'profiles', id: userId, prefix: `users/${userId}/` }
    }
    if (target === 'cat') {
        await requireAdmin(event)
        const id = Number(catId)
        if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, message: '資料格式錯誤' })
        return { table: 'cat_profiles', id, prefix: `cats/${id}/` }
    }
    throw createError({ statusCode: 400, message: '資料格式錯誤' })
}
