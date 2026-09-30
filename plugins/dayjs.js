import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import updateLocale from 'dayjs/plugin/updateLocale'

export default defineNuxtPlugin(() => {
    dayjs.extend(utc)
    dayjs.extend(timezone)
    dayjs.extend(updateLocale)
    dayjs.locale('zh-tw')
    dayjs.tz.setDefault('Asia/Taipei')

    // 週一為一週之始（el-calendar 依此排版，值班投票也是週一起算）
    dayjs.updateLocale('zh-tw', { weekStart: 1 })

    return {
        provide: {
            dayjs
        }
    }
})
