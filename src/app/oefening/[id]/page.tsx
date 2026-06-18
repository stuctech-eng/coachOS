'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronDown, ChevronUp, ArrowLeft, Bookmark } from 'lucide-react'
import { OEFENINGEN } from '@/lib/exercises'
import { cn } from '@/utils'

export default function OefeningPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const oefening = OEFENINGEN[id]

  const [foutenOpen, setFoutenOpen] = useState(false)
  const [beschrijvingVolledig, setBeschrijvingVolledig] = useState(false)

  if (!oefening) {
    return (
      <div className="min-h-screen bg-[#0B0F14] text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold">Oefening niet gevonden</p>
        <button onClick={() => router.back()} className="text-primary-400 text-sm">Terug</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white pb-safe">

      {/* Nav */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 bg-[#1C2333] rounded-xl flex items-center justify-center active:opacity-70"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <span className="text-sm font-semibold text-slate-400">Oefening</span>
        <button className="w-10 h-10 bg-[#1C2333] rounded-xl flex items-center justify-center active:opacity-70">
          <Bookmark size={16} className="text-slate-400" />
        </button>
      </div>

      {/* Header */}
      <div className="px-5 pb-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-[#1C2333] rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">
            🏋️
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight leading-tight">{oefening.naam}</h1>
            <div className="flex flex-wrap gap-1 mt-2">
              {oefening.primaireSpieven.map((s, i) => (
                <span key={i} className="text-xs text-green-400 font-medium">
                  {s}{i < oefening.primaireSpieven.length - 1 ? ' |' : ''}
                </span>
              ))}
            </div>
            <span className="inline-block mt-2 border border-green-400 text-green-400 text-xs font-semibold px-3 py-1 rounded-full">
              {oefening.type}
            </span>
          </div>
        </div>
      </div>

      {/* Afbeelding */}
      <div className="mx-5 bg-[#111827] rounded-2xl overflow-hidden border border-[#1C2333]">
        <img
          src={oefening.afbeelding}
          alt={oefening.naam}
          className="w-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            target.nextElementSibling?.classList.remove('hidden')
          }}
        />
        <div className="hidden aspect-video flex items-center justify-center text-slate-600 text-sm">
          Afbeelding niet gevonden
        </div>

        {/* Fase labels */}
        <div className="flex px-2 py-3 gap-1">
          {oefening.fases.map((fase, i) => (
            <div key={i} className="flex-1 text-center">
              <div className="w-6 h-6 rounded-full border border-green-400 text-green-400 text-xs font-bold flex items-center justify-center mx-auto mb-1">
                {i + 1}
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">{fase.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Meta chips */}
      <div className="flex gap-2 px-5 mt-4">
        {[
          { label: 'Niveau', value: oefening.niveau },
          { label: 'Equipment', value: oefening.equipment },
          { label: 'Type', value: oefening.type },
        ].map(({ label, value }) => (
          <div key={label} className="flex-1 bg-[#1C2333] rounded-xl px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-xs font-semibold text-slate-200 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Beschrijving */}
      <div className="px-5 mt-5">
        <h2 className="text-base font-bold mb-2">Beschrijving</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          {beschrijvingVolledig ? oefening.beschrijvingVolledig : oefening.beschrijving}
        </p>
        <button
          onClick={() => setBeschrijvingVolledig(v => !v)}
          className="flex items-center gap-1 text-green-400 text-sm font-semibold mt-2 active:opacity-70"
        >
          {beschrijvingVolledig ? 'Minder' : 'Meer'}
          {beschrijvingVolledig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Techniek & tips */}
      <div className="px-5 mt-5">
        <h2 className="text-base font-bold mb-3">Techniek & tips</h2>
        <div className="flex flex-col">
          {oefening.tips.map((tip, i) => (
            <div
              key={i}
              className={cn('flex items-start gap-3 py-3', i < oefening.tips.length - 1 && 'border-b border-[#1C2333]')}
            >
              <div className="w-5 h-5 rounded-full bg-green-400/10 border border-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-400 text-[10px]">✓</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Veelgemaakte fouten */}
      <div className="px-5 mt-5 mb-8">
        <button
          onClick={() => setFoutenOpen(v => !v)}
          className="w-full flex items-center justify-between bg-[#111827] border border-[#1C2333] rounded-2xl px-4 py-4 active:opacity-70"
        >
          <span className="text-sm font-semibold">Veelgemaakte fouten</span>
          {foutenOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </button>

        {foutenOpen && (
          <div className="bg-[#111827] border border-[#1C2333] border-t-0 rounded-b-2xl px-4 pb-4">
            {oefening.fouten.map((fout, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[#1C2333] last:border-0">
                <span className="text-red-400 text-sm font-bold flex-shrink-0">✗</span>
                <p className="text-sm text-slate-400 leading-relaxed">{fout}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
