import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  icon?: ReactNode;
};

export function AppButton({
  children,
  className = '',
  variant = 'primary',
  icon,
  type = 'button',
  ...props
}: AppButtonProps) {
  return (
    <button
      className={`app-button ${variant}-button${className ? ` ${className}` : ''}`}
      type={type}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
