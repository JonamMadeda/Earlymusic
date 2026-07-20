# Early Music

## UI Direction

The app now follows a warmer, more branded visual system with a soft ivory background, elevated glass-like panels, and stronger red accents for primary actions.

### Completed So Far

- Shared shell refreshed with a lighter gradient background and more distinct desktop framing.
- The app now uses a white base with subtle pastel banners and neutral cards for contrast.
- Header, sidebar, bottom nav, and player now use a more consistent card-and-pill language.
- The app shell is now flush between sidebar and main with smaller corner radii.
- The main header was removed since the sidebar now carries the app identity.
- The bottom player now uses a tighter layout with cleaner controls and time display.
- Home page now focuses on featured, newest, and recommended song rails.
- A dedicated `/songs` page now provides a clean, distraction-free full library view.
- The songs page now uses a slim search bar and filter toggle instead of a large banner or panel.
- Home and search banners now use softer pastel accents for visual contrast.
- Navigation now exposes the songs page across desktop and mobile entry points.
- Sidebar is reduced to a minimal primary nav plus account action.
- Search page now matches the same browsing language with better results density and a clearer empty state.
- Song rows now feel more premium with richer hover states, badges, and more deliberate spacing.
- Library and playlists empty states were aligned with the new visual tone.

### Next Phases

- Improve modal and admin surfaces.
- Add stronger loading states and micro-interactions.
- Refine playlist detail interactions and overall accessibility.

## Cloudflare R2 uploads

Audio uploads use a short-lived presigned URL from `POST /api/upload`; R2 credentials stay on the server. Set `R2BUCKETNAME` in `.env.local` to the real bucket name before uploading.

Configure the R2 bucket CORS policy to allow browser `PUT` requests from your deployed site and `http://localhost:3000` during development:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

Run `lib/migration.sql` in the Supabase SQL editor to create the `audio_tracks` table and its row-level security policies.

## Administrator access

The `/admin` dashboard and R2 signing endpoint require a Supabase account with an `admin` row in `public.user_roles`; the former browser password is not used. After the migration runs, grant access in the Supabase SQL editor using your administrator's user ID:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR_AUTH_USER_UUID', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

Sign out and back in after granting the role. Do not put administrative roles in `user_metadata`, since users can edit that data themselves.

To grant roles later from the dashboard, set the server-only `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or your deployment environment. Create the user through Supabase Auth first, then enter their email in the **Administrator access** panel on `/admin`. Never expose the service-role key in client-side environment variables.
