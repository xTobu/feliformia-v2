import Swal from 'sweetalert2';

// 全站 SweetAlert 的預設按鈕文字：沒指定的「OK」「Cancel」改成中文。
// 各頁都是 import Swal 直接呼叫 Swal.fire，在這裡包一層就全部套到（樣子在 assets/css/sweetalert.css）
export default defineNuxtPlugin(() => {
    const fire = Swal.fire.bind(Swal);
    Swal.fire = (...args) => {
        if (args.length === 1 && args[0] && typeof args[0] === 'object') {
            return fire({ confirmButtonText: '好', cancelButtonText: '取消', ...args[0] });
        }
        return fire(...args);
    };
});
