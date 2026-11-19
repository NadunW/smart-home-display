package se.familydisplay.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedDispatcher;

/**
 * Full-screen wall display. Shows the family page, keeps the screen on, and
 * lets the page set the screen brightness (dim / wake rules live in the page,
 * where the family's appointments are).
 *
 * Hidden menu: tap the top-left corner five times within three seconds.
 */
public class MainActivity extends Activity {

    private static final long RETRY_MS = 20_000;
    private static final int CORNER_DP = 80;
    private static final int CORNER_TAPS = 5;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private WebView web;
    private boolean offline = false;
    private int cornerTaps = 0;
    private long cornerFirstTap = 0;

    private final Runnable retry = () -> {
        offline = false;
        web.loadUrl(BuildConfig.START_URL);
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " FamilyDisplayApp/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);

        web.addJavascriptInterface(new Bridge(), "FamilyDisplay");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new Client());

        if (state != null) web.restoreState(state);
        else web.loadUrl(BuildConfig.START_URL);

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }
        hideSystemBars();
    }

    // ---------- page <-> app ----------

    /** Called from the page's JavaScript as window.FamilyDisplay.*. */
    private class Bridge {
        /** 0.0–1.0 sets the brightness for this app; a negative value returns to the system setting. */
        @JavascriptInterface
        public void setBrightness(float level) {
            ui.post(() -> applyBrightness(level));
        }

        @JavascriptInterface
        public String version() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public void reload() {
            ui.post(() -> web.reload());
        }
    }

    private void applyBrightness(float level) {
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = level < 0
                ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
                : Math.max(0.004f, Math.min(1f, level));
        getWindow().setAttributes(lp);
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (BuildConfig.APP_HOST.equals(url.getHost())) return false;
            // Anything else (help links, email apps) opens outside the display.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showOffline();
        }
    }

    private void showOffline() {
        offline = true;
        String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#121116;color:#9a98a6;"
                + "font:20px system-ui,sans-serif;text-align:center}b{display:block;color:#f2f1f5;font-size:28px;margin-bottom:8px}</style>"
                + "</head><body><div><b>No connection</b>Trying again in a moment…</div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        ui.removeCallbacks(retry);
        ui.postDelayed(retry, RETRY_MS);
    }

    // ---------- kiosk ----------

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        if (ev.getActionMasked() == MotionEvent.ACTION_DOWN) {
            float corner = CORNER_DP * getResources().getDisplayMetrics().density;
            if (ev.getX() < corner && ev.getY() < corner) {
                long now = SystemClock.uptimeMillis();
                if (now - cornerFirstTap > 3000) {
                    cornerFirstTap = now;
                    cornerTaps = 0;
                }
                if (++cornerTaps >= CORNER_TAPS) {
                    cornerTaps = 0;
                    showMenu();
                }
            }
        }
        return super.dispatchTouchEvent(ev);
    }

    private void showMenu() {
        String[] items = {"Reload page", "Open Android settings", "Choose home screen app", "Close app"};
        new AlertDialog.Builder(this)
                .setTitle("Family Display " + BuildConfig.VERSION_NAME)
                .setItems(items, (d, which) -> {
                    if (which == 0) {
                        ui.removeCallbacks(retry);
                        offline = false;
                        web.loadUrl(BuildConfig.START_URL);
                    } else if (which == 1) {
                        startActivity(new Intent(Settings.ACTION_SETTINGS));
                    } else if (which == 2) {
                        startActivity(new Intent(Settings.ACTION_HOME_SETTINGS));
                    } else {
                        finishAndRemoveTask();
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void goBack() {
        if (!offline && web.canGoBack()) web.goBack();
        // Otherwise stay put: this is a wall display.
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        goBack();
    }

    // ---------- lifecycle ----------

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        ui.removeCallbacksAndMessages(null);
        web.destroy();
        super.onDestroy();
    }
}
