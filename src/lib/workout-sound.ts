// ─── Gedeelde workout-audio-module ─────────────────────────────────────────
// v2.4.46: professionele, sportieve soundset (vergelijkbaar met Polar/
// Garmin/Concept2), op basis van gebruikersontwerp. Geen schelle piepjes —
// korte, relatief hoge tonen (~1-2 kHz) die door achtergrondmuziek heen
// blijven snijden zonder irritant te worden tijdens een training van
// 30-60 minuten. Synthetisch gegenereerd (Web Audio API) — geen
// mp3-bestanden, geen downloads, werkt offline.
//
// ARCHITECTUURREGELS (ongewijzigd sinds v2.4.34):
// - Geluid is uitsluitend een luisterlaag, bestuurt nooit de timer/state.
// - Elke functie faalt altijd stil — een geblokkeerde AudioContext mag de
//   workout nooit onderbreken.
// - Eén gedeelde AudioContext-instantie, ontgrendeld bij de eerste echte
//   gebruikersactie (nooit automatisch).
//
// Belangrijke kanttekening, geen technische oplossing mogelijk: een
// website/PWA heeft GEEN toegang tot het systeem-audiokanaal van iOS en
// kan dus niet het volume van andere apps (Spotify, Apple Music) dempen
// ("ducking") — dat is een bewuste iOS-beperking. De enige beschikbare
// hefboom is dat onze eigen tonen duidelijk genoeg zijn om er doorheen te
// snijden, wat dit ontwerp nastreeft.

let gedeeldeAudioContext: AudioContext | null = null

function krijgAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!gedeeldeAudioContext) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      gedeeldeAudioContext = new Ctx()
    }
    return gedeeldeAudioContext
  } catch {
    return null
  }
}

export function ontgrendelAudio() {
  const ctx = krijgAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.01)
  } catch { /* stil falen — geluid is nooit kritiek */ }
}

// Eén enkele toon met zachte in/uit-fade. `startOffsetSec` maakt het
// mogelijk om meerdere tonen na elkaar te plannen (voor DI-DIT/DI-DING)
// zonder losse setTimeout's te gebruiken — nauwkeuriger en simpeler.
function speelToon(ctx: AudioContext, frequentie: number, duurMs: number, startOffsetSec: number, volume: number) {
  try {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequentie
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    const start = ctx.currentTime + startOffsetSec
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + 0.008)
    gain.gain.linearRampToValueAtTime(0, start + duurMs / 1000)
    oscillator.start(start)
    oscillator.stop(start + duurMs / 1000 + 0.02)
  } catch { /* stil falen */ }
}

function metContext(fn: (ctx: AudioContext) => void) {
  const ctx = krijgAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()
    fn(ctx)
  } catch { /* stil falen */ }
}

// v2.4.46: volume verhoogd t.o.v. v2.4.34 (0.15 → 0.28) — hoorbaar naast
// zachte achtergrondmuziek, zonder schel te worden dankzij de zachte
// in/uit-fade in speelToon().
const VOLUME = 0.28

/**
 * Start Tone — "DI-DIT". Heldere, korte dubbele toon bij start van elke
 * set/oefening. Energiek zonder agressief te zijn. ±180ms totaal.
 */
export function speelStarttoon() {
  metContext(ctx => {
    speelToon(ctx, 1318, 80, 0, VOLUME)      // DI  (E6)
    speelToon(ctx, 1568, 90, 0.09, VOLUME)   // DIT (G6, iets hoger = oplopend)
  })
}

/**
 * Tick — laatste 3 seconden van countdown/rust. Kort, droog, niet
 * oplopend in volume (elke tik even luid — geen opbouw naar "paniek").
 * Iets hogere frequentie dan voorheen (was 880Hz) zodat 'ie beter
 * doorheen achtergrondmuziek snijdt.
 */
export function speelTick() {
  metContext(ctx => speelToon(ctx, 1568, 70, 0, VOLUME * 0.85))
}

/**
 * Rest Tone (v2.4.46: vervangt/vernoemt het oude "Eindsignaal") — één
 * zachte bevestigingstoon ("blip") bij einde van een set. Geeft aan
 * "werk klaar → rust", zonder een alarm-gevoel.
 */
export function speelEindsignaal() {
  metContext(ctx => speelToon(ctx, 987, 130, 0, VOLUME * 0.8))
}

/**
 * Finish Tone (NIEUW in v2.4.46) — "DI—DING". Twee rustige oplopende
 * tonen bij het einde van de VOLLEDIGE training (niet per set/oefening).
 * Rustig, voldaan gevoel — geen fanfare.
 */
export function speelFinishToon() {
  metContext(ctx => {
    speelToon(ctx, 1046, 220, 0, VOLUME)      // DI
    speelToon(ctx, 1568, 320, 0.24, VOLUME)   // DING (hoger + langer aangehouden)
  })
}
