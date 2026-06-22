package site.scopelabs.fakecall;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

// 알람 발화 시 full-screen intent 알림을 띄운다.
// 잠금화면 위로 MainActivity(통화화면)를 자동 표시 + 진동.
public class CallAlarmReceiver extends BroadcastReceiver {

  private static final String CHANNEL_ID = "fakecall_fullscreen";
  private static final int NOTIF_ID = 4242;

  @Override
  public void onReceive(Context ctx, Intent intent) {
    String name = intent.getStringExtra("name");
    String number = intent.getStringExtra("number");
    String title = (name != null && !name.isEmpty()) ? name
        : (number != null && !number.isEmpty()) ? number : "알 수 없음";

    NotificationManager nm =
        (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(
          CHANNEL_ID, "전화 수신", NotificationManager.IMPORTANCE_HIGH);
      ch.enableVibration(true);
      ch.setVibrationPattern(new long[]{0, 500, 300, 500, 300});
      ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      nm.createNotificationChannel(ch);
    }

    // 통화화면(MainActivity)을 잠금화면 위로 띄울 full-screen intent
    Intent full = new Intent(ctx, MainActivity.class);
    full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
        | Intent.FLAG_ACTIVITY_CLEAR_TOP
        | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    full.putExtra("fakecall_ringing", true);
    full.putExtra("name", name);
    full.putExtra("number", number);

    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_IMMUTABLE;
    PendingIntent fsPi = PendingIntent.getActivity(ctx, 1, full, flags);

    NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.sym_call_incoming)
        .setContentTitle(title)
        .setContentText("전화가 왔습니다 — 탭하여 받기")
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setFullScreenIntent(fsPi, true)   // 잠금화면 위 자동 표시(핵심)
        .setContentIntent(fsPi)
        .setAutoCancel(true)
        .setOngoing(true);

    nm.notify(NOTIF_ID, b.build());

    // 가장 확실한 경로: "다른 앱 위에 표시(SYSTEM_ALERT_WINDOW)" 권한이 있으면
    // 백그라운드에서도 액티비티를 직접 띄울 수 있다 → 잠금화면 위 통화화면 즉시 표시 + 화면 점등.
    // (권한이 없으면 위 full-screen intent 알림으로 폴백)
    try {
      ctx.startActivity(full);
    } catch (Exception e) { /* 권한 없으면 알림 폴백 */ }
  }
}
