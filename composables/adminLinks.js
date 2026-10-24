// 管理後台的頁面清單：/admin 首頁與 header「後台」選單共用，新增後台頁只要改這裡。
// 新版區塊：貓咪在最前面，其他照值班記錄表分頁的順序（觀察 → 醫療 → 備餐 → 收尾）
export const ADMIN_SECTIONS = [
    {
        title: '',
        links: [
            { to: '/admin/cats', icon: '🐱', title: '貓咪管理', desc: '新增、編輯、排序貓咪資料' },
            { to: '/admin/notices', icon: '📋', title: '餵藥及特殊飲食管理', desc: '新增、編輯、排序特殊照護事項' },
            { to: '/admin/vote-options', icon: '🗳️', title: '投票選項管理', desc: '新增、編輯、排序投票選項' },
            { to: '/admin/profiles', icon: '👥', title: '志工一覽', desc: '查看志工名單、編輯名稱與權限' },
        ],
    },
    {
        // 新版：跟上面的舊版並行，資料表各自獨立（cat_profiles、diet_items…），讓大家慢慢換過來
        title: '新版值班記錄（試行中）',
        links: [
            { to: '/admin/cat-profiles', icon: '🐱', title: '貓咪管理', desc: '新增、編輯、排序貓咪與位置' },
            { to: '/admin/observe', icon: '📷', title: '觀察管理', desc: '剛到班時要拍的剩食、貓砂' },
            { to: '/admin/medical', icon: '💊', title: '醫療管理', desc: '吃藥、醫療與其他照護事項' },
            { to: '/admin/diet', icon: '🍚', title: '飲食管理', desc: '乾乾、罐罐、補充與其他飲食' },
            { to: '/admin/required', icon: '✅', title: '值班收尾管理', desc: '每一班離開前一定要勾完的事' },
        ],
    },
];
