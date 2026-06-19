'use client'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log naar console voor het geval er ooit wel inspector beschikbaar is
    console.error('Training session error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
        <span className="text-3xl">⚠️</span>
      </div>
      <h1 className="text-lg font-bold text-center">Er ging iets mis</h1>

      <div className="w-full max-w-sm bg-slate-900 rounded-2xl p-4 max-h-96 overflow-y-auto">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Foutmelding</p>
        <p className="text-sm text-red-400 font-mono break-words mb-3">
          {error.message || 'Onbekende fout'}
        </p>

        {error.digest && (
          <>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 mt-3">Digest</p>
            <p className="text-xs text-slate-400 font-mono break-all">{error.digest}</p>
          </>
        )}

        {error.stack && (
          <>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 mt-3">Stack trace</p>
            <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-words leading-relaxed">
              {error.stack.split('\n').slice(0, 8).join('\n')}
            </pre>
          </>
        )}
      </div>

      <div className="flex gap-3 w-full max-w-sm mt-2">
        <button
          onClick={() => {
            try {
              localStorage.removeItem('coachos_session')
              localStorage.removeItem('coachos_training_session')
            } catch { /* */ }
            reset()
          }}
          className="flex-1 py-3 bg-primary-600 rounded-xl text-sm font-semibold active:bg-primary-700"
        >
          Sessie wissen & opnieuw
        </button>
      </div>
      <button
        onClick={() => window.location.href = '/training'}
        className="text-sm text-slate-500 mt-2"
      >
        Terug naar Training
      </button>
    </div>
  )
}
