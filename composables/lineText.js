// LINE 推播的文字規則，server（真的發）與畫面（算還能附幾張照片）共用
// LINE 一則文字最多 5000 字、一次推播最多 5 則訊息
export const LINE_TEXT_MAX = 5000
export const LINE_MESSAGES_MAX = 5

// 長文字切成好幾則，盡量從換行切（不切在一句話中間）；單行就超過上限的才硬切
export function splitText(text, max = LINE_TEXT_MAX) {
    const chunks = []
    let rest = text
    while (rest.length > max) {
        let cut = rest.lastIndexOf('\n', max)
        if (cut <= 0) cut = max
        chunks.push(rest.slice(0, cut))
        rest = rest.slice(cut).replace(/^\n/, '')
    }
    if (rest) chunks.push(rest)
    return chunks
}
