<script>
  export let description = 'Hello from svelte';

  const features = ['Rspack-powered builds', 'Manifest generation', 'SPFx-compatible output', 'No webpack, no gulp'];
</script>

<div class="hello-card">
  <h2 class="hello-title">{description}</h2>
  <ul class="hello-list">
    {#each features as feature}
      <li>{feature}</li>
    {/each}
  </ul>
</div>

<style>
  .hello-card {
    max-width: 480px;
    margin: 24px auto;
    padding: 24px;
    border: 1px solid #e1dfdd;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    font-family: 'Segoe UI', sans-serif;
  }

  .hello-title {
    margin: 0 0 12px 0;
    color: #323130;
    font-size: 20px;
  }

  .hello-list {
    margin: 0;
    padding-left: 20px;
    color: #605e5c;
    line-height: 1.8;
  }
</style>
