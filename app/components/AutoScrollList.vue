<script setup lang="ts">
// Wadah daftar. Tanpa `auto`: daftar biasa yang bisa digulir.
// Dengan `auto` dan isi lebih tinggi dari wadah: isi berjalan sendiri pelan sebagai pita tanpa ujung
// (salinan kedua menyambung di bawah, jadi tidak pernah melompat kembali ke atas). Gerak memakai transform
// sub-piksel agar halus; berhenti saat disorot/difokus/disentuh atau tab tersembunyi; roda mouse & tombol panah
// tetap menggeser daftar. prefers-reduced-motion → kembali ke daftar biasa.
const props = withDefaults(defineProps<{ label: string; auto?: boolean; speed?: number }>(), { auto: false, speed: 10 })
const box = ref<HTMLElement | null>(null)
const first = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)
const reduced = ref(false)
const looping = ref(false)
let period = 0
let offset = 0
let raf = 0
let last = 0
let holdUntil = 0
let paused = false
let ro: ResizeObserver | undefined

const marquee = computed(() => props.auto && !reduced.value)

function apply() { if (track.value) track.value.style.transform = `translate3d(0, ${-offset}px, 0)` }
function wrap() { if (period > 0) offset = ((offset % period) + period) % period }
function measure() {
  if (!box.value || !first.value) return
  period = first.value.getBoundingClientRect().height
  looping.value = marquee.value && period > box.value.clientHeight + 1
  if (!looping.value) { offset = 0; apply() } else { wrap(); apply() }
}
function hold(ms: number) { holdUntil = performance.now() + ms }
function setPaused(v: boolean) { paused = v; if (!v) hold(800) }
function nudge(px: number) { if (!looping.value) return false; offset += px; wrap(); apply(); hold(2500); return true }
function onWheel(e: WheelEvent) { if (nudge(e.deltaY)) e.preventDefault() }
function onKey(e: KeyboardEvent) {
  const step = e.key === 'ArrowDown' ? 40 : e.key === 'ArrowUp' ? -40 : 0
  if (step && nudge(step)) e.preventDefault()
}

function tick(t: number) {
  raf = requestAnimationFrame(tick)
  const dt = last ? Math.min(t - last, 64) : 0
  last = t
  if (!looping.value || paused || document.hidden || t < holdUntil) return
  offset += (props.speed * dt) / 1000
  wrap()
  apply()
}

onMounted(() => {
  reduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ro = new ResizeObserver(measure)
  if (box.value) ro.observe(box.value)
  if (first.value) ro.observe(first.value)
  hold(1500)
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); ro?.disconnect() })
watch(marquee, () => nextTick(measure))
</script>

<template>
  <div ref="box" class="auto-scroll" :class="{ looping, marquee }" tabindex="0" role="region" :aria-label="label"
    @mouseenter="setPaused(true)" @mouseleave="setPaused(false)" @focusin="setPaused(true)" @focusout="setPaused(false)"
    @touchstart.passive="hold(4000)" @wheel="onWheel" @keydown="onKey">
    <div ref="track" class="track">
      <div ref="first"><slot /></div>
      <!-- Salinan penyambung pita: hanya visual, tidak terbaca pembaca layar & tidak bisa difokus. -->
      <div v-if="looping" aria-hidden="true" inert><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.auto-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; margin-right: -0.5rem; padding-right: 0.5rem;
  /* Tepi bawah memudar agar baris yang terpotong terlihat disengaja. */
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent); }
.auto-scroll.marquee { overflow: hidden; }
.auto-scroll.looping {
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 14px, #000 calc(100% - 18px), transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 14px, #000 calc(100% - 18px), transparent); }
.looping .track { will-change: transform; }
</style>
