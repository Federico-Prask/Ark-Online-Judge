<script setup lang="ts">
import { onMounted } from 'vue'
import HeroSection from '../components/HeroSection.vue'
import AxisLine from '../components/AxisLine.vue'
import GuestCards from '../components/GuestCards.vue'
import UserCards from '../components/UserCards.vue'
import { loggedIn } from '../lib/session'
import { loadProblems, loadSubs } from '../lib/api'
import { loadHomeFeeds } from '../lib/feeds'

onMounted(() => {
  void loadProblems()
  void loadSubs()
  void loadHomeFeeds()
})
</script>

<template>
  <HeroSection />
  <AxisLine />
  <GuestCards v-if="!loggedIn" />
  <UserCards v-else />
</template>
