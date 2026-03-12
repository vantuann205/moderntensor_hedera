import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const encoder = new TextEncoder();
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection event
            try {
                controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));
            } catch (_) {
                return;
            }

            // Poll and push refresh events every 5 seconds
            intervalId = setInterval(() => {
                if (cancelled) {
                    if (intervalId) clearInterval(intervalId);
                    return;
                }
                try {
                    const event = JSON.stringify({ type: 'refresh', timestamp: Date.now() });
                    controller.enqueue(encoder.encode(`data: ${event}\n\n`));
                } catch (_) {
                    // Controller closed — stop the interval
                    cancelled = true;
                    if (intervalId) clearInterval(intervalId);
                }
            }, 5000);
        },
        cancel() {
            // Called when client disconnects
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        }
    });
}
