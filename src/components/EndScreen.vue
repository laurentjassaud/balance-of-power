<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { USA, USSR } from '../engine/core'
import { LAST_YEAR } from '../engine/game'
import nuclearCloud from '../assets/nuclear-cloud.webp'
import treatySigning from '../assets/treaty-signing.webp'

const store = useGameStore()
const w = computed(() => store.w!)

/** Every end in the middle of the screen: a photograph, a large orange verdict across it, the epitaph under it. */
const ending = computed(() => {
  const e = w.value.ended
  const me = w.value.human, usa = me === USA
  if (e === 'war' || e === 'accident') return {
    photo: nuclearCloud, alt: 'Champignon atomique s’élevant au-dessus des nuages.', wide: false, bang: true,
    title: 'Vous avez perdu', kicker: e === 'war' ? 'Guerre nucléaire' : 'Guerre accidentelle',
    epitaph: `Les survivants se souviendront de vous comme le pire ${usa ? 'président des États-Unis' : 'premier secrétaire du Parti'} que l’histoire ait connu… Le dernier, aussi.`,
    text: e === 'war'
      ? 'Personne n’a voulu céder. Il n’y a plus de score à compter, ni personne pour le lire.'
      : 'La tension était telle qu’une fausse alerte a suffi. Le monde n’a pas survécu à cette crise.',
  }
  const mine = w.value.score(me), theirs = w.value.score(usa ? USSR : USA)
  const saved = 'Vous avez sauvé le pays, et du même coup le monde.'
  const under = usa ? 'sous votre présidence' : 'sous votre direction'
  const epitaph = mine < theirs
    ? `${saved} Mais ${usa ? 'les États-Unis ont' : 'l’Union soviétique a'} connu ${under} un terrible déclin. L’histoire se souviendra de vous comme de celui qui mena son pays à l’effondrement.`
    : mine > theirs
      ? `${saved} Et ${usa ? 'les États-Unis sont sortis grandis' : 'l’Union soviétique est sortie grandie'} de la guerre froide ${under}. L’histoire se souviendra de vous comme de celui qui mena son pays à la victoire.`
      : `${saved} Personne n’a gagné la guerre froide, personne ne l’a perdue. L’histoire retiendra surtout que vous n’avez pas appuyé sur le bouton.`
  return {
    photo: treatySigning, alt: 'Mikhaïl Gorbatchev et Ronald Reagan signent un traité côte à côte, devant les drapeaux des deux pays.', wide: true, bang: false,
    title: `La paix a tenu jusqu’en ${LAST_YEAR}`, kicker: mine > theirs ? 'Victoire' : mine < theirs ? 'Défaite' : 'Égalité',
    epitaph, text: `Prestige final : États-Unis ${w.value.score(USA)} · URSS ${w.value.score(USSR)}.`,
  }
})

// "Voir la carte" folds the verdict into a card in the corner; "Revoir le bilan" brings it back.
const folded = ref(false)
function seeMap() {
  folded.value = true
  store.tab = 'scores'
  store.touch()
}
</script>

<template>
  <Transition name="end" mode="out-in" appear :duration="{ enter: 600, leave: 160 }">
    <div v-if="!folded" key="full" class="veil centre" :data-rev="store.version">
      <section class="dlg br full" :class="[w.ended, { wide: ending.wide }]" role="dialog" aria-modal="true" aria-labelledby="end-title" aria-describedby="end-epitaph">
        <figure class="photo">
          <img :src="ending.photo" :alt="ending.alt" />
          <h2 id="end-title" class="verdict">{{ ending.title }}<template v-if="ending.bang">&#8239;<span class="bang">!!!!</span></template></h2>
        </figure>
        <div class="body">
          <p class="label rise" style="--d: 0">Fin de partie · {{ w.year }} · {{ ending.kicker }}</p>
          <p id="end-epitaph" class="epitaph rise" style="--d: 1">{{ ending.epitaph }}</p>
          <p class="text rise" style="--d: 2">{{ ending.text }}</p>
          <div class="btns rise" style="--d: 3">
            <button id="end-close" @click="seeMap">Voir la carte</button>
            <button id="end-new" class="primary" @click="store.quit()">Nouvelle partie</button>
          </div>
        </div>
      </section>
    </div>
    <div v-else key="card" class="veil" :data-rev="store.version">
      <section class="dlg br" role="dialog" :class="w.ended" aria-labelledby="end-card-title">
        <p class="label">Fin de partie · {{ w.year }} · {{ ending.kicker }}</p>
        <h2 id="end-card-title">{{ ending.title }}</h2>
        <p>{{ ending.text }}</p>
        <div class="btns">
          <button @click="folded = false">Revoir le bilan</button>
          <button class="primary" @click="store.quit()">Nouvelle partie</button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.veil { position: fixed; inset: auto 16px 16px auto; z-index: 25; max-width: calc(100% - 32px); }
.dlg { padding: 20px; border-top: 4px solid var(--accent); width: min(420px, 100%); display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 40px color-mix(in oklab, var(--ink) 25%, transparent); }
.dlg.war, .dlg.accident { border-top-color: var(--tag); }
h2 { font: 700 22px/1.1 var(--font-display); }
p { margin: 0; }
.btns { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }

/* The verdict: centred over a dark veil, the photograph on top, large orange letters across it. */
.veil.centre { inset: 0; max-width: none; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(8 9 10 / 0.8); }
.full { width: min(560px, 100%); max-height: calc(100dvh - 32px); padding: 0; gap: 0; overflow: hidden; box-shadow: 0 24px 80px rgb(0 0 0 / 0.55); }
.full.wide { width: min(640px, 100%); }
.photo { position: relative; margin: 0; flex: 1 1 auto; min-height: 180px; height: min(56vh, 520px); overflow: hidden; background: #000; }
.photo img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; }
/* A landscape photograph is shown whole: both signatories, the flags between them. */
.wide .photo { flex: none; height: auto; aspect-ratio: 1280 / 789; }
.wide .photo img { object-position: 50% 50%; }
/* Darker toward the foot so the orange title reads on the picture. */
.photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgb(0 0 0 / 0.88)); pointer-events: none; }
.verdict {
  position: absolute; z-index: 1; left: 20px; right: 20px; bottom: 16px;
  font: 700 clamp(38px, 9.5vw, 68px)/0.92 var(--font-display); letter-spacing: -0.02em; color: var(--accent);
  text-shadow: 0 2px 28px rgb(0 0 0 / 0.65);
}
.wide .verdict { font-size: clamp(28px, 6.5vw, 46px); }
/* The mono font gives each "!" a full letter's width; drawn closer they read as one cry. */
.bang { letter-spacing: -0.38em; }
.body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 10px; }
.epitaph { font: 600 15px/1.4 var(--font-display); }
.text { font-size: 12.5px; color: var(--muted); }

/* A rare, final screen: the veil comes down, the photograph settles, then the verdict surfaces and the text follows. */
.end-enter-active.centre { animation: fade 500ms var(--ease-out) both; }
.end-enter-active .full { animation: pop 500ms var(--ease-out) both; }
.photo img { animation: settle 7s var(--ease-out) both; }
.verdict { animation: surface 700ms var(--ease-out) 350ms both; }
.rise { animation: rise 400ms var(--ease-out) both; animation-delay: calc(600ms + var(--d) * 60ms); }
/* Folding into the corner goes quickly. */
.end-leave-active.centre { animation: fade 160ms ease-out reverse both; }
@keyframes fade { from { opacity: 0; } }
@keyframes pop { from { opacity: 0; transform: scale(0.96); } }
@keyframes settle { from { transform: scale(1.1); } }
@keyframes surface { from { opacity: 0; transform: translateY(12px); filter: blur(8px); } }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
</style>
