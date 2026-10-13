import { useState } from 'react';
import { AppShell } from '../components/app-shell/app-shell';
import { ShellPreview } from './shell-preview';

export function ShellPage({ review = false }: { review?: boolean }) {
  const [query, setQuery] = useState('');
  if (review) return <ShellPreview />;
  return (
    <AppShell
      search={{ value: query, onValueChange: setQuery }}
      map={({ frame }) => (
        <div
          className="shell-map-placeholder"
          style={{
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          }}
        >
          <div>
            <h1>급지도</h1>
            <p>지도를 준비하고 있어요.</p>
          </div>
        </div>
      )}
    />
  );
}
