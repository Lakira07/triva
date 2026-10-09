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

## Athlete email accounts

Coaches can invite athletes by email from the Players view. Supabase sends the invitation link; the athlete sets their own password. The coach never handles or stores the athlete's password. Existing player-code login remains available while teams move existing players to email accounts.

Before using invitations in a deployed environment, install the Supabase CLI and link this workspace to the project with `npx supabase link --project-ref <project-ref>`, then:

- Apply the database migration with `npx supabase db push`.
- Deploy the invitation function with `npx supabase functions deploy invite-player`.
- Set the `SITE_URL` Edge Function secret to the deployed website origin, for example `https://triva.example.com`.
- Set the same origin as the Supabase Auth Site URL and add it to the Auth redirect URL allowlist.
- Configure Supabase Auth email delivery and the invitation email template.
- Ensure each coach signs in with the Supabase account assigned as that team's owner. The legacy trainer-code login cannot create athlete accounts.

The `player_auth_links` table contains only the Auth user ID and player ID. It does not store athlete email addresses in the broadly queried `players` table. Invitation provisioning runs with the Supabase service role inside the Edge Function; never put that key in the web app.
