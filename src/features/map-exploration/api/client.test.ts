import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapApi, MapApiError } from './client';
import { MapContractError } from './validation';
import {
  cityRecord,
  detailRecord,
  pinRecord,
  searchRecord,
  zoneRecord,
} from './test-data';

const bounds = { west: 126, south: 35, east: 130, north: 38 };
afterEach(() => vi.unstubAllGlobals());

function transport(body: unknown, status = 200) {
  const requests: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return requests;
}

describe('map read API', () => {
  it('uses same-origin GET paths, encodes IDs, and forwards cancellation for every endpoint', async () => {
    const signal = new AbortController().signal;
    const api = createMapApi();
    const cases = [
      { path: '/cities', body: [cityRecord], call: () => api.cities(signal) },
      {
        path: '/zones?west=126&south=35&east=130&north=38',
        body: [zoneRecord],
        call: () => api.zones(bounds, signal),
      },
      {
        path: '/complexes?west=126&south=35&east=130&north=38',
        body: [pinRecord],
        call: () => api.complexes(bounds, signal),
      },
      {
        path: '/zones/a%2Fb%20%3F',
        body: { ...detailRecord, zone: { ...zoneRecord, id: 'a/b ?' } },
        call: () => api.zone('a/b ?', signal),
      },
      {
        path: '/search?q=%EA%B0%95+%EB%82%A8',
        body: searchRecord,
        call: () => api.search('강 남', signal),
      },
    ];
    for (const { path, body, call } of cases) {
      const requests = transport(body);
      expect(await call()).toEqual(body);
      expect(requests).toEqual([
        {
          url: `/api/v1/map${path}`,
          init: {
            method: 'GET',
            signal,
            headers: { Accept: 'application/json' },
          },
        },
      ]);
    }
  });

  it.each([400, 404, 500])(
    'distinguishes HTTP %i and server codes from empty results',
    async (status) => {
      transport(
        { code: 'ZONE_NOT_FOUND', message: 'private server details' },
        status,
      );
      const request = createMapApi().zone(
        'missing',
        new AbortController().signal,
      );
      await expect(request).rejects.toBeInstanceOf(MapApiError);
      await expect(request).rejects.toMatchObject({
        status,
        code: 'ZONE_NOT_FOUND',
      });
      await expect(request).rejects.not.toThrow('private server details');
    },
  );

  it('does not expose proxy HTML or depend on error responses being JSON', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response('<html>private proxy details</html>', { status: 502 }),
    );
    await expect(
      createMapApi().cities(new AbortController().signal),
    ).rejects.toMatchObject({ status: 502, code: undefined });
  });

  it('rejects malformed successful JSON and does not coerce responses to an empty list', async () => {
    transport({ data: [] });
    await expect(
      createMapApi().cities(new AbortController().signal),
    ).rejects.toBeInstanceOf(MapContractError);
    vi.stubGlobal(
      'fetch',
      async () => new Response('not-json', { status: 200 }),
    );
    await expect(
      createMapApi().cities(new AbortController().signal),
    ).rejects.toBeInstanceOf(MapContractError);
    transport([]);
    await expect(
      createMapApi().cities(new AbortController().signal),
    ).resolves.toEqual([]);
  });

  it('rejects detail responses for a different requested zone', async () => {
    transport(detailRecord);
    await expect(
      createMapApi().zone('other-zone', new AbortController().signal),
    ).rejects.toBeInstanceOf(MapContractError);
  });

  it('validates bounds, ID and raw query length before making requests', async () => {
    const requests = transport([]);
    const api = createMapApi(),
      signal = new AbortController().signal;
    for (const invalid of [
      { ...bounds, east: 125 },
      { ...bounds, south: 39 },
      { ...bounds, west: Number.NaN },
      { ...bounds, north: 91 },
    ]) {
      await expect(api.zones(invalid, signal)).rejects.toBeInstanceOf(
        MapContractError,
      );
      await expect(api.complexes(invalid, signal)).rejects.toBeInstanceOf(
        MapContractError,
      );
    }
    for (const query of ['', '   ', 'a'.repeat(81)])
      await expect(api.search(query, signal)).rejects.toBeInstanceOf(
        MapContractError,
      );
    await expect(api.zone('  ', signal)).rejects.toBeInstanceOf(
      MapContractError,
    );
    expect(requests).toHaveLength(0);
    transport(searchRecord);
    await expect(api.search('a'.repeat(80), signal)).resolves.toEqual(
      searchRecord,
    );
  });

  it('preserves network and cancellation errors without wrapping them as contract errors', async () => {
    const networkError = new TypeError('Network unavailable');
    vi.stubGlobal('fetch', async () => {
      throw networkError;
    });
    await expect(
      createMapApi().cities(new AbortController().signal),
    ).rejects.toBe(networkError);
    const aborted = new AbortController();
    const reason = new DOMException('Cancelled', 'AbortError');
    aborted.abort(reason);
    const requests = transport([]);
    await expect(createMapApi().cities(aborted.signal)).rejects.toBe(reason);
    expect(requests).toHaveLength(0);
  });

  it('does not accept a late response from a transport that ignored abort', async () => {
    const controller = new AbortController();
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const request = createMapApi().cities(controller.signal);
    controller.abort();
    resolve(new Response(JSON.stringify([cityRecord])));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
