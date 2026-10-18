import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

const TABS = ['arrive', 'care', 'meds', 'leave', 'required']

// 新增一則留言。只新增、不覆蓋，多人同時留言不會互相蓋掉
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const { shiftId, catId, tab, body, forNext } = await readBody(event)
    const text = (body || '').trim()
    if (!shiftId || !catId || !TABS.includes(tab) || !text) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    // 留言當下的暱稱另外存一份：之後改暱稱，舊留言還是顯示當時的名字
    const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .maybeSingle()

    const { data, error } = await supabase
        .from('shift_comments')
        .insert({
            shift_id: shiftId,
            cat_id: catId,
            tab,
            body: text,
            for_next: !!forNext,
            author_name: profile?.nickname || null,
            created_by: userId,
        })
        .select('id, shift_id, cat_id, tab, body, for_next, author_name, created_at')
        .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data
})
