export const ShiftMap = (shift) => {
    const map = {
        morning: '早班',
        night: '晚班',
    }
    return map[shift] || shift
}
// 行事曆的活動類型。唯一的真相來源是 pages/calendar.vue 的 typeList，
// 這裡是給 server 端組 LINE 訊息用的副本，新增類型時兩邊都要改。
export const CalendarTypeLabel = (type) => {
    const map = {
        volunteer: '體驗',
        supplies: '物資',
        dispatch: '出車',
        medicine: '領藥',
        viewing: '帶看',
        post: '社群',
        other: '其他',
    }
    return map[type] || type
}
