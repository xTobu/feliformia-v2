// 中文輸入法選字時按的 Enter（還在組字）：不能當成「送出／加入」，不然字還沒進輸入框就被收掉了。
// Chrome 用 isComposing；Safari 組字結束那一下 isComposing 已經是 false，但 keyCode 還是 229
export const isImeEnter = (event) => event.isComposing || event.keyCode === 229;
