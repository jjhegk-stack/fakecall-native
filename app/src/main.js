// main.js — 엔트리: 부트스트랩(state.init) + render(state) 라우터 + 이벤트 바인딩.
// 단방향: 이벤트 → actions.* → setState → (구독된)render 자동 호출.
// render는 phase별로 항상 정확히 1개 뷰만 표시한다(SPEC §4 공통).
//
// 성능/포커스 주의: logic은 카운트다운/통화 tick마다 250ms 간격 setState를 호출 →
// render가 그때마다 불린다. 매번 innerHTML 전체 재빌드하면 (1)설정 입력 포커스가
// 튀고 (2)불필요한 DOM 작업이 잦다. 그래서 "phase가 바뀔 때만 뷰를 재빌드"하고,
// 같은 phase의 tick에서는 시간 텍스트/점멸 클래스만 부분 갱신한다.

import { init, getState } from './state.js';
import { renderSettings } from './views/settingsView.js';
import { renderIncoming } from './views/incomingView.js';
import { renderInCall } from './views/inCallView.js';
import { formatMMSS } from './views/format.js';

const app = document.getElementById('app');

// 이전 렌더의 phase. 같은 phase면 부분 갱신, 다르면 전체 재빌드.
let lastPhase = null;
// settings 내부 하위상태(idle ↔ scheduled) 전환 추적용.
let lastSettingsSub = null;

/**
 * render 라우터. state.phase로 분기.
 * @param {object} state
 */
function render(state) {
  const phase = state.phase;

  // scheduled는 settingsView 내부에서 그리되, idle↔scheduled 전환은 전체 재빌드 필요.
  const settingsSub = phase === 'scheduled' ? 'scheduled' : 'idle';
  const phaseChanged = phase !== lastPhase;
  const settingsViewChanged =
    isSettingsPhase(phase) && settingsSub !== lastSettingsSub;

  if (phaseChanged || settingsViewChanged) {
    rebuild(state);
  } else {
    patch(state); // 같은 뷰 — 텍스트/클래스만 갱신
  }

  lastPhase = phase;
  lastSettingsSub = isSettingsPhase(phase) ? settingsSub : null;
}

function isSettingsPhase(phase) {
  return phase === 'idle' || phase === 'scheduled';
}

/** 뷰 전체 재빌드(phase 전환 시). 한 시점 1뷰만 #app에 존재. */
function rebuild(state) {
  switch (state.phase) {
    case 'idle':
    case 'scheduled':
      renderSettings(app, state);
      break;
    case 'ringing':
      renderIncoming(app, state);
      break;
    case 'incall':
      renderInCall(app, state);
      break;
    case 'ended':
      // 즉시 idle로 환원되는 전이 phase — 다음 setState(idle)에서 그려짐. 화면은 유지.
      break;
    default:
      renderSettings(app, state);
  }
}

/** 같은 phase의 tick — 깜빡임/포커스 손실 없이 변하는 부분만 갱신. */
function patch(state) {
  if (state.phase === 'scheduled') {
    const el = app.querySelector('#countdownTime');
    if (el) el.textContent = formatMMSS(Math.max(0, state.remainingSec ?? 0));
    return;
  }
  if (state.phase === 'incall') {
    const el = app.querySelector('#elapsed');
    if (el) el.textContent = formatMMSS(Math.max(0, state.elapsedSec ?? 0));
    return;
  }
  if (state.phase === 'ringing') {
    // 진동 미지원 시각 폴백: visualFallbackOn boolean으로 점멸 클래스 토글.
    const screen = app.querySelector('#incomingScreen');
    if (screen) {
      screen.classList.toggle('is-flashing', state.visualFallbackOn === true);
    }
    return;
  }
  // idle: 입력 change로 인한 재렌더는 포커스 보존을 위해 전체 재빌드하지 않음.
  // 프리셋/커스텀 강조는 setTimer 후 전체 재빌드가 필요하므로 여기서 처리.
  if (state.phase === 'idle') {
    refreshSettingsHighlights(state);
  }
}

/**
 * idle 폼에서 setTimer 후 프리셋 강조/커스텀 값을 포커스 손실 없이 반영.
 * (전체 재빌드 대신 부분 갱신 — 입력 중 커서가 튀지 않게)
 */
function refreshSettingsHighlights(state) {
  const presets = app.querySelectorAll('.preset');
  if (!presets.length) return;
  const sec = state.timerSec;
  let matched = false;
  presets.forEach((btn) => {
    const on = Number(btn.dataset.sec) === sec;
    btn.classList.toggle('preset--active', on);
    if (on) matched = true;
  });
  // 프리셋과 일치하면(=프리셋 클릭) 커스텀 입력값을 비운다.
  const custom = app.querySelector('#customMinutes');
  if (custom && matched && document.activeElement !== custom) {
    custom.value = '';
  }
}

// --- 부트스트랩: init이 storage 프리필 + vibrationSupported 판정 + render 구독 + 초기 렌더 ---
init({ render });

// 디버깅/콘솔 점검용(선택)
window.__fakecall = { getState };
