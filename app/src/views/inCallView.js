// inCallView.js — 통화중 화면(phase: incall) — SPEC §4.4
// 계약: actions.endCall 만 호출. 경과시간은 state.elapsedSec(logic이 tick으로 갱신)를
// mm:ss로 표시할 뿐, UI는 자체 타이머를 돌리지 않는다(단방향).

import { actions } from '../state.js';
import { formatMMSS, escapeHtml } from './format.js';

/**
 * @param {HTMLElement} root - #app
 * @param {object} state
 */
export function renderInCall(root, state) {
  const name = (state.caller?.name ?? '').trim();
  const number = (state.caller?.number ?? '').trim();
  const displayName = name || '알 수 없음';
  const elapsed = Math.max(0, state.elapsedSec ?? 0);

  root.innerHTML = `
    <main class="screen screen--incall" aria-label="통화 중">
      <div class="incall__top">
        <h1 class="incall__name">${escapeHtml(displayName)}</h1>
        ${number ? `<p class="incall__number">${escapeHtml(number)}</p>` : ''}
        <p class="incall__elapsed" id="elapsed" aria-live="polite">${formatMMSS(elapsed)}</p>
        <p class="incall__status">통화 중</p>
      </div>

      <div class="incall__avatar" aria-hidden="true">
        <span>${escapeHtml((displayName || '?').charAt(0) || '?')}</span>
      </div>

      <div class="incall__actions">
        <div class="incall__action">
          <button type="button" class="circle circle--end" id="endBtn" aria-label="통화 종료">
            <span class="circle__icon">✆</span>
          </button>
          <span class="circle__label">종료</span>
        </div>
      </div>
    </main>
  `;

  root.querySelector('#endBtn').addEventListener('click', () => {
    actions.endCall(); // → phase 'idle' (통화 tick 정지는 logic)
  });
}
