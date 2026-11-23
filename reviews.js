(() => {
  const form = document.getElementById('review-form');
  const endpoint = new URL(form.dataset.reviewApi || 'api/reviews', location.href);
  const list = document.getElementById('visitor-reviews');
  const submit = document.getElementById('review-submit');
  const status = document.getElementById('review-status');
  const listStatus = document.getElementById('review-list-status');
  const more = document.getElementById('review-more');
  const whatsapp = document.getElementById('review-whatsapp');
  const seen = new Set();
  let pending;
  let nextPage = null;

  function addReview(review, newest = false) {
    if (seen.has(review.id)) return;
    seen.add(review.id);
    const card = document.createElement('figure');
    card.className = 'review is-visible';
    const caption = document.createElement('figcaption');
    const name = document.createElement('strong');
    name.textContent = review.reviewer;
    const stars = document.createElement('span');
    stars.className = 'review-stars';
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', review.rating + ' out of 5 stars');
    stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    caption.append(name, stars);
    const quote = document.createElement('blockquote');
    const text = document.createElement('p');
    text.textContent = review.comment;
    quote.append(text);
    card.append(caption, quote);
    if (newest) list.prepend(card);
    else list.append(card);
  }

  async function loadReviews() {
    more.disabled = true;
    try {
      const url = new URL(endpoint);
      if (nextPage !== null) url.searchParams.set('before', nextPage);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Could not load reviews');
      const page = await response.json();
      page.reviews.forEach(review => addReview(review));
      nextPage = page.next;
      more.hidden = nextPage === null;
      more.textContent = 'Load more reviews';
      listStatus.textContent = '';
    } catch {
      listStatus.textContent = 'Visitor reviews could not be loaded.';
      more.textContent = 'Retry loading reviews';
      more.hidden = false;
    } finally {
      more.disabled = false;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || !form.reportValidity()) return;
    const data = new FormData(form);
    const details = {
      reviewer: data.get('reviewer').trim(),
      rating: Number(data.get('rating')),
      comment: data.get('comment').trim(),
      publish: data.has('permission'),
    };
    if (!details.reviewer || !details.comment) {
      status.textContent = 'Enter a name and a review.';
      return;
    }
    const signature = JSON.stringify(details);
    if (pending?.signature !== signature) pending = { signature, submissionId: crypto.randomUUID() };
    submit.disabled = true;
    whatsapp.hidden = true;
    status.textContent = 'Posting your review…';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, submissionId: pending.submissionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to post review.');
      const destination = new URL(document.getElementById('contact-whatsapp').href);
      destination.searchParams.set('text', [
        'Hello Ellai Illa Kanavugal! I posted a review on your website.',
        'Name: ' + result.reviewer, 'Rating: ' + result.rating + '/5', 'Review: ' + result.comment,
      ].join('\n'));
      addReview(result, true);
      whatsapp.href = destination.href;
      whatsapp.hidden = false;
      status.textContent = 'Your review is on the website. Tap below to open it in WhatsApp, then tap Send.';
      pending = undefined;
      form.reset();
    } catch {
      status.textContent = 'Could not confirm your review was posted. Please try again.';
    } finally {
      submit.disabled = false;
    }
  });
  more.addEventListener('click', loadReviews);
  loadReviews();
})();
