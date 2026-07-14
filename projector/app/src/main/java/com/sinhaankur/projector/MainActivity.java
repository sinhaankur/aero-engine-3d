package com.sinhaankur.projector;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Fullscreen WiFi kiosk for the HY300 projector. Boots straight into
 * BuildConfig.LAUNCH_URL (per-flavor: Live Aviation or Universe Engine) and
 * keeps retrying until the network is up, so it can be launched before the
 * projector has finished joining WiFi.
 */
public class MainActivity extends Activity {

    private static final long RETRY_MS = 5000;

    private WebView webView;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean lastLoadFailed = false;

    private final Runnable retry = new Runnable() {
        @Override
        public void run() {
            lastLoadFailed = false;
            webView.loadUrl(BuildConfig.LAUNCH_URL);
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    lastLoadFailed = true;
                    showWaitingScreen();
                    handler.removeCallbacks(retry);
                    handler.postDelayed(retry, RETRY_MS);
                }
            }
        });
        // Needed for the fullscreen API and WebGL context prompts on some sites.
        webView.setWebChromeClient(new WebChromeClient());

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        webView.loadUrl(BuildConfig.LAUNCH_URL);
    }

    private void showWaitingScreen() {
        String html = "<html><body style=\"background:#000;color:#8ab4f8;"
                + "font-family:sans-serif;display:flex;align-items:center;"
                + "justify-content:center;height:100vh;margin:0\">"
                + "<div style=\"text-align:center\">"
                + "<div style=\"font-size:28px\">Connecting…</div>"
                + "<div style=\"font-size:16px;opacity:.7;margin-top:12px\">"
                + "Waiting for WiFi — retrying automatically</div>"
                + "</div></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Remote's back button walks browser history before exiting the app.
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        if (lastLoadFailed) {
            handler.removeCallbacks(retry);
            handler.post(retry);
        }
    }

    @Override
    protected void onPause() {
        webView.onPause();
        handler.removeCallbacks(retry);
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
