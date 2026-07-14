package com.heartalarm.app;

import android.graphics.Bitmap;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    private static final String APP_URL = "https://heartalarm.lovable.app";
    private static final String ERROR_URL = "file:///android_asset/error.html";

    private boolean showingError = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final WebView webView = this.bridge.getWebView();
        webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (url != null && !url.equals(ERROR_URL)
                        && !url.startsWith("file:///android_asset/")) {
                    showingError = false;
                }
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onReceivedError(WebView view,
                                        WebResourceRequest request,
                                        WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    loadErrorPage(view);
                    return;
                }
                super.onReceivedError(view, request, error);
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view,
                                        int errorCode,
                                        String description,
                                        String failingUrl) {
                if (failingUrl == null || isMainFrameUrl(failingUrl)) {
                    loadErrorPage(view);
                    return;
                }
                super.onReceivedError(view, errorCode, description, failingUrl);
            }

            @Override
            public void onReceivedHttpError(WebView view,
                                            WebResourceRequest request,
                                            WebResourceResponse errorResponse) {
                if (request != null
                        && request.isForMainFrame()
                        && errorResponse != null
                        && errorResponse.getStatusCode() >= 500) {
                    loadErrorPage(view);
                    return;
                }
                super.onReceivedHttpError(view, request, errorResponse);
            }
        });
    }

    private boolean isMainFrameUrl(String url) {
        return url.startsWith(APP_URL)
                || url.startsWith("http://heartalarm.lovable.app");
    }

    private void loadErrorPage(WebView view) {
        if (showingError) return;

        showingError = true;
        view.stopLoading();
        view.loadUrl("about:blank");
        view.loadUrl(ERROR_URL);
    }
}
