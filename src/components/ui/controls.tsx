import type { ComponentPropsWithRef } from 'react';
import { Icon } from './icon';

type NativeButton = ComponentPropsWithRef<'button'>;
export function CloseButton({
  label,
  className = '',
  type = 'button',
  ...props
}: NativeButton & { label: string }) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      className={`ui-control ui-close ${className}`}
    >
      <img
        className="ui-close-default"
        src="/assets/icons/close-secondary.svg"
        alt=""
      />
      <span className="ui-close-active">
        <Icon name="Close" />
      </span>
    </button>
  );
}
export function MapControl({
  icon,
  label,
  className = '',
  type = 'button',
  ...props
}: NativeButton & { icon: 'Plus' | 'Minus' | 'Expand'; label?: string }) {
  return (
    <button
      {...props}
      type={type}
      aria-label={
        label ??
        { Plus: '지도 확대', Minus: '지도 축소', Expand: '지도 전체 보기' }[
          icon
        ]
      }
      className={`ui-control ui-map-control ${className}`}
    >
      <img src={`/assets/icons/${icon.toLowerCase()}-control.svg`} alt="" />
    </button>
  );
}
export function PanelHandle({
  expanded,
  label,
  className = '',
  type = 'button',
  ...props
}: NativeButton & { expanded: boolean; label?: string }) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label ?? (expanded ? '패널 접기' : '패널 펼치기')}
      aria-expanded={expanded}
      className={`ui-control ui-panel-handle ${className}`}
    >
      <img
        src={`/assets/icons/chevron-${expanded ? 'left' : 'right'}-handle.svg`}
        alt=""
      />
    </button>
  );
}
