import {
  ExportQueueJob,
  ExportHistoryRecord,
  ProfessionalExportPreset,
  ExportJobStatus,
  DetectedEncoder,
} from '../types/export';
import { Project } from '../types/project';
import { buildFFmpegExportArgs, parseFFmpegProgress } from './ffmpeg';
import { CaptionStyle } from './captions/types';

const STORAGE_KEY_EXPORT_HISTORY = 'hl_export_history';

/**
 * Manages persistent export history records in localStorage
 */
export class ExportHistoryManager {
  public static getHistory(): ExportHistoryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_EXPORT_HISTORY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static addRecord(record: ExportHistoryRecord): void {
    try {
      const current = this.getHistory();
      const updated = [record, ...current.filter((r) => r.id !== record.id)].slice(0, 50);
      localStorage.setItem(STORAGE_KEY_EXPORT_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save export history record:', e);
    }
  }

  public static removeRecord(id: string): void {
    try {
      const current = this.getHistory();
      const updated = current.filter((r) => r.id !== id);
      localStorage.setItem(STORAGE_KEY_EXPORT_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to remove export history record:', e);
    }
  }

  public static clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_EXPORT_HISTORY);
    } catch {}
  }
}

function getNativeBridge(): import('../types/native').VnestNativeBridge | undefined {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).window && (globalThis as any).window.vnestNative) {
      return (globalThis as any).window.vnestNative;
    }
    if (typeof window !== 'undefined' && (window as any).vnestNative) {
      return (window as any).vnestNative;
    }
  } catch {}
  return undefined;
}

export type QueueJobListener = (jobs: ExportQueueJob[]) => void;

/**
 * Manages sequential execution of export jobs in the background
 */
export class ExportQueueManager {
  private static instance: ExportQueueManager;
  private jobs: ExportQueueJob[] = [];
  private listeners: Set<QueueJobListener> = new Set();
  private isProcessing = false;
  private currentJobCleanup: (() => void) | null = null;

  public static getInstance(): ExportQueueManager {
    if (!ExportQueueManager.instance) {
      ExportQueueManager.instance = new ExportQueueManager();
    }
    return ExportQueueManager.instance;
  }

  public reset(): void {
    this.jobs = [];
    this.isProcessing = false;
    this.currentJobCleanup = null;
    this.listeners.clear();
  }

  public getJobs(): ExportQueueJob[] {
    return [...this.jobs];
  }

  public subscribe(listener: QueueJobListener): () => void {
    this.listeners.add(listener);
    listener(this.getJobs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getJobs();
    for (const l of this.listeners) {
      try {
        l(snapshot);
      } catch (e) {
        console.error('Queue listener error:', e);
      }
    }
  }

  /**
   * Adds a new render job to the export queue
   */
  public enqueueJob(params: {
    project: Project;
    preset: ProfessionalExportPreset;
    destinationPath: string;
    useProxies: boolean;
    burnCaptions: boolean;
    tempSrtPath?: string;
    captionStyle?: CaptionStyle;
    elementPathMap?: Map<string, string>;
    blobPathMap?: Map<string, string>;
    lutPathMap?: Map<string, string>;
    tempFiles?: string[];
    assetPathResolver: (id: string) => string | null;
  }): ExportQueueJob {
    const jobId = 'job_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const ext = params.preset.format || 'mp4';
    const tempPath = `${params.destinationPath}.hl_tmp_${jobId}.${ext}`;

    const newJob: ExportQueueJob = {
      id: jobId,
      projectId: params.project.id,
      projectName: params.project.name,
      preset: params.preset,
      destinationPath: params.destinationPath,
      tempPath,
      useProxies: params.useProxies,
      burnCaptions: params.burnCaptions,
      status: 'queued',
      progress: 0,
      statusMessage: 'Queued for rendering...',
      createdAt: Date.now(),
    };

    // Store references on job metadata for execution
    (newJob as any)._execContext = {
      project: params.project,
      tempSrtPath: params.tempSrtPath,
      captionStyle: params.captionStyle,
      elementPathMap: params.elementPathMap,
      blobPathMap: params.blobPathMap,
      lutPathMap: params.lutPathMap,
      tempFiles: params.tempFiles || [],
      assetPathResolver: params.assetPathResolver,
    };

    this.jobs.push(newJob);
    this.notify();

    // Trigger queue processing
    this.processNext();

    return newJob;
  }

  /**
   * Cancels an active or queued job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return false;

    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.statusMessage = 'Cancelled while queued';
      job.completedAt = Date.now();
      this.recordToHistory(job);
      this.notify();
      return true;
    }

    if (job.status === 'rendering' || job.status === 'validating') {
      job.status = 'cancelled';
      job.statusMessage = 'Export cancelled by user';
      job.completedAt = Date.now();

      if (this.currentJobCleanup) {
        this.currentJobCleanup();
        this.currentJobCleanup = null;
      }

      const bridge = getNativeBridge();
      if (bridge?.cancelFFmpegExport) {
        try {
          await bridge.cancelFFmpegExport();
        } catch (e) {}
      }

      this.recordToHistory(job);
      this.isProcessing = false;
      this.notify();

      // Proceed to next queued item
      setTimeout(() => this.processNext(), 200);
      return true;
    }

    return false;
  }

  /**
   * Retries a failed or cancelled job
   */
  public retryJob(jobId: string): boolean {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) {
      return false;
    }

    job.status = 'queued';
    job.progress = 0;
    job.error = undefined;
    job.statusMessage = 'Queued for retry...';
    job.startedAt = undefined;
    job.completedAt = undefined;

    this.notify();
    this.processNext();
    return true;
  }

  /**
   * Removes a job from the queue
   */
  public removeJob(jobId: string): boolean {
    const index = this.jobs.findIndex((j) => j.id === jobId);
    if (index === -1) return false;

    const job = this.jobs[index];
    if (job.status === 'rendering' || job.status === 'validating') {
      this.cancelJob(jobId);
    }

    this.jobs.splice(index, 1);
    this.notify();
    return true;
  }

  /**
   * Clears all completed, failed, or cancelled jobs from queue
   */
  public clearFinishedJobs(): void {
    this.jobs = this.jobs.filter((j) => j.status === 'queued' || j.status === 'rendering' || j.status === 'validating');
    this.notify();
  }

  /**
   * Sequential worker processor
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing) return;

    const nextJob = this.jobs.find((j) => j.status === 'queued');
    if (!nextJob) return;

    this.isProcessing = true;
    nextJob.status = 'rendering';
    nextJob.startedAt = Date.now();
    nextJob.progress = 0;
    nextJob.statusMessage = 'Preparing filtergraph and initializing FFmpeg engine...';
    this.notify();

    const ctx = (nextJob as any)._execContext;
    if (!ctx || !ctx.project) {
      nextJob.status = 'failed';
      nextJob.error = 'Missing execution context';
      nextJob.statusMessage = 'Job execution context missing';
      nextJob.completedAt = Date.now();
      this.recordToHistory(nextJob);
      this.isProcessing = false;
      this.notify();
      this.processNext();
      return;
    }

    try {
      const effectiveResolver = (id: string): string | null => {
        if (ctx.elementPathMap?.has(id)) return ctx.elementPathMap.get(id)!;
        if (ctx.blobPathMap?.has(id)) return ctx.blobPathMap.get(id)!;
        const asset = ctx.project.assets.find((a: any) => a.id === id);
        if (nextJob.useProxies && asset?.proxyPath) {
          return asset.proxyPath;
        }
        return ctx.assetPathResolver(id);
      };

      const bridge = getNativeBridge();

      // Detect hardware vs software encoders
      let effectiveCodec = nextJob.preset.codec;
      if (bridge?.getAvailableEncoders) {
        try {
          const encRes = await bridge.getAvailableEncoders();
          if (encRes.success && encRes.encoders) {
            const chosen = encRes.encoders.find((e) => e.id === nextJob.preset.codec);
            if (chosen && !chosen.isAvailable) {
              // Gracefully fall back to software encoder
              effectiveCodec = chosen.fallbackEncoder || 'libx264';
              nextJob.statusMessage = `Hardware encoder unavailable, using ${effectiveCodec} fallback...`;
              this.notify();
            }
          }
        } catch (e) {}
      }

      nextJob.encoderUsed = effectiveCodec;

      const hasAudioResolver = (clip: any, resolvedPath: string): boolean => {
        if (clip.type === 'image' || clip.type === 'element' || clip.type === 'text') return false;
        const asset = ctx.project.assets.find((a: any) => a.id === clip.assetId || a.id === clip.id);
        if (asset) {
          if (asset.type === 'image') return false;
          if (asset.hasAudio === false) return false;
          if (asset.hasAudio === true) return true;
        }
        const lower = resolvedPath.toLowerCase();
        if (/\.(png|jpe?g|webp|gif|svg|bmp|ico|tiff?)$/.test(lower)) return false;
        return true;
      };

      // Build FFmpeg command arguments targeting temporary output path
      const { args } = buildFFmpegExportArgs(
        ctx.project,
        nextJob.preset,
        nextJob.tempPath || nextJob.destinationPath,
        effectiveResolver,
        {
          subtitleSrtPath: ctx.tempSrtPath,
          captionStyle: ctx.captionStyle,
          lutPathResolver: (clipId: string) => ctx.lutPathMap?.get(clipId) || null,
          encoderOverride: effectiveCodec,
          hasAudioResolver,
        }
      );

      nextJob.statusMessage = 'Rendering timeline frames...';
      this.notify();

      if (bridge?.startFFmpegExport) {
        const cleanupListener = bridge.onFFmpegProgress(({ line, totalDurationMs }) => {
          if (nextJob.status !== 'rendering') return;
          const pct = parseFFmpegProgress(line, totalDurationMs);
          if (pct !== null) {
            nextJob.progress = pct;
            nextJob.statusMessage = `Rendering frames (${pct}%)...`;
            this.notify();
          }
        });
        this.currentJobCleanup = cleanupListener;

        let res = await bridge.startFFmpegExport(
          args,
          ctx.project.durationMs,
          nextJob.tempPath,
          nextJob.destinationPath
        );

        cleanupListener();
        this.currentJobCleanup = null;

        // If hardware acceleration failed, automatically retry with software encoder
        if (!res.success && (nextJob.status as ExportJobStatus) !== 'cancelled' && effectiveCodec !== 'libx264' && effectiveCodec !== 'prores_ks') {
          console.warn(`Hardware encoder ${effectiveCodec} failed. Falling back to universal software encoder (libx264)...`);
          nextJob.statusMessage = `Encoder ${effectiveCodec} failed. Retrying with software CPU encoder (libx264)...`;
          effectiveCodec = 'libx264';
          nextJob.encoderUsed = 'libx264';
          this.notify();

          const fallbackArgs = buildFFmpegExportArgs(
            ctx.project,
            nextJob.preset,
            nextJob.tempPath || nextJob.destinationPath,
            effectiveResolver,
            {
              subtitleSrtPath: ctx.tempSrtPath,
              captionStyle: ctx.captionStyle,
              lutPathResolver: (clipId: string) => ctx.lutPathMap?.get(clipId) || null,
              encoderOverride: 'libx264',
              hasAudioResolver,
            }
          ).args;

          const retryCleanup = bridge.onFFmpegProgress(({ line, totalDurationMs }) => {
            if (nextJob.status !== 'rendering') return;
            const pct = parseFFmpegProgress(line, totalDurationMs);
            if (pct !== null) {
              nextJob.progress = pct;
              nextJob.statusMessage = `Rendering frames with software fallback (${pct}%)...`;
              this.notify();
            }
          });
          this.currentJobCleanup = retryCleanup;

          res = await bridge.startFFmpegExport(
            fallbackArgs,
            ctx.project.durationMs,
            nextJob.tempPath,
            nextJob.destinationPath
          );

          retryCleanup();
          this.currentJobCleanup = null;
        }

        if ((nextJob.status as ExportJobStatus) === 'cancelled') {
          // Already handled via cancelJob
          this.isProcessing = false;
          this.processNext();
          return;
        }

        if (res.success) {
          nextJob.status = 'completed';
          nextJob.progress = 100;
          nextJob.statusMessage = 'Video exported and validated successfully!';
          nextJob.completedAt = Date.now();
          nextJob.outputSizeBytes = res.fileSize;
          nextJob.durationSec = res.durationMs ? Math.round(res.durationMs / 1000) : undefined;
          nextJob.validated = res.validated !== false;
        } else {
          nextJob.status = 'failed';
          nextJob.error = res.error || 'Export failed during rendering or validation';
          nextJob.statusMessage = 'Export failed';
          nextJob.completedAt = Date.now();
        }
      } else {
        // Browser simulation mode
        for (let i = 0; i <= 100; i += 20) {
          if ((nextJob.status as ExportJobStatus) === 'cancelled') {
            this.isProcessing = false;
            this.processNext();
            return;
          }
          nextJob.progress = i;
          nextJob.statusMessage = `Simulating render (${i}%)...`;
          this.notify();
          await new Promise((r) => setTimeout(r, 120));
        }
        nextJob.status = 'completed';
        nextJob.progress = 100;
        nextJob.statusMessage = 'Render simulation completed';
        nextJob.completedAt = Date.now();
        nextJob.validated = true;
      }

      this.recordToHistory(nextJob);
    } catch (err: any) {
      nextJob.status = 'failed';
      nextJob.error = err?.message || 'Unexpected export failure';
      nextJob.statusMessage = 'Export failed';
      nextJob.completedAt = Date.now();
      this.recordToHistory(nextJob);
    } finally {
      // Clean up temporary files created for this export job
      try {
        const bridge = getNativeBridge();
        const deleteFn = bridge?.deleteFile || bridge?.deleteProxyFile;
        if (deleteFn) {
          const filesToDelete: string[] = [];
          if (ctx.tempSrtPath) filesToDelete.push(ctx.tempSrtPath);
          if (ctx.elementPathMap) {
            for (const v of ctx.elementPathMap.values()) {
              if (typeof v === 'string') filesToDelete.push(v);
            }
          }
          if (ctx.blobPathMap) {
            for (const v of ctx.blobPathMap.values()) {
              if (typeof v === 'string') filesToDelete.push(v);
            }
          }
          if (ctx.lutPathMap) {
            for (const v of ctx.lutPathMap.values()) {
              if (typeof v === 'string') filesToDelete.push(v);
            }
          }
          if (ctx.tempFiles && Array.isArray(ctx.tempFiles)) {
            for (const v of ctx.tempFiles) {
              if (typeof v === 'string') filesToDelete.push(v);
            }
          }

          for (const f of filesToDelete) {
            try {
              if (f) await deleteFn(f);
            } catch {}
          }
        }
      } catch (cleanupErr) {
        console.warn('Failed to clean up export temp files:', cleanupErr);
      }

      this.isProcessing = false;
      this.notify();
      // Continue to next queued item
      setTimeout(() => this.processNext(), 100);
    }
  }

  private recordToHistory(job: ExportQueueJob): void {
    if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
      return;
    }

    const durationSec =
      job.startedAt && job.completedAt
        ? Math.round((job.completedAt - job.startedAt) / 1000)
        : job.durationSec;

    const record: ExportHistoryRecord = {
      id: 'hist_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      jobId: job.id,
      projectId: job.projectId,
      projectName: job.projectName,
      presetName: job.preset.name,
      destinationPath: job.destinationPath,
      width: job.preset.width,
      height: job.preset.height,
      fps: job.preset.fps,
      codec: job.encoderUsed || job.preset.codec,
      format: job.preset.format || 'mp4',
      status: job.status as 'completed' | 'failed' | 'cancelled',
      fileSizeBytes: job.outputSizeBytes,
      durationSec,
      completedAt: new Date(job.completedAt || Date.now()).toISOString(),
      error: job.error,
    };

    ExportHistoryManager.addRecord(record);
  }
}
