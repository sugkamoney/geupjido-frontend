import type { IconName } from './icon-names';

const assets: Record<IconName, string> = {
  Search: 'search',
  Plus: 'plus',
  Minus: 'minus',
  Expand: 'expand',
  Close: 'close',
  Versus: 'versus',
  ChevronLeft16: 'chevron-left-16',
  ChevronRight16: 'chevron-right-16',
  Apartment16: 'apartment-16',
};

// Exports are cropped to vector bounds. Preserve natural SVG dimensions and
// center them in the original 24/16 grid, then scale the entire 24 grid to 20.
export function Icon({ name }: { name: IconName }) {
  const small = name.endsWith('16');
  return (
    <span
      aria-hidden="true"
      className={`ui-icon ${small ? 'ui-icon--small' : ''}`}
    >
      <span className="ui-icon-grid">
        <img src={`/assets/icons/${assets[name]}.svg`} alt="" />
      </span>
    </span>
  );
}
