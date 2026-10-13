import { useRef, type ComponentPropsWithRef } from 'react';

export type SearchFieldProps = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'children'
> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
};
export function SearchField({
  label,
  value,
  onValueChange,
  className = '',
  ref,
  disabled,
  readOnly,
  ...props
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      className={`ui-search-field ${className}`}
      data-disabled={disabled || undefined}
    >
      <img src="/assets/icons/search-field.svg" alt="" />
      <input
        {...props}
        disabled={disabled}
        readOnly={readOnly}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') return ref(node);
          if (ref) ref.current = node;
        }}
        type="search"
        aria-label={label}
        placeholder={props.placeholder ?? '권역·단지·구 검색'}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {value && !readOnly && (
        <button
          type="button"
          disabled={disabled}
          aria-label="검색어 지우기"
          className="ui-search-clear"
          onClick={() => {
            onValueChange('');
            inputRef.current?.focus();
          }}
        >
          <img src="/assets/icons/close-field.svg" alt="" />
        </button>
      )}
    </div>
  );
}
