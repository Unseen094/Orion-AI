import { Suspense } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useYardStore } from '@/state/yardStore'
import { api } from '@/lib/api'

const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  css: 'css',
  html: 'html',
  py: 'python',
  md: 'markdown',
  svg: 'xml',
}

const CRIMSON_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '62626e', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'ff4f4f' },
    { token: 'string', foreground: 'ffb8b8' },
    { token: 'number', foreground: 'ff8a8a' },
    { token: 'type', foreground: 'ffdcdc' },
    { token: 'tag', foreground: 'ff2d2d' },
    { token: 'attribute', foreground: 'ffb8b8' },
    { token: 'identifier', foreground: 'e8e8ee' },
    { token: 'delimiter', foreground: '9a9aa8' },
  ],
  colors: {
    'editor.background': '#0d0d12',
    'editor.foreground': '#e8e8ee',
    'editorLineNumber.foreground': '#3a3a48',
    'editorLineNumber.activeForeground': '#ff2d2d',
    'editorCursor.foreground': '#ff2d2d',
    'editor.selectionBackground': '#ff2d2d33',
    'editor.lineHighlightBackground': '#12121a',
    'editorIndentGuide.background1': '#1f1f2a',
    'scrollbarSlider.background': '#2a2a3855',
    'scrollbarSlider.hoverBackground': '#ff2d2d55',
    'minimap.background': '#0d0d12',
  },
}

export function MonacoPane() {
  const { files, activeFile, updateFile } = useYardStore()
  const currentProject = useYardStore((s) => s.currentProject)
  const file = files.find((f) => f.path === activeFile)

  const save = async (path: string, content: string) => {
    if (!currentProject) return
    updateFile(path, content, false)
    api.projects.writeFile(currentProject.id, path, content).catch(() => {
      updateFile(path, content, true)
    })
  }

  const handleMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme('orion-crimson', CRIMSON_THEME)
    monaco.editor.setTheme('orion-crimson')
    editor.focus()
  }

  if (!file) {
    return (
      <div className="flex flex-1 items-center justify-center bg-void/40">
        <p className="font-mono text-[10px] tracking-[0.3em] text-ink-faint">
          SELECT A FILE
        </p>
      </div>
    )
  }

  const ext = file.path.split('.').pop() ?? ''
  const lang = LANG_BY_EXT[ext] ?? 'plaintext'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-panel-2/50 px-3 py-1.5">
        <div className="flex items-center gap-2 font-mono text-[10px] text-ink-dim">
          <span className="text-crimson-400">{file.path}</span>
          {file.dirty && <span className="text-crimson-400">●</span>}
        </div>
        {file.dirty && (
          <button
            onClick={() => save(file.path, file.content)}
            className="rounded-md border border-crimson-500/40 px-2 py-0.5 font-mono text-[10px] tracking-widest text-crimson-400 hover:bg-crimson-600/20"
          >
            SAVE
          </button>
        )}
      </div>
      <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[10px] tracking-widest text-ink-faint">LOADING EDITOR...</div>}>
        <Editor
          key={file.path}
          height="100%"
          path={file.path}
          defaultLanguage={lang}
          value={file.content}
          onChange={(v) => updateFile(file.path, v ?? '')}
          onMount={handleMount}
          loading={<div className="flex h-full items-center justify-center font-mono text-[10px] tracking-widest text-ink-faint">LOADING EDITOR...</div>}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12 },
            tabSize: 2,
            automaticLayout: true,
            renderLineHighlight: 'line',
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: { verticalScrollbarSize: 8 },
          }}
        />
      </Suspense>
    </div>
  )
}
