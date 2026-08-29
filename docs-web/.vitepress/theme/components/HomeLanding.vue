<script setup lang="ts">
// Full landing sections as Vite (Vue SFC) — use this instead of raw HTML in index.md
// when customizing the VitePress theme feels limiting.
// In index.md: replace the <div class="rspfx-..."> blocks with <HomeLanding />
// or keep markdown and just import this for the compare table.
// No extra deps — plain Vue + Tabler-style inline SVGs (MIT).
</script>

<template>
  <div class="rspfx-home-landing">
    <!-- Proof bar -->
    <div class="rspfx-proof">
      <div class="rspfx-proof-inner">
        <span class="rspfx-proof-item"><strong>1.20 – 1.24</strong> SPFx targets</span>
        <span class="rspfx-proof-sep" aria-hidden="true">·</span>
        <span class="rspfx-proof-item"><strong>0 deps</strong> core</span>
        <span class="rspfx-proof-sep" aria-hidden="true">·</span>
        <span class="rspfx-proof-item"><strong>Vite · Rsbuild · Rspack</strong></span>
        <span class="rspfx-proof-sep" aria-hidden="true">·</span>
        <span class="rspfx-proof-item"><strong>1 line</strong> <code>spfxVersion</code> switch</span>
      </div>
    </div>

    <!-- How it compares — component table guarantees full-width on home (no markdown width quirk) -->
    <div class="rspfx-compare">
      <h2>How it compares</h2>
      <div class="rspfx-compare-table">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Official toolchain (Heft / gulp)</th>
              <th>RSPFx</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bundler</td>
              <td>webpack only</td>
              <td>Vite (default), Rsbuild, Rspack</td>
            </tr>
            <tr>
              <td>Frameworks</td>
              <td>React, vanilla</td>
              <td>React, Vue, Svelte, Solid, Preact + custom presets</td>
            </tr>
            <tr>
              <td>SPFx switch</td>
              <td>new project / pin updates</td>
              <td>one line <code>spfxVersion</code> + package manager update</td>
            </tr>
            <tr>
              <td>Dev server</td>
              <td><code>gulp serve</code> :4321</td>
              <td><code>rspfx dev</code> :4321 — tenant optional</td>
            </tr>
            <tr>
              <td>Package manager</td>
              <td>npm / yarn / pnpm</td>
              <td>npm · pnpm · yarn · bun · deno</td>
            </tr>
            <tr>
              <td>Config required</td>
              <td>rig + gulpfile required</td>
              <td>zero-config from <code>config/config.json</code> + manifests</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tip -->
    <div class="rspfx-tip">
      <span class="rspfx-tip-kicker">Before first dev</span>
      Run <code>rspfx doctor</code> — it checks Node version, cert trust, port conflicts and missing manifests in one pass.
    </div>
  </div>
</template>

<style scoped>
.rspfx-home-landing {
  /* ensures sections inside VPHome markdown break out to full width */
  width: 100%;
}
</style>
