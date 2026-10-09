# triva

## Environment setup

Create a `.env` file in the project root with your Supabase project credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_SHEETS_WEB_APP_URL=
VITE_OPENROUTER_API_KEY=
```

The Supabase values are required for authentication and database access. The Google Sheets and OpenRouter values are optional.

## Mobile app builds

Triva uses Capacitor to package the Vite app for iOS and Android. The website remains available separately.

- Run `npm run mobile:sync` after web changes to build the site and copy it into the native projects.
- Install Android Studio with its Android SDK to open and build the Android project with `npm run mobile:android`.
- On macOS, install full Xcode and CocoaPods, then run `npx cap add ios` once to create the iOS project. Open it with `npm run mobile:ios`.
- The configured app ID `com.triva.app` is provisional. Choose an identifier you control before release and update the native projects to match.

Website deployments and store app releases are separate. Changes bundled into a store app require a new app build and store submission.
