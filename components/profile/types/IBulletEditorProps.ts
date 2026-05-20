export interface IBulletEditorProps {
  label: string;
  description: string;
  values: string[];
  onChange: (next: string[]) => void;
  hideLabel?: boolean;
}
