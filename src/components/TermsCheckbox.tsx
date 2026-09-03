import { cn } from '@/lib/utils';

interface TermsCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}

const TermsCheckbox = ({ id, checked, onChange, children }: TermsCheckboxProps) => (
  <label htmlFor={id} className="flex items-start gap-3 cursor-pointer min-h-12 py-1.5">
    <div className="relative mt-0.5 shrink-0">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div
        className={cn(
          'w-8 h-8 rounded-md border-2 transition-all flex items-center justify-center',
          checked
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/40 bg-background'
        )}
      >
        {checked && (
          <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </div>
    <span className="min-w-0 text-lg text-foreground/70 leading-snug break-words">{children}</span>
  </label>
);

export default TermsCheckbox;
