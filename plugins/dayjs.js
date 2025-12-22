import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

export default defineNuxtPlugin(() => {
    dayjs.extend(utc)
    dayjs.extend(timezone)
    dayjs.locale('zh-tw')
    dayjs.tz.setDefault('Asia/Taipei')

    return {
        provide: {
            dayjs
        }
    }
})