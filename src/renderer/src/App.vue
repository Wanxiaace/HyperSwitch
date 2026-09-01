<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
import OnboardingOverlay from '@/components/OnboardingOverlay.vue'
import TitleBar from '@/components/TitleBar.vue'
import ToastHost from '@/components/ToastHost.vue'
</script>

<template>
  <div class="app-shell">
    <TitleBar />
    <ToastHost />
    <div class="app-body">
      <AppSidebar />
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </router-view>
      </main>
    </div>
    <OnboardingOverlay />
  </div>
</template>
