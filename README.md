# Update Profile Photos — Spark Dating App

A standalone, responsive "Update Profile Photos" page. Vanilla HTML/CSS/JS,
no build step required. Drop the folder into any web server and open `index.html`.

---

> **Why a server?** `app.js` uses ES module `import` (`type="module"`).
> Browsers block module imports from `file://` URLs. Any local server works.

---

## File structure

```
dating-app/
├── index.html          — markup + lightbox modal
├── css/
│   └── styles.css      — all styling (warm dating-app aesthetic, mobile-first)
├── js/
│   ├── mockApi.js      — THE ONLY FILE that touches the API (swap this to go live)
│   └── app.js          — all UI logic, state management, lightbox, upload handling
└── README.md           — this file
```

---

## Plugging in real API endpoints

**All network calls live in `js/mockApi.js` only.**
Every function has a clearly commented `// TODO: replace with real fetch()` block.

### `getProfile()` — fetch current profile

| Property   | Mock value              | Real value                  |
|------------|-------------------------|-----------------------------|
| Method     | simulated delay         | `GET /api/v1/profile`       |
| Auth       | none                    | `credentials: 'include'`    |
| Response   | hardcoded object        | `res.json()`                |

```js
// In mockApi.js → getProfile()
// Replace the simulated return with:
const res = await fetch('/api/v1/profile', {
  method: 'GET',
  credentials: 'include',
  headers: { 'Accept': 'application/json' },
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return res.json();
```

### `saveProfile(payload)` — persist changes

The payload shape sent to `saveProfile`:
```json
{
  "userId": "usr_10293",
  "photos": [
    { "id": "p1",      "isPrimary": true,  "data": "<url>",  "status": "kept"    },
    { "id": "p2",      "isPrimary": false, "data": "<url>",  "status": "removed" },
    { "id": "new_...", "isPrimary": false, "data": "<Blob>", "status": "new"     }
  ]
}
```

**For JSON-only (base64 data):**
```js
const res = await fetch('/api/v1/profile/photos', {
  method: 'PATCH',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
```

**For multipart/form-data (recommended for large images):**
```js
const form = new FormData();
const meta = payload.photos.map(p => ({ id: p.id, isPrimary: p.isPrimary, status: p.status }));
form.append('meta', JSON.stringify({ userId: payload.userId, photos: meta }));
payload.photos
  .filter(p => p.status === 'new')
  .forEach((p, i) => form.append(`photo_${i}`, p.data, `photo_${i}.jpg`));

const res = await fetch('/api/v1/profile/photos', {
  method: 'POST',
  credentials: 'include',
  body: form,
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
```

---

## Features

- **Loading / error states** with retry button
- **Photo grid** — up to 6 slots, mobile-first (3-col → 2-col on narrow screens)
- **Upload** — `<input type="file" capture="environment">` offers camera + gallery on mobile
- **Validation** — JPEG / PNG / WebP only; max 5 MB; inline per-slot error message
- **Live preview** via `URL.createObjectURL`; object URLs revoked on removal and page unload
- **Set primary** — star any photo; avatar updates immediately
- **Remove** — existing photos marked `"removed"` in payload; new photos discarded locally
- **Lightbox** — zoom in/out (CSS transform), drag-to-pan, pinch-to-zoom (touch), Escape/backdrop close, focus trap
- **Save** — button disabled during save; success/error toast
- **Accessible** — ARIA labels, roles, live regions, focus trap in modal, keyboard navigation throughout
