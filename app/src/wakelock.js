// wakelock.js — Screen Wake Lock API 래퍼 (FAKE_CALL_SPEC §3.4 한계 보완)
// 목적: scheduled/ringing 동안 화면이 꺼져 setTimeout/카운트다운이 보류되는 문제를 "완화"한다.
//      (주의: 화면을 켠 상태로 유지할 뿐, 화면 잠금/탭 종료까지 막지는 못한다 — 과장 금지.)
// - 미지원·비보안컨텍스트(HTTP)·예외는 모두 try/catch로 흡수하고 조용히 무시(앱 무중단).
// - wake lock은 탭이 백그라운드로 가면 OS가 자동 해제하므로, visible 복귀 시 "원래 켜두고
//   싶었다면(wanted=true)" 재획득하는 visibilitychange 안전망을 내부에 둔다.
// - UI는 이 모듈을 직접 호출하지 않는다. state.js의 phase 전이 부수효과에서만 배선된다.

let sentinel = null; // 현재 보유 중인 WakeLockSentinel | null
let wanted = false;  // "활성 상태로 유지하고 싶다"는 내부 의도 플래그(scheduled/ringing 동안 true)
let listenersBound = false;

const wakeLockApi =
  typeof navigator !== 'undefined' && 'wakeLock' in navigator
    ? navigator.wakeLock
    : null;

/** 보안 컨텍스트(HTTPS/localhost)인지. 비보안(HTTP)이면 Wake Lock은 동작하지 않으므로 조용히 무시. */
function isSecure() {
  return typeof window === 'undefined' || window.isSecureContext === true;
}

/** 실제 request 수행(내부). 실패는 흡수. */
async function requestLock() {
  if (!wakeLockApi || !isSecure()) return;
  if (sentinel) return; // 이미 보유 중이면 중복 요청 방지
  try {
    sentinel = await wakeLockApi.request('screen');
    // OS가 자동 해제(화면 꺼짐/백그라운드)하면 sentinel을 비워, visible 복귀 시 재획득되게 한다.
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // 미지원/정책 차단/사용자 제스처 요구 등 — 무시(앱 무중단)
    sentinel = null;
  }
}

/** 실제 release 수행(내부). 실패는 흡수. */
async function releaseLock() {
  if (!sentinel) return;
  const s = sentinel;
  sentinel = null;
  try {
    await s.release();
  } catch {
    /* ignore */
  }
}

/** visible 복귀 시 wanted였다면 재획득(백그라운드 자동 해제 보정). 1회만 바인딩. */
function bindVisibilityRebind() {
  if (listenersBound || typeof document === 'undefined') return;
  listenersBound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted && !sentinel) {
      requestLock();
    }
  });
}

/**
 * 화면 깨우기 시작(scheduled/ringing 진입 시 logic이 호출).
 * wanted=true로 두어 백그라운드 자동 해제 후 복귀 시 재획득되게 한다.
 */
export function acquire() {
  wanted = true;
  bindVisibilityRebind();
  requestLock();
}

/**
 * 화면 깨우기 해제(idle/incall/ended 등 그 외 phase에서 logic이 호출).
 * wanted=false로 두어 이후 복귀 시 재획득하지 않게 한다.
 */
export function release() {
  wanted = false;
  releaseLock();
}

/** @returns {boolean} Wake Lock API + 보안 컨텍스트 지원 여부(안내용, 선택) */
export function isSupported() {
  return !!wakeLockApi && isSecure();
}
