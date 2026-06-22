// state.js — 단일 state + setState + 구독(render 트리거) + phase 전이 헬퍼(T1~T7)
// (FAKE_CALL_SPEC §2 상태머신 / §8 데이터흐름)
// 단방향: 사용자 입력 → actions.* → setState(patch) → 구독콜백(render) → views 렌더.
// logic 계층은 DOM을 만지지 않는다. 타이머/진동/storage 부수효과만 오케스트레이션.

import * as scheduler from './scheduler.js';
import * as vibration from './vibration.js';
import * as storage from './storage.js';
import * as wakelock from './wakelock.js';
import * as nativeBridge from './nativeBridge.js';

// --- 단일 state (외부에서 직접 mutate 금지, setState만 진입점) ---
const state = {
  phase: 'idle',
  caller: { name: '', number: '' },
  timerSec: 300,
  scheduledAt: null,
  ringStartedAt: null,
  callStartedAt: null,
  vibrationSupported: true,
  // UI 보조 파생키
  remainingSec: 0,
  elapsedSec: 0,
  visualFallbackOn: false,
};

const subscribers = new Set();

/** 현재 state 반환(읽기 전용 취급). */
export function getState() {
  return state;
}

/**
 * 상태 변경의 유일한 진입점. 얕은 병합(caller는 중첩 병합) 후 구독자 통지.
 * @param {object} patch
 * @returns {object} 변경된 state
 */
export function setState(patch) {
  if (patch && typeof patch === 'object') {
    if (patch.caller) {
      state.caller = { ...state.caller, ...patch.caller };
    }
    for (const k of Object.keys(patch)) {
      if (k === 'caller') continue;
      state[k] = patch[k];
    }
  }
  syncWakeLock();
  for (const fn of subscribers) {
    try { fn(state); } catch (e) { console.error('subscriber error', e); }
  }
  return state;
}

/**
 * render 콜백 등록. setState마다 fn(state) 호출. 해제 함수 반환.
 * @param {(state:object)=>void} fn
 * @returns {()=>void} unsubscribe
 */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// --- Wake Lock 배선(§3.4 보완): scheduled/ringing 동안만 화면을 깨워둔다. ---
// setState 후처리에서 phase에 따라 acquire/release. UI는 wakelock을 직접 호출하지 않는다.
// wakelock 자체가 미지원/비보안컨텍스트면 내부에서 조용히 무시되므로 분기 불필요.
function syncWakeLock() {
  if (state.phase === 'scheduled' || state.phase === 'ringing') {
    wakelock.acquire();
  } else {
    wakelock.release(); // idle / incall / ended
  }
}

// --- 시각 폴백 신호: vibration이 호출하는 콜백(점멸 ON/OFF를 state로 반영) ---
const onVisualFallback = (on) => setState({ visualFallbackOn: !!on });

// --- T3: 타이머 만료 → ringing (scheduler fire 콜백이 호출, UI는 호출 안 함) ---
// 알림 탭(네이티브)으로도 진입할 수 있어 'idle' 또는 'scheduled'에서만 허용한다.
// 이미 ringing/incall이면 무시(중복 진입 방지). caller override가 오면 state.caller로 반영.
function enterRinging(callerOverride) {
  if (state.phase === 'ringing' || state.phase === 'incall') return;
  // 알림 탭으로 idle에서 들어올 수 있으므로 예약 타이머는 방어적으로 정리.
  scheduler.cancel();
  nativeBridge.cancelNative().catch(() => {});
  const patch = {
    phase: 'ringing',
    ringStartedAt: Date.now(),
    // 미지원이면 vibration.start가 onVisualFallback(true)로 이미 설정함
  };
  if (callerOverride && typeof callerOverride === 'object') {
    patch.caller = {
      name: String(callerOverride.name ?? ''),
      number: String(callerOverride.number ?? ''),
    };
  }
  vibration.start(onVisualFallback);
  setState(patch);
}

// --- 전이 함수(actions): UI가 호출하는 유일한 동작 진입점 ---
export const actions = {
  /** (입력) 발신자 갱신. 저장은 예약(T1) 때. */
  updateCaller(name, number) {
    setState({ caller: { name: String(name ?? ''), number: String(number ?? '') } });
  },

  /** (입력) 타이머 설정(초). 유효(정수 1~7200초=1~120분)만 반영. */
  setTimer(timerSec) {
    const sec = Math.floor(Number(timerSec));
    if (!Number.isFinite(sec) || sec < 1 || sec > 7200) {
      console.warn('[setTimer] 무효 입력 무시:', timerSec);
      return;
    }
    setState({ timerSec: sec });
  },

  /** T1: 예약. 성공 시 true. */
  schedule() {
    const sec = state.timerSec;
    if (!Number.isFinite(sec) || sec < 1) {
      console.warn('[schedule] timerSec 무효, 예약 불가:', sec);
      return false;
    }
    const scheduledAt = Date.now() + sec * 1000;
    storage.saveSettings(state.caller.name, state.caller.number, sec);
    scheduler.schedule(scheduledAt, {
      onTick: (remainingSec) => setState({ remainingSec }),
      onFire: () => enterRinging(),
    });
    // 추가: 네이티브 OS 알림 예약(앱 닫혀도 울림). 웹은 no-op. fire-and-forget.
    nativeBridge.scheduleNative(scheduledAt, state.caller).catch(() => {});
    setState({ phase: 'scheduled', scheduledAt, remainingSec: sec });
    return true;
  },

  /** T2: 예약 취소 → idle. */
  cancel() {
    scheduler.cancel();
    nativeBridge.cancelNative().catch(() => {}); // 네이티브 예약 알림도 취소
    setState({ phase: 'idle', scheduledAt: null, remainingSec: 0 });
  },

  /** T4: 거절 → idle. 진동 정지 + 방어적 타이머 정리. */
  reject() {
    vibration.stop(onVisualFallback);
    scheduler.cancel();
    nativeBridge.cancelNative().catch(() => {}); // 네이티브 예약 알림도 취소
    setState({
      phase: 'idle',
      scheduledAt: null,
      ringStartedAt: null,
      visualFallbackOn: false,
    });
  },

  /** T5: 수락 → incall. 진동 정지 + 통화 tick 시작. */
  accept() {
    vibration.stop(onVisualFallback);
    nativeBridge.cancelNative().catch(() => {}); // 떴거나 불필요한 예약 알림 중복 제거
    const callStartedAt = Date.now();
    scheduler.startCallTick(callStartedAt, {
      onTick: (elapsedSec) => setState({ elapsedSec }),
    });
    setState({
      phase: 'incall',
      callStartedAt,
      elapsedSec: 0,
      visualFallbackOn: false,
    });
  },

  /** T6+T7: 종료 → ended → 즉시 idle. 통화 tick 정지. */
  endCall() {
    scheduler.stopCallTick();
    setState({ phase: 'ended' });
    setState({
      phase: 'idle',
      callStartedAt: null,
      scheduledAt: null,
      elapsedSec: 0,
    });
  },
};

/**
 * 부트 1회. storage 프리필 + vibrationSupported 판정 + visibilitychange 안전망 + render 구독.
 * @param {{render:(state:object)=>void}} deps
 */
export function init({ render } = {}) {
  // 1) 설정 복원
  const saved = storage.loadSettings();
  setState({
    caller: { name: saved.callerName, number: saved.callerNumber },
    timerSec: saved.timerSec,
    vibrationSupported: vibration.isSupported(),
    phase: 'idle',
  });

  // 2) render 구독(이후 모든 setState가 자동 render 트리거)
  if (typeof render === 'function') {
    subscribe(render);
    render(state); // 초기 1회 렌더
  }

  // 3) visibilitychange 안전망(§3.4): scheduled 복귀 시 이미 지났으면 즉시 ringing
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (state.phase === 'scheduled' && scheduler.checkOnVisible(state.scheduledAt)) {
        scheduler.cancel();
        enterRinging();
      }
    });
  }

  // 4) 네이티브 배선(웹은 전부 no-op). fire-and-forget.
  nativeBridge.ensureReady().catch(() => {});
  // 알림 탭으로 앱이 열리면 해당 caller로 즉시 ringing 진입(T3 동일 부수효과).
  // 이미 ringing/incall이면 enterRinging 내부 가드로 무시.
  nativeBridge.onNotificationTap((caller) => {
    enterRinging(caller);
  }).catch(() => {});
}
