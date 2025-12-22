export const ShiftMap = (shift) => {
    const map = {
        morning: '早班',
        night: '晚班',
    }
    return map[shift] || shift
}