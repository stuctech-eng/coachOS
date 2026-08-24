'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Trash2, ArrowDown } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { cn } from '@/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIES = [
  'Kan ik vandaag hard trainen?',
  'Hoe is mijn herstel deze week?',
  'Wat zijn mijn risico\'s?',
  'Geef me een trainingsadvies',
]

function getVandaag(): string {
  return new Date().toISOString().split('T')[0]
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [laden, setLaden] = useState(true)
  const [wisBevestiging, setWisBevestiging] = useState(false)
  const [toonScrollKnop, setToonScrollKnop] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const vandaag = getVandaag()
    try {
      const opgeslaanDatum = window.localStorage.getItem('chat_datum')
      const opgeslaanBerichten = window.localStorage.getItem('chat_berichten')
      if (opgeslaanDatum === vandaag && opgeslaanBerichten) {
        const parsed = JSON.parse(opgeslaanBerichten)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      } else {
        window.localStorage.removeItem('chat_berichten')
        window.localStorage.setItem('chat_datum', vandaag)
      }
    } catch { /* */ }
    setLaden(false)
  }, [])

  useEffect(() => {
    if (laden || typeof window === 'undefined') return
    if (messages.length > 0) {
      window.localStorage.setItem('chat_berichten', JSON.stringify(messages))
      window.localStorage.setItem('chat_datum', getVandaag())
    }
  }, [messages, laden])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const checkScrollPositie = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const afstandTotOnder = el.scrollHeight - el.scrollTop - el.clientHeight
    setToonScrollKnop(afstandTotOnder > 120)
  }, [])

  useEffect(() => {
    // Na elke nieuwe render van berichten opnieuw checken (bijv. als een lang
    // antwoord binnenkomt terwijl de gebruiker al omhoog had gescrold)
    checkScrollPositie()
  }, [messages, loading, checkScrollPositie])

  function scrollNaarBeneden() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function stuurBericht(tekst: string) {
    if (!tekst.trim() || loading) return
    const nieuweBerichten: Message[] = [...messages, { role: 'user', content: tekst.trim() }]
    setMessages(nieuweBerichten)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nieuweBerichten }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Er ging iets mis. Probeer het opnieuw.' }])
    } finally {
      setLoading(false)
    }
  }

  function wisGesprek() {
    setMessages([])
    localStorage.removeItem('chat_berichten')
    setWisBevestiging(false)
  }

  if (laden) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      {/* v2.4.213-FIX: hoogte was een losse berekening 'calc(100dvh - 4rem)',
          die niet overeenkwam met de werkelijke padding van <main> in AppShell
          (pb-24 = 6rem). Door die mismatch overflowde deze wrapper binnen
          main (dat zelf ook overflow-y:auto heeft via .scroll-area), waardoor
          main ging scrollen i.p.v. de interne berichten-container hieronder.
          Gevolg: de onScroll-detectie voor de scroll-naar-beneden-pijl
          (checkScrollPositie/toonScrollKnop) vuurde nooit, dus de pijl kwam
          nooit in beeld. Met h-full vult deze wrapper altijd exact de door
          main beschikbaar gestelde ruimte, ongeacht paddingwaarden — main
          hoeft dan niet meer te scrollen en alle scroll gaat naar de juiste
          interne container. */}
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="px-5 pt-6 pb-4 flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Coach</h1>
            <p className="text-slate-400 text-sm mt-0.5">Stel je coach een vraag</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setWisBevestiging(true)}
              className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center active:bg-slate-700"
            >
              <Trash2 size={16} className="text-slate-400" />
            </button>
          )}
        </div>

        {/* Bevestiging wissen */}
        {wisBevestiging && (
          <div className="mx-5 mb-4 bg-slate-800 border border-slate-700 rounded-2xl p-4 flex-shrink-0">
            <p className="text-white text-sm font-medium mb-1">Gesprek wissen?</p>
            <p className="text-slate-400 text-xs mb-4">De coach geschiedenis wordt permanent verwijderd. Dit kan niet ongedaan worden gemaakt.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setWisBevestiging(false)}
                className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 text-sm active:bg-slate-600"
              >
                Annuleer
              </button>
              <button
                onClick={wisGesprek}
                className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm border border-red-500/30 active:bg-red-500/30"
              >
                Wis gesprek
              </button>
            </div>
          </div>
        )}

        {/* Berichten */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollContainerRef}
            onScroll={checkScrollPositie}
            className="h-full overflow-y-auto px-5 pb-4"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col gap-4 pt-4">
                <div className="flex items-center gap-3 bg-slate-800/50 rounded-2xl p-4">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot size={20} className="text-primary-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Goedemorgen!</p>
                    <p className="text-slate-400 text-xs mt-0.5">Ik ken je data. Stel me een vraag over je training, herstel of gezondheid.</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 px-1">Suggesties:</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIES.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => stuurBericht(s)}
                      className="text-left px-4 py-3 bg-slate-800/50 rounded-xl text-sm text-slate-300 active:bg-slate-700 border border-slate-700/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 pt-2">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1',
                      msg.role === 'user' ? 'bg-primary-500/20' : 'bg-slate-700'
                    )}>
                      {msg.role === 'user'
                        ? <User size={16} className="text-primary-400" />
                        : <Bot size={16} className="text-slate-300" />
                      }
                    </div>
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary-600 text-white rounded-tr-sm'
                        : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot size={16} className="text-slate-300" />
                    </div>
                    <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1 items-center h-5">
                        <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Scroll-naar-beneden-knop, zoals ChatGPT: verschijnt zodra je omhoog scrolt */}
          {toonScrollKnop && (
            <button
              onClick={scrollNaarBeneden}
              aria-label="Scroll naar beneden"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-slate-700/90 border border-slate-600 shadow-lg flex items-center justify-center active:bg-slate-600 backdrop-blur-sm"
            >
              <ArrowDown size={18} className="text-slate-200" />
            </button>
          )}
        </div>

        {/* Snelle suggesties */}
        {messages.length > 0 && (
          <div className="flex-shrink-0 px-5 pt-2 pb-1 flex gap-2 overflow-x-auto">
            {SUGGESTIES.map((s, i) => (
              <button
                key={i}
                onClick={() => stuurBericht(s)}
                disabled={loading}
                className="flex-shrink-0 px-3 py-1.5 bg-slate-800 rounded-full text-xs text-slate-300 active:bg-slate-700 border border-slate-700/50 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0 px-5 pb-6 pt-2 border-t border-coach-border">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  stuurBericht(input)
                }
              }}
              placeholder="Stel een vraag aan je coach..."
              rows={1}
              className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder-slate-500"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => stuurBericht(input)}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-xl bg-primary-600 flex items-center justify-center active:bg-primary-700 disabled:opacity-40 flex-shrink-0"
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
