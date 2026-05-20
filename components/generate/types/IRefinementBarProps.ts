export interface IRefinementBarProps {
  onSubmit: (instruction: string) => Promise<void>;
  busy: boolean;
  disabled?: boolean;
}
