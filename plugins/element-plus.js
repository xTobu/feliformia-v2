import ElementPlus from 'element-plus'
import zhTw from 'element-plus/es/locale/lang/zh-tw'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(ElementPlus, {
    locale: zhTw,
  })
})