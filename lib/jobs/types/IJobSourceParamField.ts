import type { IJobSourceKnownOption } from './IJobSourceKnownOption';

export interface IJobSourceParamField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  description?: string;
  knownOptions?: IJobSourceKnownOption[];
}
