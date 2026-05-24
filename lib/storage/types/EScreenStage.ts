/**
 * Which stage of the cascade rejected a job (recorded on `screenedOutBy`).
 * Also identifies the stage in audit-log entries.
 */
export enum EScreenStage {
  Embedding = 'embedding',
  Local = 'local',
}
