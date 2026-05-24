/**
 * Message protocol between the local screen Web Worker and the React
 * client driver. Kept in a shared file so both sides import the same
 * types and the compiler catches drift.
 */

export interface ILocalScreenJob {
  id: number;
  title: string;
  company: string;
  location?: string;
  descriptionMd?: string;
}

export interface ILocalScreenProfileSnapshot {
  headline?: string;
  summary?: string;
  skills?: string[];
  preferences?: string;
  /** Free text from careerContext.lookingFor. The most decisive signal
   *  about the kind of role the user actually wants. */
  lookingFor?: string;
  /** Free text from careerContext.avoiding. Often the only place
   *  things like "no intern roles" are stated explicitly. */
  avoiding?: string;
  /** Free text from careerContext.goals. */
  goals?: string;
}

export type TWorkerInbound =
  | { type: 'init'; webllmModelId: string }
  | {
      type: 'screen';
      job: ILocalScreenJob;
      profile: ILocalScreenProfileSnapshot;
    }
  | { type: 'terminate' };

export type TWorkerOutbound =
  | { type: 'progress'; text: string; progress: number }
  | { type: 'ready' }
  | {
      type: 'verdict';
      jobId: number;
      verdict: 'pass' | 'reject';
      reason: string;
    }
  | { type: 'error'; jobId?: number; message: string };
