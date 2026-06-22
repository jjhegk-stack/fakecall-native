// storage.js — localStorage 설정 영속화 (FAKE_CALL_SPEC §6)
// 키 fakecall.settings.v1 / try-catch로 비활성·파싱실패 흡수, 앱 크래시 금지.

const KEY = 'fakecall.settings.v1';

const DEFAULTS = Object.freeze({
  callerName: '',
  callerNumber: '',
  timerSec: 300,
});

/**
 * 저장된 설정 로드. 부재/파싱실패/비활성 시 기본값 반환.
 * @returns {{callerName:string, callerNumber:string, timerSec:number}}
 */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      callerName: typeof parsed.callerName === 'string' ? parsed.callerName : DEFAULTS.callerName,
      callerNumber: typeof parsed.callerNumber === 'string' ? parsed.callerNumber : DEFAULTS.callerNumber,
      timerSec: Number.isFinite(parsed.timerSec) && parsed.timerSec >= 1 ? parsed.timerSec : DEFAULTS.timerSec,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * 설정 저장(T1 예약 시 호출). 실패는 조용히 무시.
 * @param {string} callerName
 * @param {string} callerNumber
 * @param {number} timerSec
 */
export function saveSettings(callerName, callerNumber, timerSec) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      callerName: String(callerName ?? ''),
      callerNumber: String(callerNumber ?? ''),
      timerSec: Number(timerSec) || DEFAULTS.timerSec,
    }));
  } catch {
    /* localStorage 비활성(프라이빗 모드 등) — 무시 */
  }
}
