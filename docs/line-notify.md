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
每天 Supabase pg_cron 打 /api/calendar/remind
   ↓
撈當天的 calendar_events → 算出每筆的活動人員 → 私訊已綁定的人
```

沒綁定 LINE 的人收不到提醒。管理員在 [/admin/profiles](../pages/admin/profiles.vue) 看得到誰還沒綁。

---

## 2. 相關檔案

| 檔案 | 說明 |
|---|---|
| [server/utils/line.js](../server/utils/line.js) | 共用 client：驗簽、推播、回覆 |
| [server/api/line/webhook.post.js](../server/api/line/webhook.post.js) | 綁定／解除綁定／選單／查今天的活動 |
| [server/utils/calendar-today.js](../server/utils/calendar-today.js) | 「某人某天有份的活動」，網站彈窗與大哥共用 |
| [server/api/calendar/remind.get.js](../server/api/calendar/remind.get.js) | 每日提醒，由 Supabase pg_cron 觸發 |
| [server/api/calendar/notify.post.js](../server/api/calendar/notify.post.js) | 手動提醒，管理員挑日期與收件人 |
| [server/utils/calendar-message.js](../server/utils/calendar-message.js) | 摘要訊息組裝，兩支提醒端點共用 |
| [server/utils/roster.js](../server/utils/roster.js) | 從 `votes` 算值班名單（server 端版本） |
| [pages/settings.vue](../pages/settings.vue) | 志工看自己的綁定狀態、可自行解除 |
| [pages/admin/profiles.vue](../pages/admin/profiles.vue) | 管理員看全體綁定狀態、可代為解除 |

---

## 3. 環境變數

`.env` 與 **Vercel 的 Environment Variables 都要設**：

| 變數 | 哪裡拿 | 用途 |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE console → Messaging API | 推播（既有） |
| `LINE_CHANNEL_SECRET` | LINE console → Basic settings | **驗證 webhook 簽章** |
| `CRON_SECRET` | 自己產一串長亂數 | 排程打提醒端點時帶的 `Authorization: Bearer` |

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

## 6.1 大哥聽得懂的關鍵字

**只有這幾個會觸發回應，其他訊息一律不理** —— 交給 LINE Official Account
Manager 設定的自動回覆。常數都在 [webhook.post.js](../server/api/line/webhook.post.js) 最上方。

| 傳什麼 | 比對方式 | 做什麼 |
|---|---|---|
| `大哥我要問` | 完全相同 | 回選單，內容依有沒有綁定而不同 |
| `我的活動提醒` | 完全相同 | 回自己今天的活動，格式與早上八點那則相同 |
| `我要綁定 {信箱}` | 開頭相符 | 綁定 |
| `我要解除綁定` | 開頭相符 | 解除綁定 |
| `1` / `2` | 完全相同 | 選單的數字快捷（未綁定一律回選單） |

> ⚠️ **新增關鍵字前先確認 LINE 後台沒設過同樣的詞**，否則使用者會收到兩則
> 回覆 —— 一則是我們的，一則是內建自動回覆。這也是只收完整「大哥我要問」、
> 不收「大哥」的原因。

> ⚠️ 解除綁定的判斷要排在綁定前面。兩個都以「我要」開頭，用的又是開頭相符，
> 順序顛倒的話「我要解除綁定」會被當成綁定、把「解除綁定」當信箱。

**選單依綁定狀態不同** —— 還沒綁的人只能綁定，所以直接把用法寫出來不列選單；
綁好的人才看得到「我的活動提醒」和「我要解除綁定」。

---

## 7. ⚠️ 兩個容易踩的坑

### 7.1 Firewall 可能擋掉 LINE 的請求

Vercel 專案若開了 Attack Challenge / Bot 防護，LINE 的 webhook 請求會被 challenge，
**綁定會完全失效，而且不會有任何錯誤提示** —— LINE 那邊只顯示 webhook 失敗。

部署後去 Vercel → Firewall 加一條規則，讓 `/api/line/webhook` 跳過挑戰。

### 7.2 排程跑在 Supabase，不是 Vercel

**排程設定不在 repo 裡**，是跑在 production Supabase 專案的資料庫裡
（`pg_cron` + `pg_net`）。改時間要進 Supabase SQL Editor，不是改這份程式碼。

一開始是用 Vercel Cron，但 **Hobby 方案只保證「在指定的那個小時內」觸發**，
設 06:00 實際會 06:00–06:59 之間才發。pg_cron 是分鐘級準時，而且不吃 Vercel 方案限制。

目前排程：**`0 0 * * *`（UTC）＝ 台灣時間 08:00**。
pg_cron 在 Supabase 上以 UTC 判斷時間，台灣是 UTC+8，所以要往回推 8 小時。

設定 SQL（在 production 專案跑一次就好，**不要在測試站跑**，會重複發訊息）：

```sql
-- 兩個 extension：pg_cron 排程、pg_net 從資料庫發 HTTP
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
    'calendar-daily-remind',
    '0 0 * * *',                      -- UTC 00:00 = 台灣 08:00
    $$
    select net.http_get(
        url := 'https://feliformia.org/api/calendar/remind',
        headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (
                select decrypted_secret from vault.decrypted_secrets
                where name = 'cron_secret'
            )
        ),
        timeout_milliseconds := 60000  -- 預設 5 秒，推播人多會不夠
    );
    $$
);
```

`CRON_SECRET` 放在 Supabase Vault，不要寫死在排程裡 ——
`cron.job` 這張表只要能連資料庫就看得到：

```sql
select vault.create_secret('<CRON_SECRET>', 'cron_secret', 'calendar remind endpoint');
```

**改時間**用同一個 job 名稱重跑 `cron.schedule` 就會覆蓋；**停掉**是
`select cron.unschedule('calendar-daily-remind');`。

#### 怎麼確認它真的跑了

pg_net 是非同步的 —— `net.http_get()` 只負責把請求排進佇列就回傳，
所以 **`cron.job_run_details` 一定顯示成功**，就算 API 回 401 也一樣。
要看真正的結果得查 pg_net 的回應表：

```sql
-- 排程有沒有被觸發
select jobid, status, start_time from cron.job_run_details
order by start_time desc limit 10;

-- API 實際回了什麼（只保留最近幾小時）
select status_code, content, created from net._http_response
order by created desc limit 10;
```

`status_code` 要是 **200**。看到 401 就是 secret 不對，看到 404 就是網址錯了。

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

> 時區用 `dayjs().tz('Asia/Taipei')` 換算。Vercel 的 function 跑在 UTC，
> 不換算的話半夜的排程會抓到「前一天」的活動。
> 現在排在台灣 08:00（UTC 00:00）這個瞬間兩邊日期剛好相同，
> 但換算要留著 —— 之後把時間往前挪就會踩到。

---

## 9. 兩支提醒端點的差別

| | `remind.get.js` | `notify.post.js` |
|---|---|---|
| 誰觸發 | Supabase pg_cron | 管理員按「立即提醒」 |
| 驗證 | `CRON_SECRET` | `requireAdmin()`（登入身分） |
| 日期 | 今天 | 管理員在行事曆選的那天 |
| 收件人 | 那天有活動的**所有**人 | 管理員從清單**勾選**的人 |
| 訊息 | 完全相同 —— 都是「標題 + 日期 + 活動清單」 | 同左 |

**不能合併成一支。** `CRON_SECRET` 一旦放進前端就等於公開，
任何人都能觸發推播。所以手動那支必須走登入驗證。

訊息本體由 `buildDigest()` 統一組裝，**兩邊格式完全相同** ——
志工不會因為來源不同而困惑。長相是：

```
🔔 貓毛活動 10/01(四)

09:00 ~ 09:15
[體驗] 測試排程

14:00 ~ 15:00
[出車] 載貓咪去板橋的醫院回診

19:00 ~ 20:00
[領藥] 小橘要領藥
```

每筆活動刻意拆成兩行、中間空一行：**LINE 的純文字長行會自己折返，
而且折回來那行不會縮排**，全部塞一行的話內容一長就會跟下一筆糊在一起。
時間自己一行、永遠不會折；內容折了也不影響辨識，因為區塊之間有空行。

標題與日期**刻意併成一行** —— LINE 的推播通知只預覽訊息開頭，
併起來志工在鎖定畫面就看得到「是什麼、哪一天」。
標題字串抽成 `TITLE_PREFIX` 常數，要改文案改一個地方就好。

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
