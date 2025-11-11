import { NextRequest } from 'next/server'
import { addConnection, removeConnection } from '@/lib/sse-manager'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Add connection to set
      addConnection(controller)

      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({ type: 'connected' })}\n\n`
      controller.enqueue(new TextEncoder().encode(initialMessage))

      // Keep connection alive with periodic ping
      const pingInterval = setInterval(() => {
        try {
          const pingMessage = `data: ${JSON.stringify({ type: 'ping' })}\n\n`
          controller.enqueue(new TextEncoder().encode(pingMessage))
        } catch (error) {
          clearInterval(pingInterval)
          removeConnection(controller)
        }
      }, 30000) // Ping every 30 seconds

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval)
        removeConnection(controller)
        try {
          controller.close()
        } catch (error) {
          // Ignore errors on close
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  })
}

