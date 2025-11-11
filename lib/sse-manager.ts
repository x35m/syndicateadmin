// SSE connection manager
const connections = new Set<ReadableStreamDefaultController>()

export function addConnection(controller: ReadableStreamDefaultController) {
  connections.add(controller)
}

export function removeConnection(controller: ReadableStreamDefaultController) {
  connections.delete(controller)
}

export function broadcastNewMaterial(material: any) {
  const message = `data: ${JSON.stringify({ type: 'new-material', data: material })}\n\n`
  const encoder = new TextEncoder()
  const encodedMessage = encoder.encode(message)
  
  connections.forEach((controller) => {
    try {
      controller.enqueue(encodedMessage)
    } catch (error) {
      // Connection closed, remove it
      connections.delete(controller)
    }
  })
}

export function broadcastSyncProgress(progress: { feed: string; new: number; updated: number; total: number }) {
  const message = `data: ${JSON.stringify({ type: 'sync-progress', data: progress })}\n\n`
  const encoder = new TextEncoder()
  const encodedMessage = encoder.encode(message)
  
  connections.forEach((controller) => {
    try {
      controller.enqueue(encodedMessage)
    } catch (error) {
      connections.delete(controller)
    }
  })
}

export function broadcastSyncComplete(stats: { new: number; updated: number; errors: number }) {
  const message = `data: ${JSON.stringify({ type: 'sync-complete', data: stats })}\n\n`
  const encoder = new TextEncoder()
  const encodedMessage = encoder.encode(message)
  
  connections.forEach((controller) => {
    try {
      controller.enqueue(encodedMessage)
    } catch (error) {
      connections.delete(controller)
    }
  })
}

export function getConnectionCount() {
  return connections.size
}

