// settingsView.js — 설정 화면(phase: idle) + 예약 카운트다운(phase: scheduled)
// 계약: actions.updateCaller / actions.setTimer / actions.schedule / actions.cancel 만 호출.
// setState·타이머 직접 호출 금지. render는 자동(state.js가 subscribe).

import { actions } from '../state.js';
import { formatMMSS, escapeHtml } from './format.js';

const PRESETS = [
  { label: '5분', sec: 300 },
  { label: '10분', sec: 600 },
];

const MIN_MINUTES = 1;
const MAX_MINUTES = 120;

/**
 * phase가 'idle' 또는 'scheduled'일 때 #app에 그릴 마크업/이벤트.
 * @param {HTMLElement} root - #app
 * @param {object} state
 */
export function renderSettings(root, state) {
  if (state.phase === 'scheduled') {
    renderCountdown(root, state);
  } else {
    renderForm(root, state);
  }
}

// --- 설정 입력 폼 (idle) ---
function renderForm(root, state) {
  const name = state.caller?.name ?? '';
  const number = state.caller?.number ?? '';
  const timerSec = state.timerSec ?? 300;

  // 프리셋이 아닌 값이면 커스텀으로 간주
  const isPreset = PRESETS.some((p) => p.sec === timerSec);
  const customMinutes = isPreset ? '' : Math.floor(timerSec / 60);

  root.innerHTML = `
    <main class="screen screen--settings" aria-label="설정">
      <header class="settings__header">
        <div class="settings__logo" aria-hidden="true">📞</div>
        <h1 class="settings__title">페이크콜</h1>
        <p class="settings__subtitle">설정한 시간 뒤 전화가 옵니다</p>
      </header>

      <form class="settings__form" id="settingsForm" autocomplete="off">
        <label class="field">
          <span class="field__label">발신자 이름</span>
          <input
            class="field__input" type="text" id="callerName"
            placeholder="발신자 이름" maxlength="30"
            value="${escapeHtml(name)}" />
        </label>

        <label class="field">
          <span class="field__label">발신자 번호</span>
          <input
            class="field__input" type="tel" id="callerNumber"
            placeholder="010-0000-0000"
            value="${escapeHtml(number)}" />
        </label>

        <div class="field">
          <span class="field__label">언제 전화가 올까요?</span>
          <div class="presets" id="presets" role="group" aria-label="타이머 프리셋">
            ${PRESETS.map(
              (p) => `
              <button type="button" class="preset ${
                p.sec === timerSec ? 'preset--active' : ''
              }" data-sec="${p.sec}">${p.label}</button>`
            ).join('')}
          </div>
          <label class="custom">
            <span class="custom__label">직접 입력</span>
            <span class="custom__inputwrap">
              <input
                class="field__input custom__input" type="number" id="customMinutes"
                inputmode="numeric" min="${MIN_MINUTES}" max="${MAX_MINUTES}" step="1"
                placeholder="1~120" value="${customMinutes}" />
              <span class="custom__unit">분</span>
            </span>
          </label>
        </div>

        <p class="settings__note" id="formNote" role="status"></p>

        <button type="submit" class="btn btn--primary" id="scheduleBtn">예약하기</button>

        <p class="settings__disclaimer">
          ※ 화면이 꺼지거나 탭이 백그라운드면 정확한 초가 아니라
          복귀 직후 울릴 수 있습니다. 탭을 닫으면 동작하지 않습니다.
          ${state.vibrationSupported ? '' : '<br />이 기기는 진동 미지원 → 화면 점멸로 알립니다.'}
        </p>
      </form>
    </main>
  `;

  const form = root.querySelector('#settingsForm');
  const nameInput = root.querySelector('#callerName');
  const numberInput = root.querySelector('#callerNumber');
  const customInput = root.querySelector('#customMinutes');
  const presets = root.querySelector('#presets');
  const note = root.querySelector('#formNote');

  // 발신자 입력 → actions.updateCaller
  const pushCaller = () =>
    actions.updateCaller(nameInput.value, numberInput.value);
  nameInput.addEventListener('input', pushCaller);
  numberInput.addEventListener('input', pushCaller);

  // 프리셋 선택 → actions.setTimer (DOM 강조는 클래스만 즉시 토글, 진실은 state)
  presets.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset');
    if (!btn) return;
    const sec = Number(btn.dataset.sec);
    customInput.value = '';
    note.textContent = '';
    actions.setTimer(sec); // → setState → 자동 render(프리셋 강조 반영)
  });

  // 커스텀 분 입력 → 분*60 후 setTimer
  customInput.addEventListener('input', () => {
    const minutes = Math.floor(Number(customInput.value));
    if (!customInput.value) return; // 비우는 중이면 대기
    if (!Number.isFinite(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      note.textContent = `${MIN_MINUTES}~${MAX_MINUTES}분 사이로 입력하세요.`;
      return;
    }
    note.textContent = '';
    // 프리셋 강조는 자동 render가 끄지만, 입력 중 재렌더로 포커스가 튀지 않게
    // setTimer만 호출(render가 customMinutes 값을 다시 채움).
    actions.setTimer(minutes * 60);
  });

  // 예약하기 → 유효성 보정 후 actions.schedule
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    pushCaller();

    // 커스텀 값이 입력돼 있으면 마지막으로 한 번 더 확정
    if (customInput.value) {
      const minutes = Math.floor(Number(customInput.value));
      if (!Number.isFinite(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
        note.textContent = `타이머는 ${MIN_MINUTES}~${MAX_MINUTES}분이어야 합니다.`;
        return;
      }
      actions.setTimer(minutes * 60);
    }

    const ok = actions.schedule(); // → phase 'scheduled' → 자동 render(카운트다운)
    if (!ok) {
      note.textContent = '타이머 값을 확인하세요(1분 이상).';
    }
  });
}

// --- 예약 카운트다운 (scheduled) ---
function renderCountdown(root, state) {
  const displayName = (state.caller?.name ?? '').trim() || '알 수 없음';
  const remaining = Math.max(0, state.remainingSec ?? 0);

  root.innerHTML = `
    <main class="screen screen--countdown" aria-label="예약 카운트다운">
      <div class="countdown__inner">
        <p class="countdown__caption">${escapeHtml(displayName)}님에게서<br />전화가 곧 옵니다</p>
        <div class="countdown__time" id="countdownTime" aria-live="polite">${formatMMSS(remaining)}</div>
        <p class="countdown__hint">화면을 켜둔 채 기다리세요</p>
        <button type="button" class="btn btn--danger countdown__cancel" id="cancelBtn">예약 취소</button>
      </div>
    </main>
  `;

  root.querySelector('#cancelBtn').addEventListener('click', () => {
    actions.cancel(); // → phase 'idle' → 자동 render(설정 폼)
  });
}
