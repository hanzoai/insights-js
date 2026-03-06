<template>
  <div>
    <h1>Welcome to the About Page</h1>
    <p>This is the about page of our Nuxt 3 application.</p>
    <nuxt-link to="/">
      <button>Go to Index Page</button>
    </nuxt-link>
  </div>
</template>

<script setup lang="ts">
  const { $insights } = useNuxtApp();
  if ($insights) {
    const insights = $insights()
    insights?.capture('<event_name>')
  }
</script>
