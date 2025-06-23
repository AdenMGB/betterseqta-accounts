<script setup>
import { useRouter, useRoute } from 'vue-router'
import { ref, onMounted } from 'vue'

const router = useRouter()
const route = useRoute()
const error = ref(null)

onMounted(() => {
  const token = route.query.token
  if (token) {
    localStorage.setItem('token', token)
    router.replace('/')
  } else {
    error.value = 'No token received from Discord login.'
  }
})
</script>

<template>
  <div>
    <p v-if="error" class="text-red-500">{{ error }}</p>
    <p v-else>Logging you in with Discord...</p>
  </div>
</template> 