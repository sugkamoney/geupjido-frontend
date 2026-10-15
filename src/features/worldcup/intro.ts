export const INTRO_KEY = 'geupjido.worldcup.intro.v1';
let shownInPage = false;
/** Mark on display, including closing the explanation without starting. */
export function claimIntroduction(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = null,
) {
  if (shownInPage) return false;
  shownInPage = true;
  try {
    const target = storage ?? window.localStorage;
    if (target.getItem(INTRO_KEY) === '1') return false;
    target.setItem(INTRO_KEY, '1');
  } catch {
    /* Page memory remains available when storage is blocked. */
  }
  return true;
}
