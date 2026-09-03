package com.heartalarm.app;

import android.app.Activity;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdView;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Loads Google AdMob *native advanced* ads and hands the creative assets to the
 * web layer so they can be rendered as feed cards. A hidden NativeAdView keeps
 * impression / click reporting working through the official SDK views.
 */
@CapacitorPlugin(name = "NativeAd")
public class NativeAdPlugin extends Plugin {

    private static final AtomicBoolean sdkStarted = new AtomicBoolean(false);
    private final Map<String, NativeAdView> holders = new HashMap<>();
    private int counter = 0;

    @PluginMethod
    public void load(final PluginCall call) {
        final String adId = call.getString("adId");
        if (adId == null || adId.isEmpty()) {
            call.reject("adId is required");
            return;
        }
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }

        activity.runOnUiThread(() -> {
            if (sdkStarted.compareAndSet(false, true)) {
                MobileAds.initialize(activity, status -> {});
            }

            AdLoader adLoader = new AdLoader.Builder(activity, adId)
                .forNativeAd(nativeAd -> {
                    String id = "ad_" + (++counter);
                    NativeAdView adView = buildHiddenView(activity, nativeAd);
                    holders.put(id, adView);

                    JSObject ad = new JSObject();
                    ad.put("id", id);
                    ad.put("headline", nativeAd.getHeadline());
                    ad.put("body", nativeAd.getBody());
                    ad.put("advertiser", nativeAd.getAdvertiser() != null
                        ? nativeAd.getAdvertiser() : nativeAd.getStore());
                    ad.put("callToAction", nativeAd.getCallToAction());
                    if (nativeAd.getIcon() != null && nativeAd.getIcon().getUri() != null) {
                        ad.put("iconUrl", nativeAd.getIcon().getUri().toString());
                    }
                    if (!nativeAd.getImages().isEmpty()
                        && nativeAd.getImages().get(0).getUri() != null) {
                        ad.put("imageUrl", nativeAd.getImages().get(0).getUri().toString());
                    }
                    JSObject res = new JSObject();
                    res.put("ad", ad);
                    call.resolve(res);
                })
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        call.reject("no-fill: " + error.getMessage());
                    }
                })
                .build();

            adLoader.loadAd(new AdRequest.Builder().build());
        });
    }

    /** Simulates a tap on the ad's call-to-action so the click is reported to AdMob. */
    @PluginMethod
    public void click(final PluginCall call) {
        final String id = call.getString("id");
        final Activity activity = getActivity();
        if (id == null || activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            NativeAdView view = holders.get(id);
            if (view != null && view.getCallToActionView() != null) {
                view.getCallToActionView().performClick();
            }
            call.resolve();
        });
    }

    private NativeAdView buildHiddenView(Activity activity, NativeAd nativeAd) {
        NativeAdView adView = new NativeAdView(activity);
        TextView headline = new TextView(activity);
        headline.setText(nativeAd.getHeadline());
        TextView cta = new TextView(activity);
        cta.setText(nativeAd.getCallToAction());

        FrameLayout inner = new FrameLayout(activity);
        inner.addView(headline);
        inner.addView(cta);
        adView.addView(inner);
        adView.setHeadlineView(headline);
        adView.setCallToActionView(cta);
        adView.setNativeAd(nativeAd);

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(1, 1, Gravity.TOP | Gravity.START);
        adView.setLayoutParams(lp);
        adView.setAlpha(0f);

        ViewGroup root = activity.findViewById(android.R.id.content);
        if (root != null) {
            root.addView(adView);
            adView.setVisibility(View.VISIBLE);
        }
        return adView;
    }
}
