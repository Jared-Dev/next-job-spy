export interface IGreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  updated_at?: string;
  departments?: { id: number; name: string }[];
  offices?: { id: number; name: string }[];
}
