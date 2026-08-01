/**
 * Everything the media queue carries. The payload is a discriminated union so a
 * processor branch and its data cannot disagree, and the job name is the same
 * discriminant so a queue dashboard reads the way the code does.
 */
export const MEDIA_QUEUE = 'media';

export type MediaJobData =
  /** An upload was confirmed: build derivatives and a blurhash for it. */
  | { kind: 'derivatives'; mediaId: string }
  /** Objects whose row is already gone. Retried until the bucket agrees. */
  | { kind: 'purge'; keys: string[] }
  /** Sweeps presigned uploads the host never completed. */
  | { kind: 'sweep' };

export type MediaJobKind = MediaJobData['kind'];

/** Repeatable, so the sweep survives a restart without being re-registered by hand. */
export const SWEEP_SCHEDULER_ID = 'media-abandoned-upload-sweep';
export const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
