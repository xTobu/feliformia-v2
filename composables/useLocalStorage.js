/**
 * localStorage 統一管理
 * - 自動加上前綴避免 key 衝突
 * - SSR 安全
 * - 統一錯誤處理
 */

const PREFIX = 'feliformia_';

export const useLocalStorage = () => {
    // 取得值
    const get = (key, defaultValue = null) => {
        if (import.meta.server) return defaultValue;

        try {
            const item = localStorage.getItem(PREFIX + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn(`[localStorage] 讀取 ${key} 失敗:`, e);
            return defaultValue;
        }
    };

    // 設定值
    const set = (key, value) => {
        if (import.meta.server) return;

        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.warn(`[localStorage] 儲存 ${key} 失敗:`, e);
        }
    };

    // 移除值
    const remove = (key) => {
        if (import.meta.server) return;

        try {
            localStorage.removeItem(PREFIX + key);
        } catch (e) {
            console.warn(`[localStorage] 移除 ${key} 失敗:`, e);
        }
    };

    return { get, set, remove };
};