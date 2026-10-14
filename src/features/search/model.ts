import type {
  Apartment,
  ExplorationData,
  MapLabel,
  Zone,
} from '../map-exploration/types';
export type HighlightPart = { text: string; match: boolean };
export type SearchTarget =
  | { kind: 'zone'; item: Zone }
  | { kind: 'gu'; item: MapLabel }
  | { kind: 'apartment'; item: Apartment; zone: Zone };
export type SearchResult = {
  id: string;
  name: string;
  context: string;
  nameParts: HighlightPart[];
  contextParts: HighlightPart[];
  position: number;
  target: SearchTarget;
};
export type SearchGroup = {
  kind: SearchTarget['kind'];
  results: SearchResult[];
};
type Range = { start: number; end: number };
/** Map every normalized UTF-16 unit back to its original code point span. */
function indexed(text: string) {
  let normalized = '',
    offset = 0;
  const spans: Range[] = [];
  for (const character of text) {
    const lower = /\s/u.test(character) ? '' : character.toLowerCase();
    normalized += lower;
    for (let i = 0; i < lower.length; i++)
      spans.push({ start: offset, end: offset + character.length });
    offset += character.length;
  }
  return { normalized, spans };
}
export function normalizeQuery(text: string) {
  return indexed(text).normalized;
}
function locate(text: string, query: string) {
  const { normalized, spans } = indexed(text);
  const position = query ? normalized.indexOf(query) : -1;
  return {
    position,
    range:
      position < 0
        ? undefined
        : {
            start: spans[position]!.start,
            end: spans[position + query.length - 1]!.end,
          },
  };
}
function parts(text: string, range?: Range): HighlightPart[] {
  if (!range || range.end <= 0 || range.start >= text.length)
    return text ? [{ text, match: false }] : [];
  const start = Math.max(0, range.start),
    end = Math.min(text.length, range.end);
  return [
    ...(start ? [{ text: text.slice(0, start), match: false }] : []),
    { text: text.slice(start, end), match: true },
    ...(end < text.length ? [{ text: text.slice(end), match: false }] : []),
  ];
}
export function highlightParts(text: string, query: string): HighlightPart[] {
  return parts(text, locate(text, normalizeQuery(query)).range);
}
export function matchCatalog(
  data: ExplorationData,
  rawQuery: string,
): SearchGroup[] {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];
  const groups: SearchGroup[] = [];
  const add = (
    kind: SearchGroup['kind'],
    targets: SearchTarget[],
    limit: number,
  ) => {
    const results: SearchResult[] = [];
    for (const target of targets) {
      const item = target.item;
      const context =
        target.kind === 'zone'
          ? (target.item.district ?? '')
          : target.kind === 'gu'
            ? `권역 ${data.zones.filter((z) => z.district === item.name).length}곳`
            : `${target.zone.district ?? ''} ${target.zone.name}`.trim();
      const direct = locate(item.name, query);
      let best = direct,
        nameRange = direct.range,
        contextRange: Range | undefined;
      if (target.kind === 'zone') {
        const prefix = `${context} `;
        const combined = locate(prefix + item.name, query);
        if (
          combined.position >= 0 &&
          (best.position < 0 || combined.position < best.position)
        ) {
          best = combined;
          nameRange = combined.range && {
            start: combined.range.start - prefix.length,
            end: combined.range.end - prefix.length,
          };
          contextRange = combined.range;
        }
      } else if (target.kind === 'gu') {
        const short = locate(item.name.replace(/[구시]$/u, ''), query);
        if (
          short.position >= 0 &&
          (best.position < 0 || short.position < best.position)
        ) {
          best = short;
          nameRange = short.range;
        }
      }
      if (best.position < 0) continue;
      results.push({
        id: item.id,
        name: item.name,
        context,
        nameParts: parts(item.name, nameRange),
        contextParts: parts(context, contextRange),
        position: best.position,
        target,
      });
    }
    results.sort(
      (a, b) =>
        a.position - b.position ||
        [...a.name].length - [...b.name].length ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    if (results.length) groups.push({ kind, results: results.slice(0, limit) });
  };
  add(
    'zone',
    data.zones.map((item) => ({ kind: 'zone', item })),
    5,
  );
  add(
    'gu',
    data.districts.map((item) => ({ kind: 'gu', item })),
    3,
  );
  const zones = new Map(data.zones.map((zone) => [zone.id, zone]));
  add(
    'apartment',
    data.apartments.flatMap((item) => {
      const zone = zones.get(item.zoneId);
      return zone ? [{ kind: 'apartment' as const, item, zone }] : [];
    }),
    6,
  );
  return groups;
}
