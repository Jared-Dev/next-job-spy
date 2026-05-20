export interface ILeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  description?: string;
  descriptionPlain?: string;
  categories?: {
    team?: string;
    department?: string;
    location?: string;
    commitment?: string;
    allLocations?: string[];
  };
  createdAt?: number;
}
