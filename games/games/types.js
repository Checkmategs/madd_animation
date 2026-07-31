/**
 * Game module contract for pixel-games shell.
 *
 * @typedef {object} Keys
 * @property {boolean} a
 * @property {boolean} d
 * @property {boolean} w
 * @property {boolean} s
 * @property {boolean} wPressed  // edge: true for one update after keydown
 * @property {boolean} sPressed
 *
 * @typedef {object} GameHud
 * @property {number} score
 * @property {number} level
 * @property {number|null} lives
 * @property {'play'|'paused'|'over'} status
 *
 * @typedef {object} Game
 * @property {string} id
 * @property {string} title
 * @property {string} blurb
 * @property {string} controlsHint
 * @property {() => void} reset
 * @property {(dt: number, keys: Keys) => void} update
 * @property {(grid: Float32Array, gw: number, gh: number) => void} draw
 * @property {() => GameHud} getHud
 */

export {};
