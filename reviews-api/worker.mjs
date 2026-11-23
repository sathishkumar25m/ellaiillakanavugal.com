const pageSize = 30;
const maxBodyBytes = 4096;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readReview(request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const buffer = new Uint8Array(maxBodyBytes);
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (length + value.length > buffer.length) {
      await reader.cancel();
      return null;
    }
    buffer.set(value, length);
    length += value.length;
  }
  try {
    const review = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)));
    const reviewer = typeof review?.reviewer === 'string' ? review.reviewer.trim() : '';
    const comment = typeof review?.comment === 'string' ? review.comment.trim() : '';
    const { rating, submissionId, publish } = review ?? {};
    if (!reviewer || reviewer.length > 60 || !comment || comment.length > 600 || publish !== true ||
        !Number.isInteger(rating) || rating < 1 || rating > 5 ||
        typeof submissionId !== 'string' || !/^[a-f0-9-]{36}$/.test(submissionId)) return null;
    return { reviewer, rating, comment, submissionId };
  } catch {
    return null;
  }
}

async function reviewsApi(request, db, url) {
  if (request.method === 'GET') {
    const before = url.searchParams.get('before');
    if (before !== null && (!/^[1-9]\d*$/.test(before) || !Number.isSafeInteger(Number(before)))) {
      return json({ error: 'Invalid review page.' }, 400);
    }
    const statement = before === null
      ? db.prepare('SELECT id, reviewer, rating, comment FROM reviews ORDER BY id DESC LIMIT ?').bind(pageSize + 1)
      : db.prepare('SELECT id, reviewer, rating, comment FROM reviews WHERE id < ? ORDER BY id DESC LIMIT ?').bind(Number(before), pageSize + 1);
    const { results } = await statement.all();
    const reviews = results.slice(0, pageSize);
    return json({ reviews, next: results.length > pageSize ? reviews.at(-1).id : null });
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  }
  const review = await readReview(request);
  if (!review) return json({ error: 'Enter your name, rating, review, and consent to publish.' }, 400);

  const { reviewer, rating, comment, submissionId } = review;
  const [, { results }] = await db.batch([
    db.prepare('INSERT INTO reviews (submission_id, reviewer, rating, comment) VALUES (?, ?, ?, ?) ON CONFLICT(submission_id) DO NOTHING')
      .bind(submissionId, reviewer, rating, comment),
    db.prepare('SELECT id, reviewer, rating, comment FROM reviews WHERE submission_id = ?').bind(submissionId),
  ]);
  const saved = results[0];
  if (saved.reviewer !== reviewer || saved.rating !== rating || saved.comment !== comment) {
    return json({ error: 'This submission was already used.' }, 409);
  }
  return json(saved, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/reviews') return new Response('Page not found.', { status: 404 });

    const origin = request.headers.get('Origin');
    const allowed = (env.REVIEW_SITE_ORIGINS ?? '').split(',').map(value => value.trim());
    if (origin && origin !== url.origin && !allowed.includes(origin)) {
      return json({ error: 'Please submit from the website.' }, 403);
    }

    let response;
    if (request.method === 'OPTIONS') {
      response = new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      } });
    } else {
      try {
        response = await reviewsApi(request, env.DB, url);
      } catch {
        response = json({ error: 'The review service is temporarily unavailable. Please try again.' }, 503);
      }
    }
    response.headers.set('Vary', 'Origin');
    if (origin) response.headers.set('Access-Control-Allow-Origin', origin);
    return response;
  },
};
