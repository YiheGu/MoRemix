export async function yieldToMainThread() {
    if (typeof globalThis.scheduler?.yield === "function") {
        await globalThis.scheduler.yield();
        return;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
}

export function yieldEvery(index, chunkSize = 512) {
    return index > 0 && index % chunkSize === 0 ? yieldToMainThread() : null;
}
