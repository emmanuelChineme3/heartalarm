package com.heartalarm.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
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
import com.google.android.gms.ads.VideoOptions;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Renders Google AdMob *native advanced* ads as a real, visible
 * {@link NativeAdView} overlaid on the WebView at the position of the feed's
 * ad placeholder. The Google view itself displays the creative assets and owns
 * all click handling, so impressions and clicks are registered by the SDK
 * exactly as AdMob policy requires — nothing is copied into HTML.
 */
@CapacitorPlugin(name = "NativeAd")
public class NativeAdPlugin extends Plugin {

    private static final AtomicBoolean sdkStarted = new AtomicBoolean(false);
    private final Map<String, NativeAdView> holders = new HashMap<>();
    private final Map<String, NativeAd> ads = new HashMap<>();
    private int counter = 0;

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value,
                getActivity().getResources().getDisplayMetrics()));
    }

    /**
     * Loads an ad and shows it at the given CSS-pixel rect (relative to the
     * WebView viewport). Resolves with { id } once the ad is on screen.
     */
    @PluginMethod
    public void show(final PluginCall call) {
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
        final float x = call.getFloat("x", 0f);
        final float y = call.getFloat("y", 0f);
        final float width = call.getFloat("width", 320f);
        final float height = call.getFloat("height", 320f);

        activity.runOnUiThread(() -> {
            if (sdkStarted.compareAndSet(false, true)) {
                MobileAds.initialize(activity, status -> {});
            }

            NativeAdOptions options = new NativeAdOptions.Builder()
                    .setVideoOptions(new VideoOptions.Builder().setStartMuted(true).build())
                    .build();

            AdLoader adLoader = new AdLoader.Builder(activity, adId)
                    .forNativeAd(nativeAd -> {
                        if (activity.isFinishing() || activity.isDestroyed()) {
                            nativeAd.destroy();
                            return;
                        }
                        String id = "ad_" + (++counter);
                        NativeAdView adView = buildAdView(activity, nativeAd);
                        applyRect(adView, x, y, width, height);

                        ViewGroup root = activity.findViewById(android.R.id.content);
                        if (root == null) {
                            nativeAd.destroy();
                            call.reject("no root view");
                            return;
                        }
                        root.addView(adView);
                        adView.bringToFront();
                        holders.put(id, adView);
                        ads.put(id, nativeAd);

                        JSObject res = new JSObject();
                        res.put("id", id);
                        res.put("headline", nativeAd.getHeadline());
                        call.resolve(res);
                    })
                    .withNativeAdOptions(options)
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

    /** Keeps the native overlay glued to the placeholder while the feed scrolls. */
    @PluginMethod
    public void move(final PluginCall call) {
        final String id = call.getString("id");
        final Activity activity = getActivity();
        if (id == null || activity == null) {
            call.resolve();
            return;
        }
        final float x = call.getFloat("x", 0f);
        final float y = call.getFloat("y", 0f);
        final float width = call.getFloat("width", 320f);
        final float height = call.getFloat("height", 320f);
        final boolean visible = Boolean.TRUE.equals(call.getBoolean("visible", true));

        activity.runOnUiThread(() -> {
            NativeAdView view = holders.get(id);
            if (view != null) {
                applyRect(view, x, y, width, height);
                view.setVisibility(visible ? View.VISIBLE : View.INVISIBLE);
                view.requestLayout();
            }
            call.resolve();
        });
    }

    /** Removes and destroys an ad overlay. */
    @PluginMethod
    public void hide(final PluginCall call) {
        final String id = call.getString("id");
        final Activity activity = getActivity();
        if (id == null || activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            NativeAdView view = holders.remove(id);
            if (view != null && view.getParent() instanceof ViewGroup) {
                ((ViewGroup) view.getParent()).removeView(view);
            }
            if (view != null) view.destroy();
            NativeAd ad = ads.remove(id);
            if (ad != null) ad.destroy();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        for (NativeAdView v : holders.values()) {
            if (v.getParent() instanceof ViewGroup) ((ViewGroup) v.getParent()).removeView(v);
            v.destroy();
        }
        holders.clear();
        for (NativeAd a : ads.values()) a.destroy();
        ads.clear();
        super.handleOnDestroy();
    }

    private void applyRect(View view, float x, float y, float width, float height) {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                dp(width), dp(height), Gravity.TOP | Gravity.START);
        lp.leftMargin = dp(x);
        lp.topMargin = dp(y);
        view.setLayoutParams(lp);
    }

    /**
     * Builds the visible card. Every asset is registered on the NativeAdView so
     * the SDK handles rendering, impressions and clicks.
     */
    private NativeAdView buildAdView(Activity activity, NativeAd nativeAd) {
        NativeAdView adView = new NativeAdView(activity);

        LinearLayout card = new LinearLayout(activity);
        card.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#17121B"));
        bg.setCornerRadius(dp(24));
        bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"));
        card.setBackground(bg);
        card.setClipToOutline(true);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        card.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Header: icon + headline/advertiser + "Ad" badge
        LinearLayout header = new LinearLayout(activity);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);

        ImageView icon = new ImageView(activity);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(40), dp(40));
        iconLp.rightMargin = dp(10);
        icon.setLayoutParams(iconLp);
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        if (nativeAd.getIcon() != null && nativeAd.getIcon().getDrawable() != null) {
            icon.setImageDrawable(nativeAd.getIcon().getDrawable());
        } else {
            icon.setVisibility(View.GONE);
        }
        header.addView(icon);

        LinearLayout titles = new LinearLayout(activity);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.setLayoutParams(new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView headline = new TextView(activity);
        headline.setText(nativeAd.getHeadline());
        headline.setTextColor(Color.WHITE);
        headline.setTypeface(null, Typeface.BOLD);
        headline.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        headline.setMaxLines(1);
        titles.addView(headline);

        TextView advertiser = new TextView(activity);
        String who = nativeAd.getAdvertiser() != null ? nativeAd.getAdvertiser() : nativeAd.getStore();
        advertiser.setText(who != null ? who : "Sponsored");
        advertiser.setTextColor(Color.parseColor("#99FFFFFF"));
        advertiser.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        advertiser.setMaxLines(1);
        titles.addView(advertiser);
        header.addView(titles);

        TextView badge = new TextView(activity);
        badge.setText("Ad");
        badge.setTextColor(Color.WHITE);
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        badge.setTypeface(null, Typeface.BOLD);
        badge.setPadding(dp(8), dp(2), dp(8), dp(2));
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setColor(Color.parseColor("#E83F75"));
        badgeBg.setCornerRadius(dp(10));
        badge.setBackground(badgeBg);
        header.addView(badge);

        card.addView(header);

        // Media (image or video) — the SDK fills this view.
        MediaView mediaView = new MediaView(activity);
        LinearLayout.LayoutParams mediaLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        mediaLp.topMargin = dp(10);
        mediaView.setLayoutParams(mediaLp);
        card.addView(mediaView);

        TextView body = new TextView(activity);
        body.setText(nativeAd.getBody());
        body.setTextColor(Color.parseColor("#CCFFFFFF"));
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        body.setMaxLines(2);
        LinearLayout.LayoutParams bodyLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bodyLp.topMargin = dp(8);
        body.setLayoutParams(bodyLp);
        if (nativeAd.getBody() == null) body.setVisibility(View.GONE);
        card.addView(body);

        TextView cta = new TextView(activity);
        cta.setText(nativeAd.getCallToAction());
        cta.setTextColor(Color.WHITE);
        cta.setTypeface(null, Typeface.BOLD);
        cta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        cta.setGravity(Gravity.CENTER);
        cta.setPadding(dp(16), dp(10), dp(16), dp(10));
        GradientDrawable ctaBg = new GradientDrawable();
        ctaBg.setColor(Color.parseColor("#E83F75"));
        ctaBg.setCornerRadius(dp(999));
        cta.setBackground(ctaBg);
        LinearLayout.LayoutParams ctaLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ctaLp.topMargin = dp(10);
        cta.setLayoutParams(ctaLp);
        if (nativeAd.getCallToAction() == null) cta.setVisibility(View.GONE);
        card.addView(cta);

        adView.addView(card);

        adView.setHeadlineView(headline);
        adView.setBodyView(body);
        adView.setAdvertiserView(advertiser);
        adView.setCallToActionView(cta);
        adView.setMediaView(mediaView);
        if (nativeAd.getIcon() != null) adView.setIconView(icon);
        adView.setNativeAd(nativeAd);

        return adView;
    }
}
