export function createFakeDsh() {
  const workspaces = [
    { id: 'w1', title: 'Workspace One', path: '/tmp/w1', sessionCount: 1, runningCount: 0, updatedAt: 10 },
  ]
  const sessions = [
    { id: 's1', title: 'Old session', updatedAt: 10, running: false, blank: false, cwd: '/tmp/w1', parentSessionId: null },
  ]
  const followScripts = new Map()
  const prompts = []
  const cancellations = []
  const renames = []

  const dsh = {
    async listWorkspaces() {
      return workspaces.map((workspace) => ({ ...workspace }))
    },
    async listSessions(workspaceId) {
      if (workspaceId !== 'w1') return []
      return sessions.map((session) => ({ ...session }))
    },
    async createSession(workspaceId) {
      const id = 'session-new'
      sessions.push({ id: id, title: null, updatedAt: 11, running: false, blank: true, cwd: '/tmp/w1', parentSessionId: null })
      return id
    },
    async prompt(sessionId, parts, options) {
      prompts.push({ sessionId: sessionId, parts: parts, options: options })
    },
    async cancel(sessionId) {
      cancellations.push(sessionId)
    },
    async renameSession(sessionId, title) {
      renames.push({ sessionId: sessionId, title: title })
      return title
    },
    follow(sessionId) {
      const script = followScripts.get(sessionId) || []
      return (async function* generator() {
        for (const frame of script) yield frame
      })()
    },
    async page() {
      return { records: [], hasMore: false }
    },
  }

  return {
    dsh: dsh,
    state: { workspaces: workspaces, sessions: sessions, followScripts: followScripts, prompts: prompts, cancellations: cancellations, renames: renames },
  }
}
