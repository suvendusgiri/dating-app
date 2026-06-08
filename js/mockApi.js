/**
 * mockApi.js — Simulated API layer for the Update Profile Photos page.
 * Every exported function has a clearly marked TODO block showing
 * the real endpoint + method to swap in when going to production.
 */

const SIMULATED_DELAY_MS = 600;

/** Simulates a network delay. */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches the current user profile including existing photos.
 *
 * @returns {Promise<Object>} Resolves to the user profile payload.
 *
 * TODO: replace with real fetch()
 * -----------------------------------------------------------
 * const res = await fetch('/api/v1/profile', {
 *   method: 'GET',
 *   credentials: 'include',          // send session cookie
 *   headers: { 'Accept': 'application/json' }
 * });
 * if (!res.ok) throw new Error(`HTTP ${res.status}`);
 * return res.json();
 * -----------------------------------------------------------
 */
export async function getProfile() {
  await delay(SIMULATED_DELAY_MS);

  return {
    userId: 'usr_10293',
    name: 'Aisha Verma',
    age: 27,
    location: 'Bhubaneswar, IN',
    bio: 'Coffee, trekking, and bad puns.',
    photos: [
      {
        id: 'p1',
        url: 'https://picsum.photos/seed/aisha1/600/800',
        isPrimary: true,
      },
      {
        id: 'p2',
        url: 'https://picsum.photos/seed/aisha2/600/800',
        isPrimary: false,
      },
    ],
  };
}

/**
 * Saves profile changes (kept/new/removed photos + primary selection).
 *
 * @param {Object} payload
 * @param {string} payload.userId
 * @param {Array}  payload.photos  — each item: { id, isPrimary, data, status }
 * @returns {Promise<void>}
 *
 * TODO: replace with real fetch()
 * -----------------------------------------------------------
 * const res = await fetch('/api/v1/profile/photos', {
 *   method: 'PATCH',
 *   credentials: 'include',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify(payload),
 * });
 * if (!res.ok) throw new Error(`HTTP ${res.status}`);
 * // For multipart/form-data upload of actual blobs:
 * //   const form = new FormData();
 * //   form.append('meta', JSON.stringify({ userId, photos: metaOnly }));
 * //   blobs.forEach((blob, i) => form.append(`photo_${i}`, blob));
 * //   await fetch('/api/v1/profile/photos', { method: 'POST', body: form });
 * -----------------------------------------------------------
 */
export async function saveProfile(payload) {
  await delay(SIMULATED_DELAY_MS);
  console.log('[mockApi] saveProfile received:', payload);
}
