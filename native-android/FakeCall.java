package site.scopelabs.fakecall;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 커스텀 Capacitor 플러그인: AlarmManager로 정확 시각 알람을 걸고,
// 발화 시 CallAlarmReceiver가 full-screen intent 알림을 띄운다.
// JS(nativeBridge.js)에서 window.Capacitor.Plugins.FakeCall로 호출.
@CapacitorPlugin(name = "FakeCall")
public class FakeCall extends Plugin {

  private static final int REQ = 4242;

  private PendingIntent buildPi(Context ctx, String name, String number) {
    Intent i = new Intent(ctx, CallAlarmReceiver.class);
    i.setAction("site.scopelabs.fakecall.RING");
    i.putExtra("name", name == null ? "" : name);
    i.putExtra("number", number == null ? "" : number);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(ctx, REQ, i, flags);
  }

  // schedule({ at: epochMs, name, number })
  @PluginMethod
  public void schedule(PluginCall call) {
    Double atD = call.getDouble("at", 0.0);   // ms 타임스탬프(큰 정수 → Double로 수신)
    long at = atD == null ? 0L : atD.longValue();
    String name = call.getString("name", "");
    String number = call.getString("number", "");
    Context ctx = getContext();
    // 권한 안내: "다른 앱 위에 표시"(가장 확실) 우선, 그게 이미 있으면 전체화면 알림 권한 보조 안내.
    if (ensureOverlayPermission(ctx)) {
      ensureFullScreenIntentPermission(ctx);
    }
    AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
    PendingIntent pi = buildPi(ctx, name, number);
    // setAlarmClock: 절전(Doze)에서도 정확히 발화하는 최고 우선순위 알람. 특별권한 불필요.
    // → "시간이 지나도 안 울리고 화면 깨우면 그제야 울림"(Doze 밀림) 문제 해결.
    try {
      int sFlags = PendingIntent.FLAG_UPDATE_CURRENT;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) sFlags |= PendingIntent.FLAG_IMMUTABLE;
      PendingIntent show = PendingIntent.getActivity(ctx, 7, new Intent(ctx, MainActivity.class), sFlags);
      am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), pi);
    } catch (Throwable t) {
      // 폴백: 정확 알람 → 부정확 알람
      try {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
      } catch (SecurityException e) {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
      }
    }
    call.resolve();
  }

  // "다른 앱 위에 표시(SYSTEM_ALERT_WINDOW)" 권한 확인. 없으면 설정 화면을 열고 false 반환.
  // 이 권한이 있으면 알람 시 백그라운드에서도 통화화면을 직접 띄울 수 있다(가장 확실).
  private boolean ensureOverlayPermission(Context ctx) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + ctx.getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        return false;   // 사용자가 허용 후 다시 예약하면 됨
      }
    } catch (Exception e) { /* 미지원/예외 흡수 → 허용된 것으로 간주 */ }
    return true;
  }

  // 안드로이드 14(API34)+: full-screen intent는 기본 차단 → 권한 없으면 해당 설정 화면을 연다.
  // 한 번 허용하면 canUseFullScreenIntent()가 true가 되어 다시 열지 않는다.
  private void ensureFullScreenIntentPermission(Context ctx) {
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        NotificationManager nm =
            (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && !nm.canUseFullScreenIntent()) {
          Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
          i.setData(Uri.parse("package:" + ctx.getPackageName()));
          i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          ctx.startActivity(i);
        }
      }
    } catch (Exception e) { /* 미지원/예외 흡수 */ }
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    Context ctx = getContext();
    AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
    am.cancel(buildPi(ctx, "", ""));   // PendingIntent 매칭은 extras 무시(요청코드/액션 기준)
    // 울리는 중인 포그라운드 서비스(연속 진동)도 종료 — 수락/거절/취소 시 진동 멈춤
    try { ctx.stopService(new Intent(ctx, CallForegroundService.class)); } catch (Exception e) { /* ignore */ }
    call.resolve();
  }

  // 앱이 알람(full-screen intent)으로 실행됐는지 + 발신자 정보 조회.
  // JS가 init 시 호출해 ringing으로 진입할지 판단.
  @PluginMethod
  public void getLaunchData(PluginCall call) {
    JSObject ret = new JSObject();
    boolean ringing = false;
    String name = "";
    String number = "";
    try {
      Intent it = getActivity().getIntent();
      if (it != null && it.getBooleanExtra("fakecall_ringing", false)) {
        ringing = true;
        name = it.getStringExtra("name");
        number = it.getStringExtra("number");
      }
    } catch (Exception e) { /* ignore */ }
    ret.put("ringing", ringing);
    ret.put("name", name == null ? "" : name);
    ret.put("number", number == null ? "" : number);
    call.resolve(ret);
  }
}
