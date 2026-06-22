// vibration.js — Vibration API + 미지원 시각 폴백 신호 (FAKE_CALL_SPEC §5)
// 패턴 [500,300,500,300]을 setInterval(1600ms)로 반복. 미지원 시 onVisualFallback 콜백.
// 사용자 제스처 차단 환경에서도 예외를 던지지 않도록 전체 try/catch.

const PATTERN = [500, 300, 500, 300];
const PATTERN_MS = 1600; // 패턴 총 길이 ≈ 1.6s, 이 주기로 재호출해 반복

const supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

let loopId = null;

/** @returns {boolean} navigator.vibrate 지원 여부 */
export function isSupported() {
  return supported;
}

/**
 * ringing 진입 시 진동 시작(반복). 미지원이면 시각 폴백 ON 신호.
 * 지원하더라도 navigator.vibrate가 false를 반환하면(http 비보안·정책 차단으로 조용히 실패)
 * 시각 폴백을 ON 해 점멸로라도 알린다(안드로이드 http 사각지대 보완).
 * @param {(on:boolean)=>void} onVisualFallback - 폴백 필요 시 true로 호출(점멸 시작)
 */
export function start(onVisualFallback) {
  const fb = typeof onVisualFallback === 'function' ? onVisualFallback : () => {};
  if (supported) {
    try {
      // 즉시 1회. 반환값 false면 차단/조용한 실패 → 시각 폴백 ON.
      const ok = navigator.vibrate(PATTERN);
      fb(ok === false); // false 반환 시에만 점멸 ON, 성공이면 OFF 유지
      if (loopId) clearInterval(loopId);
      loopId = setInterval(() => {
        try {
          // 반복 중에도 지속적으로 false면 시각 폴백 유지(중복 호출 안전).
          const ok2 = navigator.vibrate(PATTERN);
          if (ok2 === false) fb(true);
        } catch {
          fb(true);
        }
      }, PATTERN_MS);
    } catch {
      // 진동 호출이 차단/예외여도 시각 폴백으로 대체
      fb(true);
    }
  } else {
    fb(true);
  }
}

/**
 * 수락/거절 시 진동·폴백 정지.
 * @param {(on:boolean)=>void} onVisualFallback - 미지원 시 false로 호출(점멸 정지)
 */
export function stop(onVisualFallback) {
  if (loopId) {
    clearInterval(loopId);
    loopId = null;
  }
  if (supported) {
    try { navigator.vibrate(0); } catch { /* ignore */ }
  }
  if (typeof onVisualFallback === 'function') onVisualFallback(false);
}
