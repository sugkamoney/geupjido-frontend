import { useState } from 'react';
import { ExplorationPage } from '../map-exploration/exploration-page';
import { createFixtureWorldcupSource, type FixtureScenario } from './source';
/** Isolated presentation scenarios, never product voting policies. */
export function WorldcupReviewPage() {
  const [source] = useState(() => {
    const value = new URLSearchParams(location.search).get('scenario');
    const scenarios: FixtureScenario[] = [
      'mixed',
      'hidden',
      'unavailable',
      'failure',
      'pending',
      'sparse',
      'long',
    ];
    return createFixtureWorldcupSource(
      scenarios.includes(value as FixtureScenario)
        ? (value as FixtureScenario)
        : 'mixed',
    );
  });
  return <ExplorationPage worldcupSource={source} />;
}
