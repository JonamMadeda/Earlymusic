/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.luumbo.twa;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.core.content.FileProvider;
import java.io.File;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final String TAG = "LuumboLauncher";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Chrome 152+ checks that the caller holds a read grant on the splash
        // URI before receiveFile(). The app owns the provider, so it normally
        // has no recorded grant and Chrome rejects the hand-off — falling back
        // to Chrome's own startup art instead of our wordmark. Granting to
        // ourselves with PERSISTABLE writes the in-memory record Chrome wants.
        // This must happen before super.onCreate() starts the launch.
        grantSplashUriPermission();
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        

        return uri;
    }

    private void grantSplashUriPermission() {
        try {
            File splash = new File(getFilesDir(), "twa_splash/splash_image.png");
            Uri uri = FileProvider.getUriForFile(
                    this, getPackageName() + ".fileprovider", splash);
            grantUriPermission(getPackageName(), uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        } catch (Exception e) {
            // Never block the launch over the splash screen.
            Log.w(TAG, "Could not self-grant the splash URI permission", e);
        }
    }
}
