// ─── Gedeelde workout-audio-module ─────────────────────────────────────────
// v2.4.34. Gebruikt door zowel Archief (archief/oefening/[id]/page.tsx) als
// Trainer AI/Bibliotheek (training/session/[module]/page.tsx) — één bron
// van waarheid voor geluid, voorkomt dat de twee systemen uiteen gaan lopen.
//
// ARCHITECTUURREGELS (bewust zo gebouwd):
// - Geluid is UITSLUITEND een luisterlaag. Deze module heeft geen eigen
//   timer, state of fase-kennis — hij wordt aangeroepen VANUIT de
//   advancePhase()-functies van de aanroepende pagina's, nooit andersom.
// - Elke functie faalt altijd stil (try/catch, lege catch). Een geblokkeerde
//   of falende AudioContext mag de workout nooit onderbreken of vertragen.
// - Eén gedeelde AudioContext-instantie binnen de app-sessie (module-level
//   singleton), ontgrendeld bij de eerste echte gebruikersactie via
//   ontgrendelAudio() — vereist door iOS Safari, dat audio pas na een
//   echte tik/klik toestaat, nooit automatisch bij het laden van de pagina.
// - Geen instellingen (aan/uit) in deze fase — dat volgt in Fase 3.
//   Geluid staat nu standaard aan.

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

/**
 * Ontgrendelt audio voor de rest van de sessie. Roep dit aan vanuit een
 * ECHTE gebruikersinteractie (bv. onClick van een "Start"-knop) — nooit
 * vanuit een useEffect of automatisch bij het laden van een pagina, anders
 * weigert iOS Safari geluid voor de volledige sessie.
 */
export function ontgrendelAudio() {
  const ctx = krijgAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()
    // Speel een (vrijwel onhoorbare) stille toon af om de audio-pipeline
    // definitief te openen op iOS — een bekende, noodzakelijke stap.
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.01)
  } catch { /* stil falen — geluid is nooit kritiek */ }
}

// Korte toon met een zachte in/uit-fade (voorkomt tik/klik-geluid door de
// oscillator abrupt te starten/stoppen)
function speelToon(frequentie: number, duurMs: number, volume = 0.15) {
  const ctx = krijgAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequentie
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    const nu = ctx.currentTime
    gain.gain.setValueAtTime(0, nu)
    gain.gain.linearRampToValueAtTime(volume, nu + 0.01)
    gain.gain.linearRampToValueAtTime(0, nu + duurMs / 1000)
    oscillator.start(nu)
    oscillator.stop(nu + duurMs / 1000 + 0.02)
  } catch { /* stil falen — geluid is nooit kritiek */ }
}

/** Laatste 3 sec van rust/countdown — kort, droog, hoog. */
export function speelTick() { speelToon(880, 70) }

/** Einde van een actieve set (actief → rust). Lager, iets langer. */
export function speelEindsignaal() { speelToon(440, 160) }

/** Start van een nieuwe set/oefening (countdown/rust → actief). Hoger, helder. */
export function speelStarttoon() { speelToon(1046, 150) }
