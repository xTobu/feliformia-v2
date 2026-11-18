// 即時同步一律用 Supabase Broadcast（不用 Postgres Changes）：誰存檔成功，誰就在頻道上發一則訊息，
// 其他開著同一頁的人直接套用，不用等資料庫通知、也不用重新抓資料。
// 頻道都是私人的（private: true），只有登入的人能收發（資料庫 realtime.messages 的 policy，見 care_system migration）。
// 自己發的自己不會收到（self: false），所以存檔的人要自己先更新畫面。
//
// 斷線重連、手機從背景回來（離開超過 30 秒）時會呼叫 onResync，讓頁面重新抓一次資料，補上中間漏掉的訊息
const RESYNC_AFTER_HIDDEN_MS = 30 * 1000;

export function useBroadcast() {
    const supabase = useSupabaseClient();

    const channelOptions = { config: { private: true, broadcast: { self: false } } };

    // 訂閱：handlers 是 { 事件名稱: (payload) => {} }。回傳 { channel, leave }
    function join(topic, handlers, { onResync } = {}) {
        const channel = supabase.channel(topic, channelOptions);
        for (const [event, handler] of Object.entries(handlers)) {
            channel.on('broadcast', { event }, ({ payload }) => handler(payload));
        }

        let joinedOnce = false;
        let hiddenAt = null;
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now();
            } else if (hiddenAt && Date.now() - hiddenAt > RESYNC_AFTER_HIDDEN_MS) {
                hiddenAt = null;
                onResync?.();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        // 私人頻道要帶登入者的 token
        supabase.realtime
            .setAuth()
            .catch((e) => console.warn('realtime setAuth failed:', e))
            .finally(() =>
                channel.subscribe((status) => {
                    if (status !== 'SUBSCRIBED') return;
                    // 第一次連上不用補；之後再連上代表中間斷過
                    if (joinedOnce) onResync?.();
                    joinedOnce = true;
                })
            );

        return {
            channel,
            leave() {
                document.removeEventListener('visibilitychange', onVisibility);
                supabase.removeChannel(channel);
            },
        };
    }

    // 發送：有已經訂閱的同一個頻道就直接送；沒有（例如補傳照片到別班）就開一個臨時頻道走 REST 送
    async function send(topic, event, payload, joined = null) {
        try {
            if (joined && joined.channel.subTopic === topic) {
                await joined.channel.send({ type: 'broadcast', event, payload });
                return;
            }
            await supabase.realtime.setAuth();
            const channel = supabase.channel(topic, channelOptions);
            try {
                await channel.httpSend(event, payload);
            } finally {
                supabase.removeChannel(channel);
            }
        } catch (e) {
            // 廣播失敗不影響已經存好的資料，別人下次重新整理或重連時會補上
            console.warn(`broadcast ${topic} ${event} failed:`, e);
        }
    }

    return { join, send };
}
