import { create } from 'zustand'
import { useAppStore } from './appStore'
import type { Project, Note } from '@/lib/api'
import { sfx } from '@/lib/sfx'

export type YardId = 'coding' | 'research'
export type YardStatus = 'closed' | 'opening' | 'open' | 'closing'

export type YardFile = {
  path: string
  content: string
  dirty: boolean
}

type YardState = {
  active: YardId | null
  status: YardStatus
  projects: Project[]
  currentProject: Project | null
  files: YardFile[]
  activeFile: string | null
  notes: Note[]
  consoleLines: string[]
  openYard: (yard: YardId) => void
  closeYard: () => void
  setProjects: (p: Project[]) => void
  openProject: (p: Project) => void
  setFiles: (files: YardFile[], active?: string | null) => void
  updateFile: (path: string, content: string, dirty?: boolean) => void
  setActiveFile: (path: string) => void
  closeProject: () => void
  setNotes: (n: Note[]) => void
  addNote: (n: Note) => void
  pushConsole: (line: string) => void
  clearConsole: () => void
}

export const useYardStore = create<YardState>((set, get) => ({
  active: null,
  status: 'closed',
  projects: [],
  currentProject: null,
  files: [],
  activeFile: null,
  notes: [],
  consoleLines: [],

  openYard: (yard) => {
    if (get().active === yard && get().status === 'open') return
    useAppStore.getState().setView('home')
    set({ active: yard, status: 'opening' })
    sfx.open()
    window.setTimeout(() => set({ status: 'open' }), 150)
  },

  closeYard: () => {
    set({ status: 'closing' })
    window.setTimeout(() => set({ active: null, status: 'closed' }), 250)
  },

  setProjects: (projects) => set({ projects }),
  openProject: (p) => set({ currentProject: p, files: [], activeFile: null }),

  setFiles: (files, active) =>
    set((s) => ({
      files,
      activeFile: active !== undefined ? active : s.activeFile,
    })),

  updateFile: (path, content, dirty = true) =>
    set((s) => ({
      files: s.files.map((f) => (f.path === path ? { ...f, content, dirty } : f)),
    })),

  setActiveFile: (path) => set({ activeFile: path }),
  closeProject: () => set({ currentProject: null, files: [], activeFile: null }),

  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),

  pushConsole: (line) =>
    set((s) => ({ consoleLines: [...s.consoleLines, line].slice(-200) })),
  clearConsole: () => set({ consoleLines: [] }),
}))
