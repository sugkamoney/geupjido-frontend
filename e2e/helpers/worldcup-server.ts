import { createServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import {
  gameRecord,
  progressRecord,
} from '../../src/features/worldcup/api/test-data';
import {
  cityRecord,
  zoneRecord,
  pinRecord,
  detailRecord,
} from '../../src/features/map-exploration/api/test-data';

/** Isolated HTTPS transport, no proxy to shared API or database. */
export async function startWorldcupServer() {
  const dir = await mkdtemp(join(tmpdir(), 'geupjido-worldcup-'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      join(dir, 'key.pem'),
      '-out',
      join(dir, 'cert.pem'),
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=IP:127.0.0.1,DNS:localhost',
    ],
    { stdio: 'ignore' },
  );
  const [key, cert] = await Promise.all([
    readFile(join(dir, 'key.pem')),
    readFile(join(dir, 'cert.pem')),
  ]);
  let game = gameRecord(),
    hasGame = false,
    votes = 0,
    cookieReads = 0;
  const server = createServer({ key, cert }, async (req, res) => {
    const path = new URL(req.url ?? '/', 'https://localhost').pathname;
    const json = (value: unknown, status = 200) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(value));
    };
    const identified =
      req.headers.cookie?.includes('gjd_uid=isolated-https-browser') ?? false;
    if (path.startsWith('/api/v1/map/'))
      return json(
        path.endsWith('/cities')
          ? [cityRecord]
          : path.endsWith('/zones')
            ? [zoneRecord]
            : path.endsWith('/complexes')
              ? [pinRecord]
              : detailRecord,
      );
    if (path === '/api/v1/worldcup/progress')
      return json({
        ...progressRecord,
        completedRounds: votes,
        remainingRounds: 60 - votes,
        roundsUntilNextMilestone: 30 - votes,
      });
    if (path === '/api/v1/worldcup/timeline') return json({ items: [] });
    if (path === '/api/v1/worldcup/games' && req.method === 'POST') {
      hasGame = true;
      res.setHeader(
        'Set-Cookie',
        'gjd_uid=isolated-https-browser; HttpOnly; Secure; SameSite=Lax; Path=/',
      );
      return json(game, 201);
    }
    if (path === '/api/v1/worldcup/games/current') {
      if (!hasGame || !identified) return json({ code: 'GAME_NOT_FOUND' }, 404);
      cookieReads++;
      return json({ ...game, roundResult: null });
    }
    if (
      path.includes('/worldcup/games/current/rounds/') &&
      req.method === 'PUT'
    ) {
      if (!identified) return json({ code: 'GAME_NOT_FOUND' }, 404);
      let body = '';
      for await (const chunk of req) body += String(chunk);
      const n = Number(path.split('/').at(-2));
      if (
        path.endsWith('/vote') &&
        JSON.parse(body).selectedComplexId === `left-${n}` &&
        game.nextRoundNumber === n
      ) {
        votes++;
        game = gameRecord(votes);
        game.roundResult = {
          roundNumber: n,
          available: false,
          leftPercent: null,
          rightPercent: null,
        };
        return json(game);
      }
      return json({ code: 'INVALID_VOTE' }, 400);
    }
    const root = resolve('dist-e2e/fixture');
    const filename = path.startsWith('/assets/')
      ? resolve(root, '.' + path)
      : join(root, 'index.html');
    if (!filename.startsWith(root + '/')) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const body = await readFile(filename);
      const type =
        (
          {
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.woff2': 'font/woff2',
          } as Record<string, string>
        )[extname(filename)] ?? 'text/html';
      res.writeHead(200, { 'Content-Type': type });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing address');
  return {
    url: `https://127.0.0.1:${address.port}`,
    stats: () => ({ votes, cookieReads }),
    close: async () => {
      await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
      await rm(dir, { recursive: true, force: true });
    },
  };
}
