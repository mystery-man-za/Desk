export function Spinner({
  label,
  size = 'medium',
}: {
  label?: string;
  size?: 'small' | 'medium' | 'large';
}) {
  return (
    <span
      aria-label={label ?? 'Loading'}
      className={`app-spinner spinner-${size}`}
      role="status"
    >
      <span aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}
