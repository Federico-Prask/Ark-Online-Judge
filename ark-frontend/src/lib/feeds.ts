import { ref } from 'vue'
import { fetchContests, fetchDiscussions, fetchUserRank, type ContestPub, type RankEntry, type ThreadPub } from './api'

export const homeContests = ref<ContestPub[]>([])
export const homeThreads = ref<ThreadPub[]>([])
export const homeAnnounce = ref<ThreadPub[]>([])
export const homeRank = ref<RankEntry[]>([])

export async function loadHomeFeeds() {
  const [c, t, r] = await Promise.all([
    fetchContests().catch(() => [] as ContestPub[]),
    fetchDiscussions().catch(() => [] as ThreadPub[]),
    fetchUserRank().catch(() => [] as RankEntry[]),
  ])
  homeContests.value = c.slice(0, 2)
  homeThreads.value = t.slice(0, 3)
  homeAnnounce.value = t.filter((x) => x.category === 'announce').slice(0, 3)
  homeRank.value = r.slice(0, 3)
}
