// 觀察分頁的飲食如廁（shifts.cats.<id>.intake）。值班表的滑桿與貓咪檔案的時間軸共用
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

// 一句話的片段：[{ text, warn }]，warn 是要標紅的（沒便、軟便、拉稀）
export function intakeParts(intake) {
    const parts = [];
    const eaten = (label, value) => {
        const text = INTAKE_MARKS[value] ?? `${value}%`;
        parts.push({ text: `${label}${text}`, warn: false });
    };
    if (intake.feed) eaten('乾乾', intake.feed_detail);
    if (intake.can) eaten('罐罐', intake.can_detail);
    parts.push({ text: intake.urine ? '有尿' : '沒尿', warn: false });
    if (!intake.feces) parts.push({ text: '沒便', warn: true });
    else {
        const warning = intake.feces_warning;
        parts.push({ text: warning && warning !== '正常' ? warning : '便正常', warn: !!warning && warning !== '正常' });
    }
    return parts;
}
