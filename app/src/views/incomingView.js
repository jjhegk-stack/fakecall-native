// incomingView.js — 전체화면 수신화면(phase: ringing) — SPEC §4.3
// 디자인: LG U+ / 삼성 One UI "에이닷 전화" 수신화면 모사(검정 평면 배경).
// 계약: actions.reject / actions.accept 만 호출. 진동은 logic이 처리, UI는
// state.visualFallbackOn boolean만 보고 신호 클래스(is-signaling)를 토글한다(진동
// 미지원 폴백). 신호는 배경색을 바꾸지 않고 상태 텍스트/발신자 영역만 은은히 깜빡인다.

import { actions } from '../state.js';
import { escapeHtml } from './format.js';

// ── 손쉽게 바꿀 수 있도록 라벨/문구를 상단 상수로 분리(추후 설정 연동 여지) ──
const APP_LABEL = '에이닷 전화';                 // 통신사/앱 라벨
const STATUS_SUFFIX = '수신 중';                  // "<APP_LABEL> 수신 중···"

// 통화 이력 카드 문구(추후 설정 연동 여지로 한 곳에 모음)
const HISTORY = {
  recentLabel: '최근 6개월 통화',
  recentValue: '0회',
  lastLabel: '마지막 통화',
  lastValue: '없음',
  avgLabel: '평균 통화시간',
  avgValue: '없음',
  note: '이 번호와 통화하는 건 이번이 처음이에요.',
};

/** 사람 실루엣 SVG(이름이 없을 때 아바타에 표시) */
const PERSON_SVG = `
  <svg class="ic-call__person" viewBox="0 0 24 24" width="44" height="44"
       fill="#9a9a9e" aria-hidden="true">
    <circle cx="12" cy="8" r="4"></circle>
    <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5v.5H4V20z"></path>
  </svg>`;

/** 수화기 내림(거절) 아이콘 — 빨강, 아이콘만 */
const HANGUP_SVG = `
  <svg viewBox="0 0 24 24" width="34" height="34" fill="#ff3b30" aria-hidden="true"
       style="transform:rotate(135deg)">
    <path d="M20 15.5c-1.2 0-2.5-.2-3.6-.6-.4-.1-.8 0-1 .3l-2 2a15 15 0 0 1-6.6-6.6l2-2c.3-.2.4-.6.3-1C8.7 6.5 8.5 5.2 8.5 4c0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"></path>
  </svg>`;

/** 수화기(통화/수락) 아이콘 — 초록 */
const PHONE_SVG = `
  <svg viewBox="0 0 24 24" width="34" height="34" fill="#2ecc71" aria-hidden="true">
    <path d="M20 15.5c-1.2 0-2.5-.2-3.6-.6-.4-.1-.8 0-1 .3l-2 2a15 15 0 0 1-6.6-6.6l2-2c.3-.2.4-.6.3-1C8.7 6.5 8.5 5.2 8.5 4c0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"></path>
  </svg>`;

/** 벨소리 무음(음소거) 아이콘 — 어두운 색, 중앙 흰 원 안 */
const MUTE_SVG = `
  <svg viewBox="0 0 24 24" width="46" height="46" fill="#1a1a1c" aria-hidden="true">
    <path d="M16.5 12c0-1.8-1-3.3-2.5-4v1.6l2.5 2.4zM18.5 12c0 .6-.1 1.2-.2 1.7l1.5 1.5c.5-1 .7-2.1.7-3.2 0-3.5-2.4-6.4-5.5-7.3v2.1c2 .8 3.5 2.7 3.5 5.2zM4.3 3 3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.3c-.7.5-1.4.9-2.3 1.2v2.1c1.4-.3 2.7-1 3.8-1.8L19.7 21 21 19.7 4.3 3zM12 4 9.9 6.1 12 8.2V4z"></path>
  </svg>`;

/**
 * @param {HTMLElement} root - #app
 * @param {object} state
 */
export function renderIncoming(root, state) {
  const name = (state.caller?.name ?? '').trim();
  const number = (state.caller?.number ?? '').trim();
  // 이름 없으면 번호를 주 표시, 번호도 없으면 '알 수 없음'
  const primary = name || number || '알 수 없음';
  const secondary = name ? number : ''; // 이름이 있을 때만 번호를 보조로
  const hasName = name.length > 0;
  const fallbackOn = state.visualFallbackOn === true;

  // 아바타: 이름 있으면 첫 글자, 없으면 사람 실루엣
  const avatarInner = hasName
    ? `<span class="ic-call__initial">${escapeHtml(initialOf(primary))}</span>`
    : PERSON_SVG;

  root.innerHTML = `
    <main class="screen screen--incoming ${fallbackOn ? 'is-signaling' : ''}"
          id="incomingScreen" aria-label="전화 수신 중">

      <!-- 1) 앱 라벨 + 상태 (기기 시스템 상태바 아래) -->
      <p class="ic-call__applabel">${escapeHtml(APP_LABEL)} ${escapeHtml(STATUS_SUFFIX)}<span class="ic-call__ellipsis">···</span></p>

      <!-- 2) 발신자 행 (좌측 정렬) -->
      <div class="ic-call__caller">
        <div class="ic-call__avatar ${hasName ? 'has-name' : ''}">${avatarInner}</div>
        <div class="ic-call__id">
          <div class="ic-call__primary ${hasName ? '' : 'is-number'}">${escapeHtml(primary)}</div>
          ${secondary ? `<div class="ic-call__secondary">${escapeHtml(secondary)}</div>` : ''}
        </div>
      </div>

      <!-- 3) 통화 이력 카드 -->
      <div class="ic-card">
        <div class="ic-card__stats">
          <div class="ic-card__stat">
            <div class="ic-card__stat-label">${escapeHtml(HISTORY.recentLabel)}</div>
            <div class="ic-card__stat-value">${escapeHtml(HISTORY.recentValue)}</div>
          </div>
          <div class="ic-card__stat">
            <div class="ic-card__stat-label">${escapeHtml(HISTORY.lastLabel)}</div>
            <div class="ic-card__stat-value">${escapeHtml(HISTORY.lastValue)}</div>
          </div>
          <div class="ic-card__stat">
            <div class="ic-card__stat-label">${escapeHtml(HISTORY.avgLabel)}</div>
            <div class="ic-card__stat-value">${escapeHtml(HISTORY.avgValue)}</div>
          </div>
        </div>
        <p class="ic-card__note">${escapeHtml(HISTORY.note)}</p>
      </div>

      <!-- 4) 하단 통화 컨트롤 -->
      <div class="ic-controls">
        <!-- 거절(좌) -->
        <div class="ic-controls__side">
          <button type="button" class="ic-iconbtn ic-iconbtn--reject" id="rejectBtn" aria-label="거절">
            ${HANGUP_SVG}
          </button>
          <span class="ic-controls__label">거절</span>
        </div>

        <!-- 안쪽 향하는 초록 점/화살표(좌) -->
        <div class="ic-arrows ic-arrows--left" aria-hidden="true">
          <span class="ic-dot"></span><span class="ic-dot"></span><span class="ic-dot"></span>
          <span class="ic-chev">‹</span>
        </div>

        <!-- 중앙 큰 흰 원 = 벨소리 무음 -->
        <div class="ic-controls__center">
          <button type="button" class="ic-mutebtn" id="muteBtn" aria-label="벨소리 무음" aria-pressed="false">
            ${MUTE_SVG}
          </button>
        </div>

        <!-- 안쪽 향하는 초록 점/화살표(우) -->
        <div class="ic-arrows ic-arrows--right" aria-hidden="true">
          <span class="ic-chev">›</span>
          <span class="ic-dot"></span><span class="ic-dot"></span><span class="ic-dot"></span>
        </div>

        <!-- 통화/수락(우) -->
        <div class="ic-controls__side">
          <button type="button" class="ic-iconbtn ic-iconbtn--accept" id="acceptBtn" aria-label="통화 수락">
            ${PHONE_SVG}
          </button>
          <span class="ic-controls__label">통화</span>
        </div>
      </div>

      <!-- 5) 맨 아래 알약 -->
      <div class="ic-pill" role="group" aria-label="추가 동작">
        <button type="button" class="ic-pill__item" id="blockBtn">수신차단</button>
        <span class="ic-pill__sep" aria-hidden="true"></span>
        <button type="button" class="ic-pill__item" id="msgRejectBtn">메시지로 거절</button>
      </div>
    </main>
  `;

  // ── 이벤트: 계약상 actions.*만 호출(단방향) ──
  root.querySelector('#rejectBtn').addEventListener('click', () => {
    actions.reject(); // → phase 'idle' (진동/점멸 정지는 logic)
  });
  root.querySelector('#acceptBtn').addEventListener('click', () => {
    actions.accept(); // → phase 'incall'
  });
  // 맨 아래 알약: 수신차단 / 메시지로 거절 → 둘 다 수신 종료(reject)
  root.querySelector('#blockBtn').addEventListener('click', () => {
    actions.reject();
  });
  root.querySelector('#msgRejectBtn').addEventListener('click', () => {
    actions.reject();
  });

  // 중앙 음소거 버튼: 벨소리 무음 연출.
  // 계약을 깨지 않기 위해 UI 로컬로만 시각 폴백 신호 클래스(is-signaling)를 제거해
  // "조용히" 시키고 눌림 피드백을 준다. (진동 실제 정지는 미연동)
  // TODO: 추후 vibration silence 액션이 계약에 추가되면 여기서 연동.
  const muteBtn = root.querySelector('#muteBtn');
  const screen = root.querySelector('#incomingScreen');
  muteBtn.addEventListener('click', () => {
    muteBtn.classList.add('is-pressed');
    muteBtn.setAttribute('aria-pressed', 'true');
    screen.classList.remove('is-signaling'); // 시각 폴백 신호 정지(로컬)
  });
}

function initialOf(text) {
  const ch = (text || '?').trim().charAt(0);
  return ch || '?';
}
