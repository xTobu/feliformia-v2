// 觀察分頁的飲食如廁（shifts.cats.<id>.intake）。值班表的滑桿與貓咪檔案的日常共用
export const INTAKE_MARKS = {
    0: '沒吃',
    25: '吃1/3',
    50: '吃1/2',
    75: '吃2/3',
    100: '吃光',
};

// 到班時還沒填的樣子（跟 server/utils/shift.js 的 defaultIntake 一樣）
const DEFAULT_INTAKE = {
    feed: true,
    feed_detail: 0,
    can: false,
    can_detail: 0,
    urine: false,
    feces: false,
    feces_warning: null,
};

// 有沒有人動過（還是到班時的樣子就是沒登記）
export const isIntakeTouched = (intake) =>
    !!intake && Object.keys(DEFAULT_INTAKE).some((key) => (intake[key] ?? null) !== DEFAULT_INTAKE[key]);

// 貓咪檔案的四格：乾乾、罐罐、尿、便，位置固定（班與班上下對得齊）。
// 乾乾、罐罐沒勾＝這班沒放，顯示「沒勾」（淡色，empty）；warn 是要標紅的（有放但沒吃、沒尿、沒便、軟便、拉稀）
const EATEN = { 0: '沒吃', 25: '1/3', 50: '1/2', 75: '2/3', 100: '吃光' };
export function intakeCells(intake) {
    const eaten = (given, value) => (given ? (EATEN[value] ?? `${value}%`) : '沒勾');
    const notEaten = (given, value) => !!given && !value;
    const warning = intake.feces ? intake.feces_warning || '正常' : '沒有';
    return [
        { label: '乾乾', value: eaten(intake.feed, intake.feed_detail), empty: !intake.feed, warn: notEaten(intake.feed, intake.feed_detail) },
        { label: '罐罐', value: eaten(intake.can, intake.can_detail), empty: !intake.can, warn: notEaten(intake.can, intake.can_detail) },
        { label: '尿', value: intake.urine ? '有' : '沒有', warn: !intake.urine },
        { label: '便', value: warning, warn: warning !== '正常' },
    ];
}
