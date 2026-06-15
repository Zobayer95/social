# How to Put This App Online (Deploy to Vercel)

This is a step-by-step guide to publish the app on the internet using **Vercel** —
a free hosting service. **No coding required.** Just follow along and click the buttons.

You'll do this in three parts:

1. Put the code on GitHub (the code's online home)
2. Connect it to Vercel (the host)
3. Add a database and image storage, then press Deploy

Total time: about **15–20 minutes**.

> 💡 You'll need three free accounts. Sign up first (all have a "Continue with Google/GitHub" button):
> - **GitHub** → https://github.com/signup
> - **Vercel** → https://vercel.com/signup (sign up *with GitHub* — it makes the next steps easier)
> - **Neon** (the database) → https://neon.tech (you may already have this)

---

## Part 1 — Put the code on GitHub

GitHub is where your code lives online so Vercel can read it.

1. Go to https://github.com/new
2. **Repository name:** type `social`
3. Choose **Private** (so only you can see it).
4. Click **Create repository**.
5. GitHub now shows a page with some commands. Leave it open — the person who set up
   the project will run a few commands once to upload the code. (If that's you, ask your
   developer, or follow the "Uploading the code" box below.)

<details>
<summary>📦 Uploading the code (one-time, needs the Terminal app)</summary>

Open the **Terminal** app, then copy-paste these one at a time. Replace
`YOUR-USERNAME` with your GitHub username:

```bash
cd path/to/social        # the project folder
git add -A
git commit -m "First version"
git remote add origin https://github.com/YOUR-USERNAME/social.git
git push -u origin main
```

Your code is now on GitHub. (Don't worry — passwords and secret keys are
automatically left out.)
</details>

---

## Part 2 — Connect it to Vercel

1. Go to https://vercel.com and **Log in with GitHub**.
2. Click **Add New… → Project**.
3. You'll see a list of your GitHub repositories. Find **social** and click **Import**.
4. Vercel automatically recognizes it as a Next.js app. ✅
5. **Don't click Deploy yet!** First we need to add a database and a few settings
   (next part). Leave this tab open.

---

## Part 3 — Add a database, image storage, and settings

### 3a. Add the database (Neon Postgres)

The app needs a database to store users, posts, and comments.

1. In your Vercel project, click the **Storage** tab at the top.
2. Click **Create Database** → choose **Neon (Postgres)** → **Continue**.
3. Give it any name, pick the region closest to you, and click **Create**.
4. When asked, **connect it to your project** and select all environments
   (Production, Preview, Development).

> Already have a Neon database? You can skip creating a new one and instead paste your
> existing connection links in step 3c.

### 3b. Add image storage (Vercel Blob)

This is where uploaded photos are saved.

1. Still in the **Storage** tab, click **Create Database** again.
2. Choose **Blob** → **Continue** → give it a name → **Create**.
3. **Connect it to your project** (all environments).

✅ **The secret key is added automatically.** When you connect the Blob store to your
project, Vercel creates a setting called **`BLOB_READ_WRITE_TOKEN`** and adds it for
you. You do **not** need to make or copy it by hand.

**To double-check it's there:** go to **Settings → Environment Variables** and look for
`BLOB_READ_WRITE_TOKEN` in the list. If you see it, you're done.

<details>
<summary>🔧 Only if it's missing — add the Blob token manually</summary>

If `BLOB_READ_WRITE_TOKEN` is **not** in the list (rare), add it yourself:

1. Go to the **Storage** tab → click your **Blob** store.
2. Open the **Settings** or **Tokens** section of that store.
3. Click to **show/create a token** and **copy** it (it starts with `vercel_blob_rw_...`).
4. Go to **Settings → Environment Variables** in your project.
5. Add a new variable:
   - **Name:** `BLOB_READ_WRITE_TOKEN`
   - **Value:** paste the token you copied
   - Make sure **Production** is checked → **Save**.
6. **Redeploy** (Deployments → ⋯ → Redeploy).
</details>

> ⚠️ Important: without this token, photo uploads won't work on Vercel (they'll fail
> silently). So make sure `BLOB_READ_WRITE_TOKEN` shows up in your settings before you
> finish.

### 3c. Add the settings (Environment Variables)

These are like the app's private settings. Go to **Settings → Environment Variables**
in your Vercel project and add each row below.

For each one: type the **Name**, paste the **Value**, make sure **Production** is
checked, and click **Save**.

| Name | What to paste |
|------|----------------|
| `DATABASE_URL` | The **pooled** database link (from Neon, or your `.env` file) |
| `DATABASE_URL_UNPOOLED` | The **direct** database link (from Neon, or your `.env` file) |
| `BETTER_AUTH_SECRET` | A random secret — see the box below to make one |
| `BETTER_AUTH_URL` | Leave blank for now — we fill this in Part 4 |
| `NEXT_PUBLIC_APP_URL` | Leave blank for now — we fill this in Part 4 |

> 🔑 **Making the secret key (`BETTER_AUTH_SECRET`):**
> Go to https://generate-secret.vercel.app/32 — it shows a random string.
> Copy it and paste it as the value. (It's just a long random password the app uses
> internally.)

> 📍 **Where do the database links come from?**
> - If you created the Neon database in step 3a, Vercel added `DATABASE_URL` for you
>   automatically — you may only need to add `DATABASE_URL_UNPOOLED` (the "direct"/
>   "unpooled" link, found in your Neon dashboard under **Connection Details**).
> - If you're reusing an existing database, copy both links from your project's `.env`
>   file (the lines `DATABASE_URL=...` and `DATABASE_URL_UNPOOLED=...`).

---

## Part 4 — Deploy and finish

1. Go back to the **Deployments** (or **Project**) tab and click **Deploy**
   (or **Redeploy**). Wait 1–2 minutes for it to finish — you'll see a ✅ and a
   **"Visit"** button with your website address, like
   `https://social-abc123.vercel.app`.
2. **Copy that web address.**
3. Go back to **Settings → Environment Variables** and fill in the two we left blank:
   - `BETTER_AUTH_URL` → paste the address (e.g. `https://social-abc123.vercel.app`)
   - `NEXT_PUBLIC_APP_URL` → paste the **same** address
   - Click **Save** on each.
4. Now **redeploy** so the new settings take effect:
   - Go to **Deployments** → click the **⋯** menu on the latest one → **Redeploy**.

🎉 **Done!** Open your web address, create an account, and start posting.

---

## Quick checklist

- [ ] Code uploaded to GitHub
- [ ] Project imported into Vercel
- [ ] Neon database created & connected
- [ ] Blob (image) storage created & connected
- [ ] `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set
- [ ] `BETTER_AUTH_SECRET` set (random string)
- [ ] First deploy done → got the web address
- [ ] `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` set to that address
- [ ] Redeployed

---

## If something doesn't work

| Problem | Fix |
|---------|-----|
| **Can't log in / "unauthorized" errors** | `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` must **exactly match** your real web address (with `https://`, no slash at the end). Fix them in Settings → Environment Variables, then redeploy. |
| **Images don't appear after posting** | The **Blob** storage isn't connected. Redo step 3b, then redeploy. |
| **Build failed / red ❌** | Open the deployment, read the error log. Most often a missing or mistyped environment variable. Double-check the table in 3c. |
| **Page says database error** | Check `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are pasted correctly (no extra spaces). |
| **I changed a setting but nothing changed** | Settings only apply after a **Redeploy** (Deployments → ⋯ → Redeploy). |

---

## Using your own domain (optional)

Want `www.yoursite.com` instead of the `vercel.app` address?

1. In your Vercel project: **Settings → Domains → Add**, type your domain, and follow
   the instructions (it tells you what to change at your domain provider).
2. After it's connected, update `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your new
   domain and **redeploy**.
