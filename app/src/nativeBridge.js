// nativeBridge.js — Capacitor 네이티브 알림 예약 브리지 (앱 닫혀도 OS 알림+진동)
// 번들러 없음: bare import 금지. 런타임 전역 window.Capacitor.Plugins.LocalNotifications 사용.
// 웹(브라우저)에서는 window.Capacitor가 undefined → 모든 함수가 조용히 no-op(가드 필수).
// smallIcon 지정 금지(기본값 사용).

// 예약 알림 고정 id(취소/재예약 시 동일 id로 덮어쓰기·삭제).
const NOTIF_ID = 4242;
// 채널 v2: 안드로이드는 기존 채널 id의 진동 설정을 변경 불가 → 새 id로 진동 포함 채널 재생성.
const CHANNEL_ID = 'fakecall_ring_v2';

/** Capacitor 네이티브 플랫폼(안드로이드 웹뷰)인지. 웹이면 false. */
export function isNative() {
  return !!(window.Capacitor?.isNativePlatform?.());
}

/** LocalNotifications 플러그인 핸들(없으면 undefined). */
function ln() {
  return window.Capacitor?.Plugins?.LocalNotifications;
}

/** 권한 요청 + 高중요도 알림 채널 생성. 웹/미지원이면 no-op. try/catch. */
export async function ensureReady() {
  const plugin = ln();
  if (!plugin) return;
  try {
    await plugin.requestPermissions?.();
  } catch (e) { /* 권한 거부/미지원 흡수 */ }
  try {
    await plugin.createChannel?.({
      id: CHANNEL_ID,
      name: '페이크콜 수신',
      description: '예약된 가짜 전화 알림',
      importance: 5,          // MAX(헤드업 + 소리/진동)
      vibration: true,
      visibility: 1,
    });
  } catch (e) { /* 채널 생성 실패 흡수(iOS 등 채널 미지원 포함) */ }
}

/** 목표 시각에 OS 알림 예약. 기존 예약 취소 후 고정 id로 재예약. 웹/미지원이면 no-op. */
export async function scheduleNative(scheduledAt, caller) {
  const plugin = ln();
  if (!plugin) return;
  try {
    await cancelNative();
    await plugin.schedule({
      notifications: [{
        id: NOTIF_ID,
        title: (caller?.name || caller?.number || '알 수 없음'),
        body: '전화가 왔습니다 — 탭하여 받기',
        channelId: CHANNEL_ID,
        schedule: { at: new Date(scheduledAt), allowWhileIdle: true },
        extra: { caller },
      }],
    });
  } catch (e) { /* 예약 실패 흡수 */ }
}

/** 예약된 OS 알림 취소. 웹/미지원이면 no-op. try/catch. */
export async function cancelNative() {
  const plugin = ln();
  if (!plugin) return;
  try {
    await plugin.cancel({ notifications: [{ id: NOTIF_ID }] });
  } catch (e) { /* 취소 실패 흡수 */ }
}

/**
 * 알림 탭으로 앱이 열릴 때 호출되는 리스너 등록.
 * @param {(caller:object|undefined)=>void} cb extra.caller를 인자로 받음
 */
export async function onNotificationTap(cb) {
  const plugin = ln();
  if (!plugin || typeof cb !== 'function') return;
  try {
    await plugin.addListener('localNotificationActionPerformed', (ev) => {
      cb(ev?.notification?.extra?.caller);
    });
  } catch (e) { /* 리스너 등록 실패 흡수 */ }
}
