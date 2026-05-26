/**
 * Which stage of the cascade rejected a job (recorded on `screenedOutBy`).
 * Also identifies the stage in audit-log entries.
 */
export enum EScreenStage {
  /**
   * Stage 1, at ingest: posting language not in the user's allowedLanguages
   * setting. Cheaper to reject here than to embed or run the local LLM
   * against text the user can't read.
   */
  Language = 'language',
  Embedding = 'embedding',
  Local = 'local',
}
