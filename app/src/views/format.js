// format.js — 뷰 공용 표시 헬퍼(순수 함수). DOM·state를 만지지 않는다.

/**
 * 초를 mm:ss로 포맷. 60분 이상이면 mm이 60을 넘어 표기(예: 90:00).
 * @param {number} totalSec
 * @returns {string}
 */
export function formatMMSS(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * HTML 인젝션 방지용 이스케이프(발신자 이름/번호가 innerHTML에 들어가므로 필수).
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
