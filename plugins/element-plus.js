import ElementPlus from 'element-plus'
import zhTw from 'element-plus/es/locale/lang/zh-tw'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(ElementPlus, {
    locale: zhTw,
  })

  if (import.meta.client) placeViewerCloseOnImage()
})

// Element Plus 的看大圖（el-image 的 preview）把 ✕ 固定在畫面右上角，照片置中時離照片很遠。
// 這裡把 ✕ 移到照片上方、對齊照片右緣（跟 components/PhotoViewer.vue 一樣）：看大圖打開、換張、縮放、旋轉、視窗大小改變時都重新對位，
// 最多貼齊畫面邊緣 8px（照片放很大時就停在畫面右上角）。全站的看大圖都會套用
const GAP = 8

function placeViewerCloseOnImage() {
  const seen = new WeakSet()
  new MutationObserver(() => {
    document.querySelectorAll('.el-image-viewer__wrapper').forEach((wrapper) => {
      if (seen.has(wrapper)) return
      seen.add(wrapper)
      watchViewer(wrapper)
    })
  }).observe(document.body, { childList: true, subtree: true })
}

function place(wrapper) {
  const button = wrapper.querySelector('.el-image-viewer__close')
  // 只有目前這張是顯示的（其他張 v-show 藏起來）
  const img = [...wrapper.querySelectorAll('.el-image-viewer__canvas img')].find((el) => el.offsetParent)
  if (!button || !img) return
  const rect = img.getBoundingClientRect()
  if (!rect.width) return
  const size = button.offsetWidth || 40
  const left = `${Math.min(Math.max(rect.right - size, GAP), window.innerWidth - size - GAP)}px`
  const top = `${Math.min(Math.max(rect.top - size - GAP, GAP), window.innerHeight - size - GAP)}px`
  // 一樣就不寫，免得自己的修改又觸發觀察、一直重算
  if (button.style.left === left && button.style.top === top) return
  Object.assign(button.style, { left, top, right: 'auto' })
}

function watchViewer(wrapper) {
  let frame = 0
  const observer = new MutationObserver(() => schedule())
  const schedule = () => {
    // 關掉看大圖後就不用再管
    if (!wrapper.isConnected) {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      return
    }
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => place(wrapper))
  }
  // 換張、縮放、旋轉都會改 img 的 style 或換掉 img
  observer.observe(wrapper, { subtree: true, attributes: true, attributeFilter: ['style', 'src'], childList: true })
  wrapper.addEventListener('load', schedule, true)
  wrapper.addEventListener('transitionend', schedule, true)
  window.addEventListener('resize', schedule)
  schedule()
}
