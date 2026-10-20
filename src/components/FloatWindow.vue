<script lang="ts">
// Shared by every floating window: where each was last dropped, the windows open (Escape closes the one holding
// the focus, else the latest), and the stacking order (a window comes to the front when touched).
const lastPos = new Map<string, { x: number; y: number }>()
const openSheets: HTMLElement[] = []
let topZ = 15
</script>

<script setup lang="ts">
// A floating window dragged by its header. The parent wraps it in <Transition name="paper"> to bring it in from
// slightly smaller; it stays on screen, comes back where it was left, and Escape closes it at once.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useGameStore } from '../stores/game'

const props = defineProps<{ id: string; label: string; width: number; labelledby: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useGameStore()

const sheet = ref<HTMLElement>()
const pos = ref({ x: 0, y: 0 })
const z = ref(++topZ)
const dragging = ref(false)
let drag: { id: number; dx: number; dy: number } | null = null
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v))
function place(x: number, y: number) {
  const el = sheet.value!
  pos.value = { x: clamp(x, 8, innerWidth - el.offsetWidth - 8), y: clamp(y, 8, innerHeight - el.offsetHeight - 8) }
}
// The header captures the pointer; a second finger is ignored; buttons in the header stay buttons.
function grab(e: PointerEvent) {
  if (drag || e.button !== 0 || (e.target as HTMLElement).closest('button')) return
  drag = { id: e.pointerId, dx: e.clientX - pos.value.x, dy: e.clientY - pos.value.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragging.value = true
}
function move(e: PointerEvent) {
  if (drag?.id === e.pointerId) place(e.clientX - drag.dx, e.clientY - drag.dy)
}
function drop(e: PointerEvent) {
  if (drag?.id !== e.pointerId) return
  drag = null
  dragging.value = false
  lastPos.set(props.id, { ...pos.value })
}
const refit = () => place(pos.value.x, pos.value.y)
const raise = () => { if (z.value !== topZ) z.value = ++topZ }

// Closing from the keyboard skips the exit animation.
const instant = ref(false)
function close(fromKeyboard: boolean) {
  instant.value = fromKeyboard
  emit('close')
}
function onKey(e: KeyboardEvent) {
  // Escape belongs to a crisis or a modal dialog when one is open.
  if (e.key !== 'Escape' || store.game?.crisis || document.querySelector('dialog[open]')) return
  const active = document.activeElement
  const focused = openSheets.find((s) => s.contains(active))
  if (focused ? focused === sheet.value : openSheets[openSheets.length - 1] === sheet.value) close(true)
}

let opener: HTMLElement | null = null
onMounted(() => {
  opener = document.activeElement as HTMLElement | null
  const el = sheet.value!
  openSheets.push(el)
  const last = lastPos.get(props.id)
  if (last) place(last.x, last.y)
  else place((innerWidth - el.offsetWidth) / 2, Math.max(24, (innerHeight - el.offsetHeight) / 3))
  el.focus({ preventScroll: true })
  addEventListener('resize', refit)
  addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  openSheets.splice(openSheets.indexOf(sheet.value!), 1)
  removeEventListener('resize', refit)
  removeEventListener('keydown', onKey)
  if (opener?.isConnected) opener.focus({ preventScroll: true })
})
</script>

<template>
  <div class="float" :class="{ dragging, instant }" :style="{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, zIndex: z }" @pointerdown.capture="raise">
    <section ref="sheet" class="sheet br" role="dialog" :aria-labelledby="labelledby" tabindex="-1" :style="{ width: `min(${width}px, calc(100vw - 16px))` }">
      <header class="handle" title="Glisser pour déplacer" @pointerdown="grab" @pointermove="move" @pointerup="drop" @pointercancel="drop">
        <div class="bar">
          <span class="label"><span aria-hidden="true">⠿</span> {{ label }}</span>
          <span class="tools"><slot name="tools" /><button class="close" :aria-label="`Fermer : ${label}`" @click="close(false)">✕</button></span>
        </div>
        <slot name="head" />
      </header>
      <div class="body"><slot /></div>
    </section>
  </div>
</template>

<style scoped>
.float { position: fixed; left: 0; top: 0; will-change: transform; }
.sheet {
  max-height: calc(45dvh - 16px); display: flex; flex-direction: column; padding: 0 18px 16px;
  background-color: var(--paper); box-shadow: 0 18px 48px rgb(20 22 24 / 0.32); outline: none;
}
.handle { cursor: grab; touch-action: none; user-select: none; }
.dragging .handle { cursor: grabbing; }
.bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 0 6px; }
.tools { display: flex; align-items: center; gap: 6px; }
.close { width: 24px; height: 24px; padding: 0; line-height: 1; background: var(--tag); color: var(--paper); border-color: var(--tag); }
.body { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 10px 6px 0 0; margin-top: 4px;}
/* Press feedback, and hover only where there is a real pointer. */
.sheet :deep(button) { transition: transform 160ms var(--ease-out), color 160ms ease, background-color 160ms ease; }
.sheet :deep(button:active:not(:disabled)) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) { .close:hover { color: var(--accent); } }
/* In from slightly smaller, centred like a modal; out faster; at once when closed from the keyboard. */
.paper-enter-active .sheet { transition: opacity 200ms var(--ease-out), transform 260ms var(--ease-out); }
.paper-leave-active .sheet { transition: opacity 150ms ease-out, transform 150ms ease-out; }
.paper-enter-from .sheet { opacity: 0; transform: scale(0.96); }
.paper-leave-to .sheet { opacity: 0; transform: scale(0.98); }
.instant .sheet { transition: none !important; }
</style>
