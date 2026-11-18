// 管理後台的頁面清單：/admin 首頁與 header「後台」選單共用，新增後台頁只要改這裡。
// 2026-11-17 起只放新版：貓咪在最前面，再來照值班紀錄分頁的順序（觀察 → 醫療 → 飲食），最後志工一覽、投票選項管理。
// 舊版的貓咪管理（/admin/cats）、餵藥及特殊飲食管理（/admin/notices）從選單拿掉了，頁面還在。
// 值班收尾管理（/admin/required）2026-11-12 收起來了：值班表拿掉收尾分頁，頁面與設定留著，之後要恢復再加回來
export const ADMIN_SECTIONS = [
    {
        title: '',
        links: [
            { to: '/admin/cat-profiles', icon: '🐱', title: '貓咪管理', desc: '新增、編輯、排序貓咪與位置' },
            { to: '/admin/observe', icon: '📷', title: '觀察管理', desc: '剛到拍剩食、貓砂，離開拍留餐、長期放風' },
            { to: '/admin/medical', icon: '💊', title: '醫療管理', desc: '醫療、餵藥、外用、隨餐藥與其他' },
            { to: '/admin/diet', icon: '🍚', title: '飲食管理', desc: '乾乾、罐罐、補充品與其他飲食' },
            { to: '/admin/profiles', icon: '👥', title: '志工一覽', desc: '查看志工名單、編輯名稱與權限' },
            { to: '/admin/vote-options', icon: '🗳️', title: '投票選項管理', desc: '新增、編輯、排序投票選項' },
        ],
    },
];
