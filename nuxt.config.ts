// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: false,
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
      title: 'BetterSEQTA+',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { 
          hid: 'description', 
          name: 'description', 
          content: 'BetterSEQTA+ is a social messaging and cloud sync platform designed to enhance your school experience.' 
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
  nitro: {
    // Enable file serving
    storage: {
      fs: {
        driver: 'fs',
        base: './data'
      }
    },
    // Configure route handling
    routeRules: {
      '/api/files/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    }
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  }
})
