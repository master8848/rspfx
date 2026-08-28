import { ref, computed } from 'vue'

const PREF_KEY = 'rspfx-copy-preference'
export type Pref = 'humanized' | 'markdown'

const copyPreference = ref<Pref>('humanized')
const isHumanized = computed(() => copyPreference.value === 'humanized')

export function useCopyPreference() {
  function loadPref() {
    try {
      const v = localStorage.getItem(PREF_KEY)
      if (v === 'markdown' || v === 'humanized') copyPreference.value = v
    } catch {}
  }

  function savePref(p: Pref) {
    copyPreference.value = p
    try {
      localStorage.setItem(PREF_KEY, p)
    } catch {}
  }

  return { copyPreference, isHumanized, loadPref, savePref }
}
