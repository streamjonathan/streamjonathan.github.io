# Email sign-in for article comments — patch for the comments branch

Status: ready to apply when `article-comments-social` merges. Do NOT apply
to main before then — the comments files do not exist on main yet.

## What is already done

Email sign-in is built on the `email-signin` branch in the main Worker
(`site-ai/src/index.js`) and on `/share-your-story/`. A reader who signs
in with email gets the same `isession-<rand>` session cookie as Google
and Instagram sign-ins (1 hour, HttpOnly, Secure, SameSite=Lax), with
provider `"email"`. The session carries the verified email address
server-side only; `/api/interview/me` never returns it.

## Why a patch is needed

The comments feature (branch `article-comments-social`) does NOT use the
interview session. `handlePostComment` in `site-ai/src/comments.js`
requires a Google ID token in the POST body and takes the name and photo
from the token. An email (or Instagram) session on its own cannot post a
comment until the handler also accepts a valid interview session.

## Worker change — `site-ai/src/comments.js`

1. Share the session reader with the comments module. The main Worker
   already has `getInterviewSession(request, env)` (reads the
   `interview_session` cookie and looks up `isession-<id>` in the NOTES
   KV namespace). When the branch merges, move that helper (and
   `randomHex`) into one shared module both files use, or duplicate the
   two functions into `comments.js`. Do not invent a second session
   cookie — the comments handler must read the same `isession` cookie
   the interview form uses.

2. In `handlePostComment`, accept EITHER a Google credential OR a valid
   interview session. Replace the credential-only check at the top of
   the handler with:

   ```js
   // Identity: a Google ID token, or a signed-in interview session
   // (Google, Instagram, or email). The session cookie is read, never
   // a value from the request body — nobody can post as someone else.
   let payload = null;
   let session = null;
   if (body.credential) {
     payload = await verifyGoogleToken(body.credential, env);
     if (!payload) return commentJson(request, { error: "Sign in with Google first — that sign-in did not check out." }, 401);
   } else {
     session = await getInterviewSession(request, env);
     if (!session) return commentJson(request, { error: "Sign in first — with Google, Instagram, or email — so the site knows the comment is really yours." }, 401);
   }
   ```

   The rest of the handler then uses one identity. Where it currently
   reads the name and avatar from the token payload, use:

   ```js
   const name = payload
     ? String(payload.name || "A reader").slice(0, 100)
     : String((session && session.name) || "A reader").slice(0, 100);
   const avatar = payload &&
     typeof payload.picture === "string" &&
     payload.picture.startsWith("https://lh3.googleusercontent.com/")
     ? payload.picture
     : "";
   // For Jonathan only: the verified email of an email session, so he
   // can reply. Never returned in the public list (see below).
   const email = session && session.provider === "email" ? (session.email || "") : "";
   ```

   And where the comment record is built, add the email field and keep
   the status rule (only the site owner's Google account is approved
   straight away; an email session is never the owner):

   ```js
   const comment = {
     post,
     kind: "comment",
     status: payload && payload.email === env.ADMIN_EMAIL ? "approved" : "pending",
     name,
     avatar,
     email,
     text,
     video,
     videoId,
     social,
     socialLabel,
     author: !!(payload && payload.email === env.ADMIN_EMAIL),
     at,
   };
   ```

3. In `handleListComments`, the public projection already lists fields
   one by one — do NOT add `email` to it. The address stays in KV for
   Jonathan only. (The digest that emails him new comments should
   include it, the same way the interview digest includes the
   submitter's identity.)

## Front-end change — `js/comments.js` (branch)

The comment box currently keeps a Google ID token in memory and sends
it with every post. Add a session check alongside it:

1. On load, call `GET /api/interview/me`. If it answers
   `signedIn: true`, the reader may post without a Google token:
   send the POST with no `credential` field (the Worker reads the
   session cookie) and show "Commenting as <name>" in the `comments-as`
   line, using `me.name` (or "Signed in with email" when the provider
   is `"email"` and no name is set).
2. If the reader is not signed in by any method, keep the current
   behaviour: show the Google sign-in button, plus a line pointing to
   the email option on `/share-your-story/` ("Or sign in with email
   there — a code is sent to your address").
3. Do not store the email address, the session id, or any token in
   localStorage. The Google token stays in memory only, as now; the
   session stays in its HttpOnly cookie.

## What does NOT change

- Google sign-in for comments works exactly as before.
- Admin approve/delete still need a fresh Google token from the owner's
  account (`ADMIN_EMAIL`); an email session can never approve.
- Comments stay pending until Jonathan approves them.
- No email address is ever rendered publicly. The stored `email` field
  is for Jonathan only.
