import type { ComponentPropsWithRef } from 'react';

export type ButtonVariant = 'Gradient' | 'Primary' | 'Outline' | 'Subtle';
export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: ButtonVariant;
  crown?: boolean;
};

export function Button({
  variant = 'Primary',
  crown = false,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`ui-button ui-button--${variant.toLowerCase()} ${className}`}
    >
      {variant === 'Gradient' && (
        <img src="/assets/icons/versus-button.svg" alt="" />
      )}
      {crown && (
        <img className="ui-crown" src="/assets/images/crown.png" alt="" />
      )}
      <span>{children}</span>
    </button>
  );
}
