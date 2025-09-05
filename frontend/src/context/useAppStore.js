import { create } from 'zustand'
import { fetchDrones, fetchMissions } from '../services/api'

export const useAppStore = create((set, get) => ({
  loading: false,
  drones: [],
  missions: [],
  stats: { totalDrones: 0, inMission: 0, available: 0, completedMissions: 0 },

  loadInitial: async () => {
    set({ loading: true })
    try {
      const [drones, missions] = await Promise.all([fetchDrones(), fetchMissions()])
      set({ drones, missions })
      get().computeStats()
    } catch (e) {
      console.error('Failed to load data', e)
    } finally {
      set({ loading: false })
    }
  },

  computeStats: () => {
    const { drones, missions } = get()
    const totalDrones = drones.length
    const inMission = drones.filter(d => d.status === 'in-mission' || d.status === 'in-progress').length
    const available = drones.filter(d => d.status === 'available').length
    const completedMissions = missions.filter(m => m.status === 'completed').length
    set({ stats: { totalDrones, inMission, available, completedMissions } })
  }
}))
