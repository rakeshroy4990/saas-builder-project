<script setup lang="ts"></script>

<template>
  <span class="saas-busy-dots" aria-hidden="true">
    <span class="saas-busy-dots__dot" />
    <span class="saas-busy-dots__dot" />
    <span class="saas-busy-dots__dot" />
  </span>
</template>

<style scoped>
.saas-busy-dots {
  display: inline-flex;
  align-items: center;
  gap: 0.2em;
  vertical-align: middle;
}

.saas-busy-dots__dot {
  width: 0.28em;
  height: 0.28em;
  border-radius: 50%;
  background: currentColor;
  animation: saas-busy-dots-bounce 0.9s ease-in-out infinite both;
}

.saas-busy-dots__dot:nth-child(1) {
  animation-delay: 0s;
}

.saas-busy-dots__dot:nth-child(2) {
  animation-delay: 0.15s;
}

.saas-busy-dots__dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes saas-busy-dots-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.65);
    opacity: 0.45;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
