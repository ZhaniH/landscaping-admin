# Landscape admin

A simple admin tool for a landscaping business: clients, scheduled jobs,
auto-generated invoices, and automatic overdue-payment flags based on each
client's own payment terms. Amounts are shown in South African Rand (ZAR).

Data is saved in the browser's local storage, so it stays on whichever
device/browser is used to open the site. There's no shared database yet —
if you need the owner to see the same data from their phone and laptop,
that's a good next step to build.

## Run it locally in VS Code

1. Install [Node.js](https://nodejs.org) (LTS version) if you don't have it.
2. Open this folder in VS Code.
3. Open a terminal in VS Code (`Terminal` → `New Terminal`) and run:
   ```
   npm install
   npm run dev
   ```
4. Open the local address it prints (usually `http://localhost:5173`) in your browser.

Any edits you make to files in `src/` will reload automatically while `npm run dev` is running.

## Deploy it for free

The easiest free option is **Netlify** (Vercel and GitHub Pages both work
too, but Netlify's drag-and-drop is the fastest to get started with no
account setup for git required).

### Option A — Netlify, no account/git needed to start
1. Run `npm run build`. This creates a `dist` folder with the finished site.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
3. Drag the `dist` folder onto the page.
4. Netlify gives you a live URL immediately (e.g. `random-name-123.netlify.app`).
5. You can rename the site and, later, connect it to a GitHub repo so it
   redeploys automatically whenever you push changes.

### Option B — Vercel, connected to GitHub (recommended once you're iterating regularly)
1. Push this folder to a new GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, and import the repo.
3. Vercel auto-detects Vite — leave the defaults and click Deploy.
4. Every future `git push` automatically redeploys the live site.

Both are genuinely free for a project this size — no credit card required.

## Project structure

```
src/
  App.jsx        the whole application (clients, jobs, invoices, dashboard)
  main.jsx       React entry point
  index.css      base styling and color variables
index.html       page shell
package.json     dependencies and scripts
```

## Notes on the payment reminders

Because this is a static site with no server, reminders can only be
detected when someone has the app open in a browser — there's no background
process checking due dates while it's closed. In practice that's fine as
long as the owner opens it roughly daily, since it catches up instantly the
moment it's opened. If you want reminders to actually send a text or email
to the customer (rather than just flagging it for the owner), that needs a
small backend service (e.g. a scheduled job with Twilio or an email API) —
worth building once the manual-tracking version proves useful.
