# Database Schema

## Tables

### profiles
用戶資料表

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK, 對應 auth.users |
| nickname | TEXT | 顯示名稱 |
| is_admin | BOOLEAN | 是否為管理員，預設 FALSE |
| is_active | BOOLEAN | 是否啟用，預設 TRUE。**`false` 會被 `requireUser()` 擋掉**，所有 API 都進不去（見下方「API 端點權限」） |
| line_user_id | TEXT | UNIQUE，LINE 的 userId。靠 webhook 綁定取得，用來發活動提醒（見 [line-notify.md](line-notify.md)） |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

---

### vote_options
投票選項設定

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| name | TEXT | 選項名稱（醫療、灌食、值班、快閃/協助）。**行事曆只把「值班」「快閃/協助」當成值班人員** —— 名單寫死在 `pages/calendar.vue` 與 `server/utils/roster.js` 的 `DUTY_OPTION_NAMES`，改名會讓它失效 |
| has_time_range | BOOLEAN | 是否需要時間區間（醫療需要） |
| is_exclusive | BOOLEAN | 是否排他（目前未使用） |
| sort_order | INTEGER | 排序 |
| is_active | BOOLEAN | 是否啟用 |

---

### votes
投票記錄

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | 流水號 |
| user_id | UUID | FK → auth.users |
| week_start | DATE | 該週週一日期 |
| is_pass | BOOLEAN | 本週是否 Pass |
| data | JSONB | 投票資料（結構見下方） |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

**PK**: (user_id, week_start)

> `votes` **沒有** nickname 欄位。要顯示投票者名字得用 `user_id` 對 `/api/users/list`
> （`/vote` 的 `getNickname()`、`/calendar` 的 `userMap` 都是這樣做）。

#### data JSONB 結構

```
votes.data
├── [date: "2025-12-22"]
│   ├── morning
│   │   └── [option_id]
│   │       ├── checked: boolean
│   │       ├── time_start?: string  (has_time_range 才有)
│   │       └── time_end?: string
│   └── night
│       └── [option_id]
│           ├── checked: boolean
│           ├── time_start?: string
│           └── time_end?: string
└── [date: "2025-12-23"]
    └── ...
```

範例：

```json
{
  "2025-12-22": {
    "morning": {
      "uuid-option-1": {
        "checked": true,
        "time_start": "09:00",
        "time_end": "10:00"
      }
    },
    "night": {
      "uuid-option-2": {
        "checked": true
      }
    }
  }
}
```

---

### calendar_events
行事曆（`/calendar`）

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| date | DATE | 活動日期 |
| time_start | TEXT | 開始時間 'HH:mm'，15 分鐘刻度 |
| time_end | TEXT | 結束時間 'HH:mm'，不做防呆 |
| type | TEXT | 類型 key，見 `pages/calendar.vue` 的 typeList（**沒有** CHECK 約束） |
| notify_roles | JSONB | `['morning','night','owner']` 的子集合 |
| owners | JSONB | profiles.id 的陣列（可多人），僅 notify_roles 含 'owner' 時才有值 |
| content | TEXT | 備註內容，必填 |
| created_by | UUID | FK → auth.users |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |
| deleted_at | TIMESTAMPTZ | 軟刪除時間，NULL 表示未刪除 |
| deleted_by | UUID | FK → auth.users，誰刪的 |

**軟刪除**：所有查詢都帶 `.is('deleted_at', null)`，不做實體 DELETE。

**早晚班人員不存在這張表**，依 `date` 對到 `votes` 即時計算（見 `pages/calendar.vue` 的 `roster()`）。
存一份會跟投票結果不同步。

建表 SQL：[docs/sql/calendar_events.sql](sql/calendar_events.sql)

---

### notices
餵藥及特殊飲食事項（`/admin/notices` 管理）

| Column | Type | Description |
|--------|------|-------------|
| id | — | PK |
| name | TEXT | 貓咪名字 |
| treatment | TEXT | 事項，必填 |
| reason | TEXT | 原因，可 NULL |
| shift | TEXT | `morning` / `night` / `both` |
| order | INTEGER | 排序（後台拖拉） |
| start_date | DATE | 療程開始日，NULL 代表不限 |
| end_date | DATE | 療程結束日（含當天），NULL 代表不限 |

**`medicines.cats` 是快照，不是參照。** 某個 date + shift 的紀錄**第一次被打開**時，
`server/api/medicine/index.get.js` 才會把當下符合班別、期間的事項整份複製進去，
之後就不再跟 `notices` 同步。所以修改事項內容或期間，**已經被打開過的班別不會跟著變**，
從下一個還沒建立的班別開始才會生效。

過了 `end_date` 的事項不會自動刪除，後台會標成「已結束」，改期間就能重新使用。

---

## 新版值班系統（試行中）

跟上面的 `cats`、`notices`、`medicines`、`regulars` **並行**，資料各自獨立、不互通，讓大家慢慢換過來。
建表在 `supabase/migrations/*_care_system.sql`，位置清單在 `composables/locations.js`
（資料庫有 check 擋，兩邊要一起改）。

飲食、醫療、收尾三張項目表都有 `photos`（觀察不用）：附圖（最多 6 張），存公開 bucket `care-item-photos` 的大圖路徑
（`<表名>/<uuid>.jpg`，縮圖同名加 `_thumb`）。後台編輯項目時上傳（`/api/care-items/upload-url`，拿掉或刪除項目時
`/api/care-items/remove-photos` 刪檔）；值班表直接讀項目表的 `photos`（快照裡只有項目 id），後台換了照片馬上看得到。

| 表 | 頁面 | 說明 |
|---|---|---|
| `cat_profiles` | `/admin/cat-profiles` | 貓咪。`id` 沿用舊 `cats` 的 id（一次性複製）；`location` 只能是客廳／房間／倉庫／隔離區；排序 `sort_order`。頭像 `avatar_path`（Storage 公開 bucket `avatars`；原圖 `avatar_source_path` 與框的範圍 `avatar_crop` 留著，點頭像可以重新調整位置），花色 `coats`（可多選，預設清單之外可以「＋ 其他」自己打）、`sex`、`neutered`（null＝不確定）、`coat_length`、入住日期 `arrived_on`、生日 `birthday`（預估，可以選到日）、領養 `adopted`＋到新家日期 `adopted_on`（已領養但不知道哪天就是 null；沒領養不能有日期）、`notes`；選項在 `composables/catTraits.js` |
| `diet_items` | `/admin/diet` | 飲食。`category` 乾乾／罐罐／隨餐藥／補充品／放風／其他，`content`。只有隨餐藥（拌進飯裡、放碗就可以走）要在備餐分頁打勾。放風＝長期固定放風，內容選填：期間內的班，沒人按過放風的貓 `released` 照它打開（見下方「shifts 的快照與局部更新」） |
| `medical_items` | `/admin/medical` | 醫療。`category` 醫療／餵藥／外用，`treatment`、`reason`；都在醫療分頁打勾 |
| `required_items` | `/admin/required` | 值班收尾：這一班離開前一定要勾完的清單。`content`；對象可選貓、全員、**貓屋**或位置，每項都整班勾一次 |
| `observe_items` | `/admin/observe` | 觀察管理：值班時要拍的照片，分兩組——剛到（拍剩食／拍貓砂，觀察分頁提醒）、離開（拍留餐，備餐分頁提醒）。`content` 是說明（選填）。**不用打勾**：這一班、這隻貓、那個分頁的照片（照片庫裡的，含留言附的）有對應類型（拍剩食→剩食、拍貓砂→貓砂、拍留餐→留餐）就算拍了，規則在 `composables/observeItems.js`，前端與 server 共用 |
| `cat_health_records` | `/cats/[id]` 小檔案 | 醫療紀錄：類型 `kind` 單選——看診 visit／急診 emergency／回診 revisit／貓屋處理 house（資料庫有 check）；項目 `items` 可多選——預設 血檢、結紮、預防針、快篩、晶片、洗牙、拔牙、驅蟲、除蚤、吐血、血便、傷口（醫院做的在前、症狀在最後），或志工按「＋ 其他」自己加的標籤（存那幾個字，加過的之後所有貓都會出現在選項裡，`/api/cats/health/items`）；清單在 `composables/healthKinds.js`。每筆至少一個項目（列表上項目就是標題，例如「血檢、結紮」）。另有 `date`、`note`（描述）、陪同者 `companions`（名字陣列：有效志工名單列成膠囊點選，名單上沒有的按「＋ 其他」打字加入）、最後編輯者 `updated_by`／`updated_by_name`（新增時就是建立的人，照片的增減也算編輯）。所有登入的人可讀，新增、修改、刪除只有管理員，走 `server/api/cats/health*`（service key，沒有寫入 policy）。小檔案的驅蟲、預防針卡片算有勾那個項目的紀錄（次數與日期），結紮卡有勾結紮的紀錄就顯示已結紮與日期（沒有才看 `cat_profiles.neutered`）；卡片上的日期點了會捲到那筆紀錄，管理員按驅蟲、預防針卡片右上的「＋」新增一筆（預先帶好那個項目：驅蟲是貓屋處理，預防針是看診）。入住日、估計年齡、外觀、結紮卡片管理員點了打開編輯貓咪 |
| `cat_health_photos` | `/cats/[id]` 小檔案 | 醫療紀錄的照片（一筆最多 10 張），`uploader_name` 是上傳者當下的暱稱（看大圖時顯示）。檔案在 Storage 私人 bucket `cat-health`（`<貓 id>/` 底下），上傳與看圖同值班照片（server 發一次性上傳網址／有時效網址，手機先壓縮）；刪紀錄或拿掉照片時 API 連檔案一起刪 |
| `shifts` | `/shift` | 值班記錄，一班一筆（unique date + shift）。`reports` 是每個分頁、每個人各自的回報 |
| `profiles.avatar_path` | `/settings` | 志工頭像（`avatars` bucket，公開）。另外留原圖 `avatar_source_path`（最長邊 1600px）與框的範圍 `avatar_crop`（`{ left, top, width, height }`，原圖上的像素），點頭像可以重新調整位置、點相機換照片（貓的頭像同一套）。上傳走 `/api/avatar/upload-url` → 直傳 Storage → `/api/avatar/save`（換頭像會刪舊檔）；留言頻道會顯示 |
| `shift_comments` | `/shift` | 留言頻道：一隻貓、一個分頁一個頻道，跨班往上看（`/api/shift/comments/channel`，班與班之間有分隔線）。可以附照片、只附照片時 `body` 是空字串。作者本人可以編輯（`edited_at`，顯示「已編輯」）與刪除（附的照片連 Storage 檔一起刪）。可以搜尋（`/api/shift/comments/search`，這個頻道所有的班）。`for_next` 是「重要」：整則橘底；下一班的 💬 旁有橘點（只維持一班） |
| `shift_photos` | `/shift` | 每隻貓、每個分頁的照片。檔案在 Storage 私人 bucket `shift-photos`，永久保留；`note` 是描述，`kinds` 是類型（選填、可多選，照片庫上方可以篩選；觀察 剩食／貓砂｜嘔吐／血跡／毛髮皮膚／其他（剩食、貓砂是「剛到要拍」那兩種，畫面上自成一組），醫療 傷口／皮膚／眼耳口鼻／治療／用藥／其他，備餐 留餐｜乾乾／罐罐／加藥／其他（留餐是「離開要拍」的那種），清單在 `composables/photoKinds.js`）。🗂️ 照片庫 = 這隻貓、這個分頁的所有照片：`comment_id` 空的是直接上傳的，有值的是留言附的（縮圖標 💬，看大圖顯示那則留言、可以跳過去；只能改類型，描述與刪除跟著留言）。照班分組往上看：打開時這一班加前 4 班，往上再 5 班（`/api/shift/photos/history`）。留言頻道標題列的「留言／照片」切換到照片庫。`upload_batch` 是同一次上傳共用的 id：留言頻道裡把直接上傳的照片顯示成「誰上傳了幾張照片到照片庫」，一次上傳一筆（沒有 id 的舊照片一張一筆） |

**三張事項表的共同欄位**：`shift` 是 `morning` / `night` / `both`，`start_date` / `end_date` 空代表不限。
三張都有對象：`cat_id` 有值 = 那隻貓；`location` 有值 = 那個位置；兩個都空 = 全員
（不能同時有值）。收尾的 `location` 多一個「貓屋」（整間屋子、跟貓無關的事，例如倒垃圾）。
後台與值班表的排序都是：貓咪 → 全員 → 貓屋 → 位置（`composables/locations.js` 的 `placeRank`）。
刪掉一隻貓會連帶刪掉牠的事項與留言（on delete cascade），不會變成全員。

**權限**：全部登入可讀。`cat_profiles` 與三張事項表只有管理員能寫（`is_admin()`，前端後台直接寫）；
`shifts`、`shift_comments` 沒有寫入 policy，一律走 `server/api/shift/*`（service key）。

### 貓咪檔案

`/cats` 是貓咪清單（照位置分區，已領養的另一區），`/cats/[id]` 是一隻貓的檔案；值班記錄表卡片上的貓名也連過去。志工都能看，管理員的「編輯」在這頁直接打開編輯視窗（`components/CatProfileDialog.vue`，跟後台貓咪管理共用，含刪除），存好留在原頁。
頁首是頭像（位置貼在頭像下緣）、性別符號、名字（暱稱接在後面），名字下面是「關於我」（`notes` 一行一點，每點前面一個 ❣️；編輯貓咪時一點一列，可以新增、刪除、拖拉排序）。兩個分頁，記在網址路徑：日常是 `/cats/<id>`，小檔案是 `/cats/<id>/profile`（`pages/cats/[id]/[[tab]].vue`，兩頁之間切換不重新載入，上一頁、下一頁會跟著切）：

- **日常**（時間軸，`/api/cats/timeline`）：一班一段、新的在前，一次往前 7 天。篩選一排：左邊日期鈕（點開有全部／近 3／7／30 天快選與自訂起訖），右邊篩選鈕（點開列出內容：值班（飲食如廁、放風）／未完成／留言／照片，與留言與照片：觀察／醫療／備餐（收尾很少有留言，不列、一直顯示），只篩留言和照片，值班整塊不受影響；可複選）。點日期列到值班記錄表那一班（`/shift?date=&shift=`）。篩選與日期記在這台裝置（localStorage `feliformia_cat_profile_filters`，每隻貓共用；快選記天數、每次照當天重算）。一班分三區，各有小標；留言、照片沒有也顯示「留言 0」「照片 0」，篩選關掉的區才不出現：
  - 值班：那一班快照裡這隻貓的 `intake`，顯示成乾乾／罐罐／尿／便四格（沒便、軟便、拉稀標紅；有人登記就顯示四格（前班放風也一樣）；沒登記的，上一班放風寫「不用登記」、其他寫「沒有登記」；`composables/intake.js`）。小標旁一直顯示「前班放風」（剛到時貓已在外面）與「本班放風」（這班走時放出來）兩個標籤，有放綠底、沒放灰色虛線框，
    以及**未完成**（淡橘底；醫療的分頁標籤用紫色，避開橘與紅）：規則同值班表的「前班未完成」（`unfinishedOf`），只留這隻貓自己的——醫療、隨餐藥、觀察管理（全員／位置的觀察項目也算）、對象是這隻貓的收尾。
    還在進行的班（今天的晚班；今天的早班在晚班開之前）標「進行中」，未完成照樣列（看得到還剩哪些事）
  - 留言：四個分頁的，照分頁分組（觀察→醫療→備餐→收尾，每組上面一個分頁色標籤、後面一條細線）；附的照片在氣泡下面放小縮圖（48px），點了看大圖
  - 照片：照片庫的（直接上傳的與留言附的，留言附的縮圖右下角有小泡泡、看大圖顯示那則留言），一樣照分頁分組
- **小檔案**：「基本資料」是入住日、估計年齡（`composables/catTraits.js`）、外觀（性別毛長花色）、結紮，以及驅蟲、預防針（從醫療紀錄算幾次、列日期）。「醫療紀錄」是 `cat_health_records` 新的在前（照年份分段，同一天合成一張卡：左邊日期方塊，右邊一筆一段——項目當標題，下面類型用有色圖示＋字、陪同者、描述、照片，右下角最後編輯者）；管理員按 ＋ 或筆在原頁打開 `components/CatHealthDialog.vue` 新增、編輯、刪除（類型單選、項目多選、「＋ 其他」加標籤）。

### shifts 的快照與局部更新

`cats`、`tasks` 是這一班的快照，存成**以 id 為 key 的物件**（不是陣列），結構見 `server/utils/shift.js` 開頭。
當天（台灣時間）的班每次載入都用後台最新設定重建，再把已填的資料併回去（`syncWithSettings`）；過去的班保持當時的樣子。
上一班離開時放風的貓，這一班記 `prev_released: true`（貓沒關籠，觀察分頁不用登記吃喝排泄）。
這個值記在這一班自己身上：當天的班每次載入會照上一班現在的記錄重算，有變才寫回（`persistReleased`）；有人按放風時，`/api/shift/update` 也會把下一班（已經開了的話）那隻貓的 `prev_released` 一起改掉，過了午夜補按或改過去的班也對得上。
備餐的放風 `released`：有人按過就記 `released_set: true`（`update.post.js` 自動加），之後照人選的；
沒人按過的，當天（含之後）的班照飲食的「放風」項目算，每次載入重算、有變才寫回（後台加刪項目，已開的班也會跟著變）。

醫療、吃藥、收尾打勾時記下 `done_by`（登入者暱稱）與 `done_at`，畫面顯示「✓ 阿明 21:40」。
值班記錄表的分頁是 觀察、醫療、備餐、收尾（`arrive` / `care` / `meal` / `required`），記在網址路徑：觀察是 `/shift`，其他是 `/shift/care`、`/shift/meal`、`/shift/required`（`pages/shift/[[tab]].vue`）；哪一班在 `?date=&shift=`。舊連結的 `?tab=`（含更舊的 meds、leave）會自動換成路徑。
`reports` 是 `{ 分頁: { user_id: { name, text, at } } }`：每個分頁、每個人各一段，用登入身分（沒有「填表志工」）。
每個人只能改自己那一段，名字與時間由 server 填（`server/api/shift/update.post.js`）。
下一班在**同一個分頁**上方看到上一班的回報（`components/ShiftReportBlock.vue`，可摺疊，這台裝置會記住），
以及上一班那個分頁沒勾完的項目（觀察：沒拍的觀察項目，看那一班的觀察照片；醫療：醫療／餵藥／外用；備餐：隨餐藥；收尾），一項一行、對象用小標籤（`unfinishedOf`）。每個分頁的「LINE 發送至群組」只發那個分頁、這一班所有人的回報（標作者），不合在一起。舊格式的回報放在 `legacy` 底下，顯示為「（舊資料）」。

**照片**：觀察、醫療、備餐分頁貓名旁的 🗂️ 打開下方面板（各分頁的照片分開）。選好照片先預覽、每張可寫描述再上傳；上傳後描述可在縮圖下修改（`/api/shift/photos/update`）。手機上傳前自動壓縮（`composables/useImageCompress.js`：
大圖最長邊 1600px 約 300KB、縮圖 400px），用 server 發的一次性上傳網址直接傳到 Storage（不經過 Vercel 的 4.5MB 上限），
再 `POST /api/shift/photos` 記一筆；看照片用 server 發的有時效網址（12 小時）。只有上傳的人或管理員能刪（`/api/shift/photos/delete`，可一次傳多個 id，面板的「選取」模式用）。

存檔不是整筆覆寫：前端每改一格只送那一格（例如 `cats.12.medical.5`、`reports.care.<user_id>`），
`/api/shift/update` 呼叫資料庫函式 `shift_apply` 套用，同一班的請求會排隊。
**兩個人同時改不同的貓或項目不會互相覆蓋**；同一格才是後存的贏。
`shift_apply` 只開放給 service_role，前端不能直接呼叫。

---

## Realtime

即時同步一律改用 **Broadcast**（`composables/useBroadcast.js`），不再用 Postgres Changes：
存檔成功的人在頻道上發訊息，其他開著同一頁的人直接套用；斷線重連、手機從背景回來超過 30 秒時重新抓一次資料補漏。
頻道都是私人的，只有登入的人能收發（`realtime.messages` 上的 policy，見 `care_system` migration）。

| 頻道 | 事件 | 誰在聽 |
|---|---|---|
| `shift:<shifts.id>` | `ops`（`/api/shift/update` 回傳處理過的 ops）、`comment`（upsert／delete／refresh）、`photo`（🗂️ 照片庫 upsert／delete；留言附的照片跟著 `comment` 事件重抓） | `/shift` 開著那一班的人；`/cats/[id]` 聽進行中的班（今天的，最多兩班），收到就重抓那一天 |
| `comments:<cat_id>:<tab>` | `message`（upsert／delete） | 開著那隻貓、那個分頁留言頻道的人；`/cats/[id]` 聽這隻貓四個分頁，收到就重抓那一天，新留言看得到就閃一下、看不到就頂端「↑ N 則新留言」 |

舊頁面還在用 Postgres Changes、待改成 Broadcast 的表（改完就從 publication 拿掉）：
- `votes` - 讓多用戶即時看到彼此的投票
- `calendar_events` - 讓多用戶即時看到彼此的行事曆異動
- `medicines`、`regulars` - 舊版餵藥與例行紀錄的即時同步

（現在都由 `supabase/migrations/` 管理，下面的 SQL 只是參考）

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
```

> 注意：`calendar_events` 是軟刪除，所以刪除在 Realtime 眼中是 UPDATE 不是 DELETE，訂閱要聽 `*`。

---

## RLS Policies

### votes
- SELECT: 所有登入用戶可讀取所有投票
- INSERT/UPDATE: 只能操作自己的投票 (`auth.uid() = user_id`)
- DELETE: 只能刪除自己的投票

### profiles
- SELECT: 所有登入用戶可讀取
- INSERT/UPDATE: 只能操作自己的資料

### vote_options
- SELECT: 所有登入用戶可讀取
- INSERT/UPDATE/DELETE: 僅管理員（或關閉）

### calendar_events
- SELECT: 所有登入用戶可讀取（給 Realtime 訂閱用）
- INSERT/UPDATE/DELETE: 無 policy。寫入一律走 server API，用 service key 繞過 RLS

---

## API 端點權限

Server API 用 **service key** 連 Supabase，**會繞過上面所有 RLS**。
所以每一支端點都必須自己驗身分 —— RLS 擋不住它們。

驗證 helper 在 [server/utils/auth.js](../server/utils/auth.js)：

| helper | 擋什麼 | 回傳 |
|---|---|---|
| `requireUser(event)` | 沒登入 → 401；`is_active = false` → 403 | user id（`user.sub`） |
| `requireAdmin(event)` | 同上，再加不是管理員 → 403 | user id |

兩個 helper 共用內部的 `authenticate()`，所以**不管呼叫哪一個，
`profiles` 都只查一次** —— 每支 API 固定一次 round-trip，不會疊加。

`is_active` 只在**明確是 `false`** 時才擋。欄位是 `null`、或 `profiles`
整列不存在都放行：早期的 row 沒有這個欄位，當成停用會讓老帳號全部進不來。

前端 `middleware/auth.js` 與 `middleware/admin.js` 也會查同一個欄位
（走 `useProfile().ensureActive()`），停用的人直接登出並導到
`/login?inactive=1` 顯示原因。**那是體驗層，不是安全層** ——
真正的防線是上面兩個 server helper，中介層只是避免使用者看到一連串 403。

> ⚠️ `serverSupabaseUser()` 回的是 **JWT claims**，使用者 id 在 `user.sub`
> **不是** `user.id`。要寫 `updated_by` 之類的欄位時用 helper 的回傳值就對了。

### 現況

| 端點 | 權限 |
|---|---|
| `calendar/list`、`calendar/today` | `requireUser` |
| `calendar/update`、`calendar/delete`、`calendar/notify` | `requireAdmin` |
| `calendar/remind` | `CRON_SECRET`（排程專用，見 line-notify.md） |
| `line/webhook` | LINE 簽章驗證 |
| `line/message/push` | `requireUser` |
| `users/list`、`volunteer/list` | `requireUser` |
| `admin/profiles` | `requireAdmin` |
| `medicine/*`、`regular/*` | `requireUser` |
| `mind/list` | `requireUser` |
| `auth/verify-answer` | **刻意公開** —— 登入前的問答關卡，此時還沒有身分 |

**新增端點時預設加 `requireUser`**，確定要公開才例外，並在程式碼裡註明理由。

> `medicine/index` 與 `regular/index` 雖然是 GET，但查不到當天記錄時會
> 順手 INSERT 一筆。它們不是唯讀的，別因為是 GET 就以為不用擋。
