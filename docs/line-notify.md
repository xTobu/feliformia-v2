# LINE 活動提醒 — 設定與維護

讓「大哥」這個 LINE 官方帳號，在活動當天早上私訊提醒相關的志工。

---

## 1. 運作方式

```
志工加「大哥」好友
   ↓  follow 事件
大哥回覆使用說明
   ↓
志工私訊「我要綁定 你的信箱」（解除是「我要解除綁定」）
   ↓  message 事件（驗簽 → 用 email 對到 auth.users）
寫入 profiles.line_user_id
   ↓
每天 Vercel Cron 打 /api/calendar/remind
   ↓
撈當天的 calendar_events → 算出每筆的活動人員 → 私訊已綁定的人
```

沒綁定 LINE 的人收不到提醒。管理員在 [/admin/profiles](../pages/admin/profiles.vue) 看得到誰還沒綁。

---

## 2. 相關檔案

| 檔案 | 說明 |
|---|---|
| [server/utils/line.js](../server/utils/line.js) | 共用 client：驗簽、推播、回覆 |
| [server/api/line/webhook.post.js](../server/api/line/webhook.post.js) | 綁定／解除綁定 |
| [server/api/calendar/remind.get.js](../server/api/calendar/remind.get.js) | 每日提醒，由 Vercel Cron 觸發 |
| [server/api/calendar/notify.post.js](../server/api/calendar/notify.post.js) | 手動提醒，管理員挑日期與收件人 |
| [server/utils/calendar-message.js](../server/utils/calendar-message.js) | 摘要訊息組裝，兩支提醒端點共用 |
| [server/utils/roster.js](../server/utils/roster.js) | 從 `votes` 算值班名單（server 端版本） |
| [vercel.json](../vercel.json) | cron 排程 |
| [pages/settings.vue](../pages/settings.vue) | 志工看自己的綁定狀態、可自行解除 |
| [pages/admin/profiles.vue](../pages/admin/profiles.vue) | 管理員看全體綁定狀態、可代為解除 |

---

## 3. 環境變數

`.env` 與 **Vercel 的 Environment Variables 都要設**：

| 變數 | 哪裡拿 | 用途 |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE console → Messaging API | 推播（既有） |
| `LINE_CHANNEL_SECRET` | LINE console → Basic settings | **驗證 webhook 簽章** |
| `CRON_SECRET` | 自己產一串長亂數 | Vercel Cron 會自動帶成 `Authorization: Bearer` |

> 沒設 `LINE_CHANNEL_SECRET` 的話 webhook 會直接回 500；
> 沒設 `CRON_SECRET` 的話提醒端點會回 500。兩個都是刻意的，
> 少了任何一個都代表沒有身分驗證，不能讓它裸奔。

---

## 4. 資料庫

```sql
alter table public.profiles add column if not exists line_user_id text unique;
```

`unique` 是刻意的 —— 一個 LINE 帳號只能綁一位志工。要改綁必須先解除。

---

## 5. 加好友連結

```
https://lin.ee/8pI3YeW
```

寫在 [pages/settings.vue](../pages/settings.vue) 的 `LINE_ADD_FRIEND_URL`。
要重新取得或換一組：LINE Official Account Manager → 增加好友人數 → 加入好友指南，
那裡也有 QR code 可以印出來貼在貓屋。

---

## 6. LINE console 設定步驟

1. **Basic settings** → 複製 **Channel secret** → 設成 `LINE_CHANNEL_SECRET`
2. **Messaging API** → **Webhook URL** 填：
   ```
   https://feliformia.org/api/line/webhook
   ```
3. 打開 **Use webhook**
4. 按 **Verify** 確認回 200

> ⚠️ **先部署再開 webhook。** 端點還沒上線就打開，LINE 會一直打到 404。

### 回應設定（LINE Official Account Manager）

大哥目前在志工群組裡用**關鍵字自動回覆**。開啟 webhook **不會**影響它：

- 本專案的 webhook **只處理一對一私訊**，群組訊息直接忽略
- 私訊也只處理「我要綁定」「我要解除綁定」開頭的訊息，其他不回應、不消耗 replyToken

但 LINE Official Account Manager 的「回應設定」要自己確認一次，
webhook 與自動回應訊息可以並存，設定錯會讓關鍵字失效。

---

## 7. ⚠️ Vercel 的兩個坑

### 7.1 Firewall 可能擋掉 LINE 的請求

Vercel 專案若開了 Attack Challenge / Bot 防護，LINE 的 webhook 請求會被 challenge，
**綁定會完全失效，而且不會有任何錯誤提示** —— LINE 那邊只顯示 webhook 失敗。

部署後去 Vercel → Firewall 加一條規則，讓 `/api/line/webhook` 跳過挑戰。

### 7.2 Hobby 方案的 Cron 限制

- 每個專案最多 **2 個** cron
- **一天只能跑一次**
- **觸發時間不保證準時**，會落在指定的那個小時內

`vercel.json` 設的是 `0 22 * * *`（**UTC**）＝ 台灣時間隔天 **06:00**。
台灣是 UTC+8，所以要往回推 8 小時、跨到前一天。

實際可能 06:00–06:59 之間才發。每日提醒可以接受。

> 這個時間跟端點裡的 `dayjs().tz('Asia/Taipei')` 是一致的：
> UTC 22:00 觸發時，台灣已經是隔天早上 6 點，
> `today` 取到的就是「剛開始的那一天」，提醒的是當天的活動。

之後若要做「活動前一小時提醒」，Hobby 方案做不到，要改用 GitHub Actions
（專案裡已經有 `.github/workflows/keep_supabase_active.yml` 可以參考）。

---

## 8. 手動測試

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://feliformia.org/api/calendar/remind
```

回傳：

```json
{ "date": "2026-09-30", "events": 3, "notified": 2, "skipped": 1 }
```

- `events` — 當天有幾筆活動
- `notified` — 成功私訊幾個人
- `skipped` — 沒綁定 LINE、或推播失敗（對方封鎖大哥）的人數

> 時區用 `dayjs().tz('Asia/Taipei')` 換算。Vercel 跑在 UTC，
> 不換算的話台灣時間早上 8 點會抓到「前一天」的活動。

---

## 9. 兩支提醒端點的差別

| | `remind.get.js` | `notify.post.js` |
|---|---|---|
| 誰觸發 | Vercel Cron | 管理員按「立即提醒」 |
| 驗證 | `CRON_SECRET` | `requireAdmin()`（登入身分） |
| 日期 | 今天 | 管理員在行事曆選的那天 |
| 收件人 | 那天有活動的**所有**人 | 管理員從清單**勾選**的人 |
| 訊息 | 完全相同 —— 都是「【貓毛活動提醒】+ 日期 + 活動清單」 | 同左 |

**不能合併成一支。** `CRON_SECRET` 一旦放進前端就等於公開，
任何人都能觸發推播。所以手動那支必須走登入驗證。

訊息本體由 `buildDigest()` 統一組裝，**兩邊格式完全相同** ——
志工不會因為來源不同而困惑。

`notify` 刻意**從資料庫撈活動內容**，不信任前端傳來的 body ——
否則有人改 request body 就能用系統名義發任意訊息。

### 操作方式

在 `/calendar` 選一天，活動列表下方會出現「提醒這天的人員」（管理員限定）。
點開後列出那天有活動的人，顯示各自有幾筆，**未綁定 LINE 的不可勾選**。
**預設都不選**，避免手滑整批發出去。

---

## 10. 已知限制

- **綁定只靠 email 比對** —— 知道某位志工的信箱就能把自己的 LINE 綁上去，
  收到那個人的提醒。貓屋是小團體，目前接受這個風險；
  補救方式是本人在 `/settings`、管理員在 `/admin/profiles` 都看得到並能解除。
  要收緊的話可以改成「網站產生一次性驗證碼，私訊時一起附上」。
- **一天只提醒一次**，內容是「今天有什麼事」。沒有「前一天預告」或「活動前 N 小時」。
- **沒有群組總覽**。第一版只做個人私訊。
  （`/regular`、`/medicine` 的手動群組推播是另一回事，維持原樣沒動）
- **沒有記錄發送次數**。重複按「立即提醒」會重複發，只靠確認框擋。
  之後要防的話可以加 `calendar_events.last_notified_at`。
