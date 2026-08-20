import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/problems', name: 'problems', component: () => import('../views/ProblemsView.vue') },
    { path: '/problem/:id', name: 'problem', component: () => import('../views/ProblemView.vue') },
    { path: '/submissions', name: 'submissions', component: () => import('../views/SubmissionsView.vue') },
    { path: '/submission/:id', name: 'submission', component: () => import('../views/SubmissionView.vue') },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue') },
    { path: '/user/:name', name: 'user', component: () => import('../views/UserView.vue') },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
    { path: '/admin/users', name: 'admin-users', component: () => import('../views/UserManagement.vue') },
    { path: '/contests', name: 'contests', component: () => import('../views/ContestsView.vue') },
    { path: '/contest/:id', name: 'contest', component: () => import('../views/ContestView.vue') },
    { path: '/discuss', name: 'discuss', component: () => import('../views/DiscussView.vue') },
    { path: '/discuss/:id', name: 'thread', component: () => import('../views/ThreadView.vue') },
    { path: '/rank', name: 'rank', component: () => import('../views/RankView.vue') },
    { path: '/admin/problem/new', name: 'problem-new', component: () => import('../views/ProblemEditorView.vue') },
    { path: '/admin/problem/:id', name: 'problem-edit', component: () => import('../views/ProblemEditorView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
