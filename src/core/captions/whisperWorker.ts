// Whisper transcription web worker / service
import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js for local/browser execution
env.allowLocalModels = false;
env.useBrowserCache = true;

export async function testPipeline() {
  return typeof pipeline;
}
