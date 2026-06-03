function GoalDetail({ goal, onClose, onUpdate, onAfronden, onVerwijder }: {
  goal: Goal
  onClose: () => void
  onUpdate: (id: string, value: number) => void
  onAfronden: (id: string) => void
  onVerwijder: (id: string) => void
}) {
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [nieuweWaarde, setNieuweWaarde] = useState(goal.current_value?.toString() || '')
  const [nieuweNotitie, setNieuweNotitie] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/goal-updates?goal_id=' + goal.id)
      .then(r => r.json())
      .then(d => setUpdates(d.updates || []))
      .catch(() => {})
  }, [goal.id])

  async function slaOp() {
    if (!nieuweWaarde && !nieuweNotitie) return
    setSaving(true)
    try {
      const res = await fetch('/api/goal-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_id: goal.id,
          current_value: nieuweWaarde ? Number(nieuweWaarde) : null,
          notes: nieuweNotitie || null,
        }),
      })
      const data = await res.json()
      if (data.update) {
        setUpdates(prev => [data.update, ...prev])
        if (nieuweWaarde) onUpdate(goal.id, Number(nieuweWaarde))
        setNieuweNotitie('')
        setMessage('✅ Voortgang opgeslagen')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {
      setMessage('❌ Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">{goal.title}</h2>
        <button onClick={() => onAfronden(goal.id)} className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
          <CheckCircle size={18} className="text-green-400" />
        </button>
        <button onClick={() => onVerwijder(goal.id)} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Trash2 size={16} className="text-red-400" />
        </button>
      </div>

      {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

      <Card className="p-4 flex flex-col gap-4">
        <p className="text-sm font-semibold text-white">Voortgang bijwerken</p>
        {goal.target_value && (
          <div className="bg-slate-800 rounded-xl p-3">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Huidig: {goal.current_value ?? '--'}</span>
              <span>Doel: {goal.target_value}</span>
            </div>
            {goal.current_value && goal.target_value && (
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (goal.current_value / goal.target_value) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            {goal.target_value ? 'Nieuwe waarde' : 'Notitie over voortgang'}
          </label>
          {goal.target_value ? (
            <input
              type="number"
              value={nieuweWaarde}
              onChange={e => setNieuweWaarde(e.target.value)}
              placeholder={goal.current_value?.toString() || '0'}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <input
              value={nieuweNotitie}
              onChange={e => setNieuweNotitie(e.target.value)}
              placeholder="Hoe gaat het met dit doel?"
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          )}
        </div>
        {goal.target_value && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notitie</label>
            <input value={nieuweNotitie} onChange={e => setNieuweNotitie(e.target.value)}
              placeholder="Optioneel..." className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        )}
        <Button onClick={slaOp} loading={saving} fullWidth size="sm">Opslaan</Button>
      </Card>

      {updates.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Historie</p>
          <div className="flex flex-col gap-2">
            {updates.map(u => (
              <Card key={u.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{new Date(u.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
                  {u.current_value && <span className="text-sm font-bold text-primary-400">{u.current_value}</span>}
                </div>
                {u.notes && <p className="text-xs text-slate-400 mt-1">{u.notes}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
