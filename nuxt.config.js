export default defineNuxtConfig({
  devtools: { enabled: true },

  typescript: {
    typeCheck: false,
    strict: false,
  },

  modules: [
    '@nuxtjs/supabase',
  ],

  supabase: {
    redirect: false,
  },

  css: [
    'element-plus/dist/index.css',
  ],

  runtimeConfig: {
    public: {
      releaseDate: process.env.RELEASE_DATE,
      deploySite: process.env.DEPLOY_SITE,
    },
  },

  app: {
    head: {
      titleTemplate: '%s | Feliformia',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1.0' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Noto+Sans+TC:400,500,700&display=swap' },
      ],
    },
  },

  compatibilityDate: '2024-12-22',
});