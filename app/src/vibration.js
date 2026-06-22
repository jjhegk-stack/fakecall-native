// vibration.js — 진동 제어 (네이티브 Haptics > 웹 Vibration API > 시각 폴백)
// 번들러 없음: bare import 금지. 런타임 전역 window.Capacitor?.Plugins?.Haptics 접근.
// 네이티브 Capacitor WebView는 navigator.vibrate가 동작 안 하는 경우가 많아 Haptics로 진동.
// 사용자 제스처 차단 환경에서도 예외를 던지지 않도록 전체 try/catch.

const PATTERN = [500, 300, 500, 300];
const PATTERN_MS = 1600; // 웹 패턴 총 길이 ≈ 1.6s, 이 주기로 재호출해 반복
const HAPTICS_DURATION = 500; // 네이티브 1회 진동 길이(ms)
const HAPTICS_MS = 900;       // 네이티브 진동 반복 주기(ms): 수신 중 끊김 없이 지속

// 웹 Vibration API 지원 여부(정적). navigator.vibrate 존재 여부.
const webSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

let loopId = null;       // 웹 navigator.vibrate 반복 setInterval 핸들
let hapticsId = null;    // 네이티브 Haptics 반복 setInterval 핸들

/** Capacitor 네이티브 플랫폼인지(런타임 평가: Capacitor 후행 로드 대비). */
function isNativeHaptics() {
  try {
    return !!(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.Haptics);
  } catch {
    return false;
  }
}

/** Haptics 플러그인 핸들(없으면 undefined). */
function haptics() {
  return window.Capacitor?.Plugins?.Haptics;
}

/**
 * 진동 가능 여부(계약 유지: state.vibrationSupported = 실제 진동 가능 여부).
 * 네이티브 Haptics 또는 웹 navigator.vibrate 중 하나라도 되면 true.
 * @returns {boolean}
 */
export function isSupported() {
  return isNativeHaptics() || webSupported;
}

/**
 * ringing 진입 시 진동 시작(반복). 3분기:
 *  1) 네이티브+Haptics: Haptics.vibrate를 setInterval로 반복(fire-and-forget).
 *  2) 웹 navigator.vibrate: 기존 패턴 [500,300,500,300] 반복. false 반환 시 시각 폴백 ON.
 *  3) 둘 다 없음: onVisualFallback(true)로 시각 신호.
 * @param {(on:boolean)=>void} onVisualFallback - 폴백 필요 시 true로 호출(점멸 시작)
 */
export function start(onVisualFallback) {
  const fb = typeof onVisualFallback === 'function' ? onVisualFallback : () => {};

  // 1) 네이티브 Haptics 경로
  if (isNativeHaptics()) {
    const h = haptics();
    const fire = () => {
      try {
        // Promise지만 흐름을 막지 않도록 fire-and-forget(.catch로 흡수).
        h.vibrate({ duration: HAPTICS_DURATION })?.catch?.(() => {});
      } catch { /* 호출 자체 실패 흡수 */ }
    };
    fire(); // 즉시 1회
    if (hapticsId) clearInterval(hapticsId);
    hapticsId = setInterval(fire, HAPTICS_MS);
    return;
  }

  // 2) 웹 navigator.vibrate 경로
  if (webSupported) {
    try {
      // 즉시 1회. 반환값 false면 차단/조용한 실패 → 시각 폴백 ON.
      const ok = navigator.vibrate(PATTERN);
      fb(ok === false); // false 반환 시에만 점멸 ON, 성공이면 OFF 유지
      if (loopId) clearInterval(loopId);
      loopId = setInterval(() => {
        try {
          const ok2 = navigator.vibrate(PATTERN);
          if (ok2 === false) fb(true);
        } catch {
          fb(true);
        }
      }, PATTERN_MS);
    } catch {
      fb(true);
    }
    return;
  }

  // 3) 진동 불가 → 시각 폴백
  fb(true);
}

/**
 * 수락/거절 시 진동·폴백 정지. 모든 타이머 핸들 정리 후 null.
 * @param {(on:boolean)=>void} onVisualFallback - false로 호출(점멸 정지)
 */
export function stop(onVisualFallback) {
  if (hapticsId) {
    clearInterval(hapticsId);
    hapticsId = null;
  }
  if (loopId) {
    clearInterval(loopId);
    loopId = null;
  }
  if (webSupported) {
    try { navigator.vibrate(0); } catch { /* ignore */ }
  }
  if (typeof onVisualFallback === 'function') onVisualFallback(false);
}
