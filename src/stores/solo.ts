import { defineStore } from 'pinia'
import { useQueensGame } from '../composables/useQueensGame'
export const useSoloGameStore = defineStore('soloGame', () => useQueensGame())
