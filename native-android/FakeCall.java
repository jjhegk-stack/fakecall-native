package site.scopelabs.fakecall;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

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
    AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
    PendingIntent pi = buildPi(ctx, name, number);
    try {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    } catch (SecurityException e) {
      // 정확 알람 권한이 없으면 부정확 알람으로 폴백(앱 무중단)
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }
    call.resolve();
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    Context ctx = getContext();
    AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
    am.cancel(buildPi(ctx, "", ""));   // PendingIntent 매칭은 extras 무시(요청코드/액션 기준)
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
