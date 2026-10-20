<script setup lang="ts">
// A confirmation in a native modal dialog: focus stays inside, the page behind is inert, Escape cancels.
// Focus starts on the safe choice. Leaving by button or backdrop fades out quickly; Escape, a keyboard action, at once.
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ title: string; text: string; confirm: string; cancel: string }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const dlg = ref<HTMLDialogElement>()
const closing = ref(false)

// Focus goes back to whatever opened the dialog, if it is still on the page.
let opener: HTMLElement | null = null
onMounted(() => {
  opener = document.activeElement as HTMLElement | null
  dlg.value!.showModal()
})
onBeforeUnmount(() => {
  if (dlg.value?.open) dlg.value.close()
  if (opener?.isConnected) opener.focus({ preventScroll: true })
})
function dismiss() {
  if (closing.value) return
  closing.value = true
  setTimeout(() => emit('cancel'), 140)
}
// A click on the dialog element itself is a click on the backdrop around the box.
function backdrop(e: MouseEvent) {
  if (e.target === dlg.value) dismiss()
}
</script>

<template>
  <dialog ref="dlg" class="confirm" :class="{ closing }" aria-labelledby="confirm-title" @cancel="emit('cancel')" @click="backdrop">
    <div class="box br">
      <h2 id="confirm-title">{{ title }}</h2>
      <p>{{ text }}</p>
      <div class="buttons">
        <button autofocus @click="dismiss">{{ cancel }}</button>
        <button class="go" @click="emit('confirm')">{{ confirm }}</button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.confirm { padding: 0; border: 0; background: transparent; color: inherit; max-width: none; overflow: visible; }
.confirm::backdrop { background: rgb(20 22 24 / 0.45); }
.box { width: min(420px, calc(100vw - 32px)); padding: 22px; border-top: 4px solid var(--accent); display: flex; flex-direction: column; gap: 12px; }
h2 { font: 700 20px/1.1 var(--font-display); }
p { margin: 0; }
.buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.go { background: var(--accent); color: var(--ink); border-color: var(--accent); text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
button { transition: transform 160ms var(--ease-out), color 160ms ease, background-color 160ms ease; }
button:active { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) { .go:hover { background: var(--tag); color: var(--accent); border-color: var(--tag); } }
/* In from slightly smaller, centred; out faster than in. */
.confirm[open] .box { animation: pop 220ms var(--ease-out) both; }
.confirm[open]::backdrop { animation: fade 220ms var(--ease-out) both; }
.closing[open] .box { animation: leave 140ms ease-out both; }
.closing[open]::backdrop { animation: fade 140ms ease-out reverse both; }
@keyframes pop { from { opacity: 0; transform: scale(0.96); } }
@keyframes leave { to { opacity: 0; transform: scale(0.98); } }
@keyframes fade { from { opacity: 0; } }
</style>
