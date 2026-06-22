// scheduler.js — 예약 setTimeout + 카운트다운/통화 setInterval (FAKE_CALL_SPEC §3)
// 핵심: scheduledAt(절대 목표 시각) 기준으로 매 tick마다 남은 시간을 재계산(드리프트 보정).
// 모든 타이머 핸들은 모듈 스코프 변수, clear 후 null 리셋(§3.5 누수 금지).

let fireId = null;   // 예약 setTimeout 핸들
let tickId = null;   // 카운트다운 setInterval 핸들
let callId = null;   // 통화 경과시간 setInterval 핸들

const TICK_MS = 250; // 표시 지연 최소화용 250ms 폴링(scheduledAt 기준 재계산이라 누적 오차 없음)

/**
 * 예약(T1). 재예약 전 항상 cancel() 호출(중복 타이머 누적 금지).
 * setTimeout 1차 + setInterval 카운트다운. fire 시 Date.now()>=scheduledAt 재확인.
 * @param {number} scheduledAt - 목표 시각(epoch ms)
 * @param {{onTick:(remainingSec:number)=>void, onFire:()=>void}} cb
 */
export function schedule(scheduledAt, { onTick, onFire }) {
  cancel(); // 기존 예약/카운트다운 정리

  const fireNow = () => {
    // 늦게 깨어나도(백그라운드 지연) 즉시 발화. 아직 안 됐으면 무시(tick이 처리).
    if (Date.now() >= scheduledAt) {
      cancel();
      if (typeof onFire === 'function') onFire();
    }
  };

  // 1차 타이머: 목표 시각까지 남은 시간(음수면 0)
  fireId = setTimeout(fireNow, Math.max(0, scheduledAt - Date.now()));

  // 카운트다운 tick: 매번 scheduledAt - now 재계산 → 드리프트 보정
  tickId = setInterval(() => {
    const remaining = Math.max(0, scheduledAt - Date.now());
    if (typeof onTick === 'function') onTick(Math.ceil(remaining / 1000));
    if (remaining <= 0) fireNow();
  }, TICK_MS);

  // 즉시 1회 tick(초기 표시 지연 방지)
  if (typeof onTick === 'function') {
    onTick(Math.ceil(Math.max(0, scheduledAt - Date.now()) / 1000));
  }
}

/**
 * 예약·카운트다운 정리(T2 취소 / T4 거절 방어 / 재예약 전). 중복 호출 안전.
 */
export function cancel() {
  if (fireId !== null) { clearTimeout(fireId); fireId = null; }
  if (tickId !== null) { clearInterval(tickId); tickId = null; }
}

/**
 * 통화 경과시간 tick 시작(T5). callStartedAt 기준 재계산(누적 합산 금지).
 * @param {number} callStartedAt - 통화 시작 시각(epoch ms)
 * @param {{onTick:(elapsedSec:number)=>void}} cb
 */
export function startCallTick(callStartedAt, { onTick }) {
  stopCallTick();
  const emit = () => {
    const elapsed = Math.floor((Date.now() - callStartedAt) / 1000);
    if (typeof onTick === 'function') onTick(Math.max(0, elapsed));
  };
  emit(); // 즉시 00:00 표시
  callId = setInterval(emit, TICK_MS);
}

/**
 * 통화 tick 정지(T6 종료). 중복 호출 안전.
 */
export function stopCallTick() {
  if (callId !== null) { clearInterval(callId); callId = null; }
}

/**
 * visibilitychange 복귀 안전망 판정(§3.4): 목표 시각이 이미 지났는지.
 * @param {number} scheduledAt
 * @returns {boolean} Date.now() >= scheduledAt
 */
export function checkOnVisible(scheduledAt) {
  return typeof scheduledAt === 'number' && Date.now() >= scheduledAt;
}
