export type Project = {
  id: number
  name: string
  template: string | null
  created_at: string
}

export type SearchResult = {
  title: string
  url: string
  snippet: string
}

export type Note = {
  id: number
  text: string
  tags: string[]
  created_at: string
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  projects: {
    list: () => json<Project[]>('/api/projects'),
    create: (name: string, template: string) =>
      json<Project>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, template }),
      }),
    files: (id: number) => json<{ path: string; content: string }[]>(`/api/projects/${id}/files`),
    readFile: (id: number, path: string) =>
      json<{ path: string; content: string }>(`/api/projects/${id}/files?path=${encodeURIComponent(path)}`),
    writeFile: (id: number, path: string, content: string) =>
      json(`/api/projects/${id}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      }),
    deleteFile: (id: number, path: string) =>
      json(`/api/projects/${id}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      }),
    run: (id: number) =>
      json<{ lines: string[] }>(`/api/projects/${id}/run`, { method: 'POST' }),
  },
  research: {
    search: (q: string) =>
      json<SearchResult[]>(`/api/research/search?q=${encodeURIComponent(q)}`),
    notes: {
      list: () => json<Note[]>('/api/research/notes'),
      create: (text: string, tags: string[]) =>
        json<Note>('/api/research/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, tags }),
        }),
      remove: (id: number) => json(`/api/research/notes/${id}`, { method: 'DELETE' }),
    },
  },
}
