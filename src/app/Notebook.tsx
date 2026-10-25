import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { Textarea } from '@openai/apps-sdk-ui/components/Textarea';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { BookOpen, ChevronRight, CloseBold, FileDocument, Moon, Plus, Search, Star, StarFilled, Sun } from '@openai/apps-sdk-ui/components/Icon';
import manifest from '../../plugin.json';
import { noteInput, type Note, type NoteInput, type Snapshot } from '../shared/notebook';
import type { NotebookBridge } from './bridge';
import { buildWorkPrompt } from './work-with-codex';

type Draft = NoteInput & { id?: string };
const blankNote = (): Draft => ({ title: '', body: '', kind: 'idea' });
const kinds = { idea: 'Idea', draft: 'Draft', reference: 'Reference' } as const;

function NoteEditor({ draft, busy, serverError, save, close }: {
  draft: Draft; busy: boolean; serverError: string; save: (draft: Draft) => Promise<void>; close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(draft);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = noteInput.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setError('');
    await save({ ...parsed.data, ...(values.id ? { id: values.id } : {}) });
  }
  return <dialog ref={dialog} className="note-dialog" aria-labelledby="editor-title"
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <form onSubmit={submit} className="editor">
      <div className="editor-heading"><div><span className="subtle">A little space to think</span>
        <h2 id="editor-title">{values.id ? 'Edit note' : 'New note'}</h2></div>
        <Button color="secondary" variant="ghost" uniform aria-label="Close note" disabled={busy} onClick={close}><CloseBold /></Button>
      </div>
      <label className="field" htmlFor="note-title"><span>Title</span>
        <Input id="note-title" autoFocus value={values.title} maxLength={80} size="xl" disabled={busy}
          placeholder="An idea worth keeping" onChange={event => setValues({ ...values, title: event.target.value })} />
      </label>
      <label className="field" htmlFor="note-body"><span>Your note</span>
        <Textarea id="note-body" value={values.body} maxLength={4000} rows={6} size="lg" disabled={busy}
          placeholder="It doesn't have to be polished yet." onChange={event => setValues({ ...values, body: event.target.value })} />
      </label>
      <fieldset className="kind-picker"><legend>Keep it as</legend><div>
        {Object.entries(kinds).map(([key, label]) => <Button key={key} type="button" size="sm" color="secondary"
          variant={values.kind === key ? 'soft' : 'ghost'} aria-pressed={values.kind === key} disabled={busy}
          onClick={() => setValues({ ...values, kind: key as NoteInput['kind'] })}>{label}</Button>)}
      </div></fieldset>
      {(error || serverError) && <p className="error" role="alert">{error || serverError}</p>}
      <div className="editor-actions"><Button type="button" color="secondary" variant="ghost" disabled={busy} onClick={close}>Cancel</Button>
        <Button type="submit" color="primary" size="lg" loading={busy}>Save note</Button></div>
    </form>
  </dialog>;
}

function PaperSketch() {
  return <div className="paper-sketch" aria-hidden="true">
    <div className="sketch-sheet sketch-back" /><div className="sketch-sheet sketch-front">
      <span className="sketch-dot" /><i /><i /><i className="short" /><span className="sketch-check">✓</span>
    </div><span className="sketch-spark">✧</span>
  </div>;
}

export function Notebook({ bridge }: { bridge: NotebookBridge }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [view, setView] = useState<'all' | 'favorites'>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dark, setDark] = useState(false);
  const [handoff, setHandoff] = useState<{
    noteId: string; prompt: string; state: 'sending' | 'sent' | 'preview' | 'error'; message: string;
  } | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    const unsubscribe = bridge.subscribe(setSnapshot);
    void bridge.connect().catch(error => setError(error instanceof Error ? error.message : 'Could not connect to the notebook.'));
    return unsubscribe;
  }, [bridge]);

  async function run(action: () => Promise<Snapshot>, message = '') {
    setBusy(true); setError(''); setNotice('');
    try { setSnapshot(await action()); setNotice(message); return true; }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save that change. Try again.'); return false; }
    finally { setBusy(false); }
  }
  async function save(values: Draft) {
    const successful = await run(() => bridge.call(values.id ? 'notebook_update' : 'notebook_create', values), 'Note saved.');
    if (successful) { setDraft(null); setQuery(''); setView('all'); }
  }
  function favorite(note: Note) {
    void run(() => bridge.call('notebook_favorite', { id: note.id, favorite: !note.favorite }), note.favorite ? 'Removed from favorites.' : 'Added to favorites.');
  }
  async function workWithCodex(note: Note) {
    if (sending.current) return;
    sending.current = true;
    const prompt = buildWorkPrompt(note);
    setHandoff({ noteId: note.id, prompt, state: 'sending', message: '' });
    try {
      const sent = await bridge.sendMessage(prompt);
      setHandoff({ noteId: note.id, prompt, state: sent ? 'sent' : 'preview', message: sent
        ? 'Sent to Codex. Continue in the conversation.'
        : bridge.preview ? 'This is the browser preview. Copy this prompt into Codex to continue.'
        : 'This app cannot send messages here. Copy this prompt into Codex to continue.' });
    } catch {
      setHandoff({ noteId: note.id, prompt, state: 'error', message: 'Could not send to Codex. Try again or copy the prompt below.' });
    } finally {
      sending.current = false;
    }
  }
  async function copyPrompt() {
    if (!handoff) return;
    try {
      await navigator.clipboard.writeText(handoff.prompt);
      setNotice('Prompt copied. Paste it into Codex to continue.');
    } catch {
      setNotice('Could not copy the prompt. Select the text and copy it manually.');
    }
  }
  function toggleTheme() {
    const next = !dark; setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
  }

  const notes = snapshot?.notes ?? [];
  const filtered = notes.filter(note => (view === 'all' || note.favorite)
    && `${note.title} ${note.body} ${note.kind}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const favorites = notes.filter(note => note.favorite).length;

  return <div className="notebook-shell">
    <aside className="sidebar" aria-label="Notebook navigation">
      <div className="brand"><span className="brand-mark"><BookOpen /></span><span>{manifest.extensions['com.openai'].interface.displayName}</span></div>
      <div className="workspace"><span className="workspace-avatar">P</span><div>Personal space<span>Room for your ideas</span></div></div>
      <nav className="navigation" aria-label="Notes">
        <button type="button" className={view === 'all' ? 'nav-item active' : 'nav-item'} aria-current={view === 'all' ? 'page' : undefined}
          onClick={() => { setView('all'); setQuery(''); }}><FileDocument /><span>All notes</span><span className="nav-count">{notes.length}</span></button>
        <button type="button" className={view === 'favorites' ? 'nav-item active' : 'nav-item'} aria-current={view === 'favorites' ? 'page' : undefined}
          onClick={() => { setView('favorites'); setQuery(''); }}><Star /><span>Favorites</span><span className="nav-count">{favorites}</span></button>
      </nav>
      <div className="sidebar-bottom"><span className="small-orbit" aria-hidden="true" /><p>Good ideas deserve<br />a place to land.</p><span className="version">Sample workspace</span></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><span>Personal space</span><ChevronRight /><span>{view === 'all' ? 'All notes' : 'Favorites'}</span></div>
        <div className="top-actions">{bridge.preview && <Button color="secondary" variant="ghost" size="sm" uniform aria-label={dark ? 'Use light appearance' : 'Use dark appearance'} onClick={toggleTheme}>{dark ? <Sun /> : <Moon />}</Button>}
          <Badge variant="outline" color="secondary">{bridge.preview ? 'Preview' : `v${manifest.version}`}</Badge></div>
      </header>

      <div className="page-content">
        <section className="page-heading"><div><h1>{view === 'all' ? 'Your next idea starts here.' : 'Keep the good ones close.'}</h1>
          <p>{view === 'all' ? 'A quiet place for thoughts, rough drafts, and things worth keeping.' : 'A few things you want to come back to.'}</p></div>
          <Button color="primary" size="lg" disabled={!snapshot || busy} onClick={() => setDraft(blankNote())}><Plus />New note</Button>
        </section>

        {view === 'all' && !query && <section className="welcome-panel" aria-label="A little room to think"><div>
          <span className="welcome-symbol"><BookOpen /></span><h2>A little room to think.</h2>
          <p>Capture the thought before it slips away.<br className="wide-only" /> The rest can come later.</p>
          <Button color="secondary" variant="ghost" size="sm" disabled={!snapshot || busy} onClick={() => setDraft(blankNote())}>Write something <ChevronRight /></Button>
        </div><PaperSketch /></section>}

        <section aria-labelledby="notes-heading" className="notes-section">
          <div className="notes-toolbar"><div className="section-title"><h2 id="notes-heading">{view === 'all' ? 'All notes' : 'Favorites'}</h2><span>{filtered.length}</span></div>
            <div className="notes-actions">
              <Button color="secondary" variant="ghost" size="sm" disabled={!snapshot} loading={busy}
                onClick={() => { void run(() => bridge.call('notebook_open', {}), 'Notes refreshed.'); }}>Refresh notes</Button>
              <Input aria-label="Search notes" placeholder="Find a thought…" startAdornment={<Search />} value={query} size="lg" className="search-input"
                onChange={event => setQuery(event.target.value)} />
            </div></div>

          {error && <div className="error-banner" role="alert"><p>{error}</p>
            <Button color="secondary" variant="outline" size="sm" loading={busy} onClick={() => { void run(() => bridge.call('notebook_open', {})); }}>Reload notes</Button></div>}
          {!snapshot && !error && <p role="status" className="empty-state">Opening your notebook…</p>}
          {snapshot && filtered.length === 0 && <div className="empty-state"><span className="empty-icon"><BookOpen /></span>
            <h3>{query ? 'No notes found' : 'Nothing here yet'}</h3><p>{query ? 'Try another word or clear your search.' : 'Create a note or save one to your favorites.'}</p>
            {query && <Button color="secondary" variant="outline" onClick={() => setQuery('')}>Clear search</Button>}</div>}

          <div className="notes-grid">{filtered.map(note => <article className={`note-card kind-${note.kind}`} key={note.id}>
            <div className="note-top"><Badge color={note.kind === 'idea' ? 'discovery' : note.kind === 'draft' ? 'success' : 'secondary'} variant="soft">{kinds[note.kind]}</Badge>
              <Button color="secondary" variant="ghost" uniform size="sm" disabled={busy} aria-pressed={note.favorite}
                aria-label={`${note.favorite ? 'Remove' : 'Add'} ${note.title} ${note.favorite ? 'from' : 'to'} favorites`} onClick={() => favorite(note)}>{note.favorite ? <StarFilled /> : <Star />}</Button></div>
            <button type="button" className="note-open" onClick={() => { setError(''); setDraft({ ...note }); }} disabled={busy} aria-label={`Edit ${note.title}`}>
              <h3>{note.title}</h3><p>{note.body}</p></button>
            <div className="note-ai">
              <Button color="secondary" variant="outline" size="sm" disabled={busy || handoff?.state === 'sending'}
                loading={handoff?.noteId === note.id && handoff.state === 'sending'}
                aria-label={`Work on ${note.title} with Codex`} onClick={() => { void workWithCodex(note); }}>
                Work on this with Codex
              </Button>
              {handoff?.noteId === note.id && handoff.state !== 'sending' && <div className="ai-handoff">
                <p role={handoff.state === 'error' ? 'alert' : 'status'}>{handoff.message}</p>
                {(handoff.state === 'preview' || handoff.state === 'error') && <>
                  <Textarea aria-label={`Prompt for ${note.title}`} value={handoff.prompt} readOnly rows={6} size="sm" />
                  <Button color="secondary" variant="ghost" size="sm" onClick={() => { void copyPrompt(); }}>Copy prompt</Button>
                </>}
              </div>}
            </div>
            <div className="note-footer"><span>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(note.updatedAt))}</span><span>{note.body.trim().split(/\s+/).length} words</span></div>
          </article>)}</div>
        </section>

        <footer className="page-footer"><span>{bridge.preview ? 'Browser preview. Saved in this browser.' : 'Notes saved locally with SQLite.'}</span><span>Made with OpenAI UI</span></footer>
      </div>
      <p role="status" className="sr-only">{notice}</p>
    </main>
    {draft && <NoteEditor draft={draft} busy={busy} serverError={error} save={save} close={() => setDraft(null)} />}
  </div>;
}
