// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/motion/nuxt',
    '@nuxt/image',
    'motion-v/nuxt'
  ],
  app: {
    head: {
      title: 'SAB - Student Advisory Body',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { 
          hid: 'description', 
          name: 'description', 
          content: 'Student Advisory Body (SAB) - Empowering student voices across Catholic schools in South Australia' 
        }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    },
    pageTransition: { name: 'page', mode: 'out-in' }
  },
  typescript: {
    strict: true,
    typeCheck: true,
    shim: false
  },
  css: ['~/assets/css/main.css'],
  vite: {
    server: {
      allowedHosts: [
        'smb.adenmgb.com',
        'localhost',
        '127.0.0.1'
      ]
    }
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  }
})
