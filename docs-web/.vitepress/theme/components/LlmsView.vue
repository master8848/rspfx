<script setup lang="ts">
import { ref, onMounted } from 'vue'
import llmsRaw from '../../../public/llms.txt?raw'

const content = ref((llmsRaw as string) || '')
const copied = ref(false)
const failed = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  const text = content.value
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
    else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    copied.value = true
    failed.value = false
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    failed.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (failed.value = false), 2000)
  }
}

function openRaw() {
  window.open('/llms.txt', '_blank', 'noopener')
}

onMounted(async () => {
  // keep build-time import but try live fetch for freshness (e.g. dev)
  try {
    const res = await fetch('/llms.txt', { cache: 'no-cache' })
    if (res.ok) {
      const txt = await res.text()
      if (txt && txt.trim()) content.value = txt
    }
  } catch {}
})
</script>

<template>
  <div class="llms-view">
    <div class="llms-header">
      <div>
        <h1 class="llms-title">llms.txt</h1>
        <p class="llms-desc">
          LLM-friendly index of RSPFX docs — one file, every page with description. Paste into ChatGPT / Claude / Cursor. Raw at
          <a href="/llms.txt" target="_blank" rel="noopener">/llms.txt</a> (alias <a href="/llm.txt" target="_blank" rel="noopener">/llm.txt</a>).
        </p>
      </div>
      <div class="llms-actions">
        <button class="llms-btn primary" :class="{ copied, failed }" @click="copy">
          <svg v-if="!copied && !failed" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          <svg v-else-if="copied" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v6M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ copied ? 'Copied!' : failed ? 'Failed' : 'Copy' }}
        </button>
        <button class="llms-btn" @click="openRaw">Open raw</button>
        <a class="llms-btn" href="/llms.txt" download>Download</a>
      </div>
    </div>

    <div class="llms-pre-wrap">
      <button class="llms-copy-float" :class="{ copied }" @click="copy" :title="copied ? 'Copied!' : 'Copy'">
        <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <pre class="llms-pre"><code>{{ content }}</code></pre>
    </div>

    <p class="llms-foot">Spec: <a href="https://llmstxt.org" target="_blank" rel="noopener">llmstxt.org</a> — file at <code>/llms.txt</code> and <code>/llm.txt</code> for compatibility. Designed page at <code>/llms</code>.</p>
  </div>
</template>

<style scoped>
.llms-view { max-width: 100%; }
.llms-header {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.llms-title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.llms-desc {
  margin: 8px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.6;
  max-width: 640px;
}
.llms-desc a { color: var(--vp-c-brand-1); text-decoration: none; }
.llms-desc a:hover { text-decoration: underline; }
.llms-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.llms-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background .15s, border-color .15s, color .15s;
}
.llms-btn:hover { background: var(--vp-c-default-soft); border-color: color-mix(in srgb, var(--vp-c-brand-1) 22%, var(--vp-c-divider)); }
.llms-btn.primary { background: var(--vp-button-brand-bg); color: var(--vp-button-brand-text); border-color: transparent; }
.llms-btn.primary:hover { background: var(--vp-button-brand-hover-bg); }
.llms-btn.primary.copied { background: var(--vp-c-brand-1); }
.llms-btn.primary.failed { background: #ef4444; color: #fff; }
.llms-pre-wrap {
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}
.llms-copy-float {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
}
.llms-copy-float:hover { color: var(--vp-c-text-1); border-color: color-mix(in srgb, var(--vp-c-brand-1) 20%, var(--vp-c-divider)); }
.llms-copy-float.copied { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.llms-pre {
  margin: 0;
  padding: 20px;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--vp-c-text-1);
}
.llms-pre code { font-family: inherit; }
.llms-foot {
  margin-top: 12px;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
}
.llms-foot a { color: var(--vp-c-brand-1); }
.llms-foot code { font-size: 12px; padding: 2px 5px; border-radius: 6px; background: var(--vp-c-default-soft); border: 1px solid var(--vp-c-divider); }
</style>
