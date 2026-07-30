// supabase/functions/process-payment/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') || '';
const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || '';
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const localRateLimits = new Map<string, number>();

// IMPORTANT: keep this in sync with PaymentPage.tsx's getPremiumPrice().
// TODO: move to a single source of truth (e.g. a `pricing_config` table) so the
// frontend display price and this server-side check can never drift apart.
const PREMIUM_USD_PRICE = 8;
const CURRENCY_RATES: Record<string, number> = {
  USD: 1, GHS: 12.5, NGN: 1500, KES: 132, ZAR: 18.9, EGP: 48.5, MAD: 10.1,
  ETB: 56.5, TZS: 2550, UGX: 3900, RWF: 1280, XOF: 605, XAF: 605, ZMW: 25.5,
  EUR: 0.92, GBP: 0.79,
};
const AMOUNT_TOLERANCE = 1; // allow for currency-rounding differences

function getExpectedPremiumPrice(currency: string): number {
  const rate = CURRENCY_RATES[currency?.toUpperCase()] || 1;
  return Math.round(PREMIUM_USD_PRICE * rate);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function isRateLimited(key: string): Promise<boolean> {
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 60);
      return count > 1;
    } catch (e) {
      console.error("Redis rate limiting failed, falling back to local memory:", e);
    }
  }
  const now = Date.now();
  const last = localRateLimits.get(key) || 0;
  if (now - last < 60000) return true;
  localRateLimits.set(key, now);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized request" }, 401);

    // 2. Rate limit
    if (await isRateLimited(`ratelimit:payment:${user.id}`)) {
      return json({ error: "Too many payment attempts. Please wait 60 seconds." }, 429);
    }

    // 3. Validate input - `purpose` is now required and drives what we do
    const { reference, listingId, idempotencyKey, purpose } = await req.json();
    if (!reference || !listingId || !idempotencyKey) {
      return json({ error: "Missing payment parameters" }, 400);
    }
    if (purpose !== 'promotion' && purpose !== 'deposit') {
      return json({ error: "Invalid payment purpose" }, 400);
    }

    // 4. Load the listing fresh from the DB - never trust client-supplied price/currency/owner
    const { data: listing, error: listingFetchError } = await supabaseAdmin
      .from('properties')
      .select('id, agent_id, price, currency')
      .eq('id', listingId)
      .maybeSingle();
    if (listingFetchError || !listing) return json({ error: "Listing not found" }, 404);

    // 5. Authorization: only the owner can pay to promote their own listing
    if (purpose === 'promotion' && listing.agent_id !== user.id) {
      return json({ error: "You do not have permission to promote this listing" }, 403);
    }

    // 6. Idempotency: this exact client-side attempt already succeeded
    const { data: attempt } = await supabaseAdmin
      .from('payment_attempts')
      .select('id, status, response')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (attempt?.status === 'succeeded') {
      return json({ success: true, data: attempt.response, cached: true }, 200);
    }

    // 7. Replay protection: this Paystack reference must not already be fulfilled
    //    under a *different* idempotency key (DB-level guard added below in the migration).
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('reference_id', reference)
      .maybeSingle();
    if (existingPayment) {
      return json({ error: "This payment reference has already been processed." }, 409);
    }

    if (!attempt) {
      await supabaseAdmin.from('payment_attempts').insert({
        idempotency_key: idempotencyKey,
        user_id: user.id,
        listing_id: listingId,
        reference_id: reference,
        amount: 0,
        status: 'pending',
      });
    }

    // 8. Verify with Paystack
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) throw new Error("Missing Paystack secret key");

    const verifyReq = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { "Authorization": `Bearer ${paystackSecretKey}` } }
    );
    const verifyData = await verifyReq.json();
    const amountPaid = verifyData?.data?.amount ? verifyData.data.amount / 100 : 0;

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      await supabaseAdmin.from('payment_attempts')
        .update({ status: 'failed', response: verifyData, amount: amountPaid })
        .eq('idempotency_key', idempotencyKey);
      return json({ error: "Payment failed verification", success: false, reference }, 400);
    }

    // 9. THE FIX: validate what was actually paid against what it should cost.
    //    Never trust a client-supplied amount.
    const expectedAmount = purpose === 'promotion'
      ? getExpectedPremiumPrice(listing.currency || 'USD')
      : Number(listing.price || 0);

    if (Math.abs(amountPaid - expectedAmount) > AMOUNT_TOLERANCE) {
      await supabaseAdmin.from('payment_attempts')
        .update({ status: 'failed', response: { ...verifyData, reason: 'amount_mismatch', expectedAmount }, amount: amountPaid })
        .eq('idempotency_key', idempotencyKey);
      return json({ error: "Paid amount does not match the expected price for this listing." }, 400);
    }

    // 10. Fulfill
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: user.id,
        amount: amountPaid,
        currency: verifyData.data.currency,
        status: 'completed',
        purpose: purpose === 'promotion' ? 'listing_fee' : 'rent_deposit',
        reference_id: reference,
        gateway: 'Paystack',
      })
      .select()
      .single();

    if (paymentError) {
      if (paymentError.code === '23505') { // unique violation on reference_id
        return json({ error: "This payment reference has already been processed." }, 409);
      }
      throw paymentError;
    }

    if (purpose === 'promotion') {
      const { error: listingError } = await supabaseAdmin
        .from('properties')
        .update({ is_premium: true, premium_upgraded_at: new Date().toISOString() })
        .eq('id', listingId);
      if (listingError) throw listingError;
    }
    // else: purpose === 'deposit' - hook this up to your actual booking/reservation
    // flow (e.g. updating a `rental_requests` row) once that's designed.

    await supabaseAdmin.from('payment_attempts')
      .update({ status: 'succeeded', response: verifyData, amount: amountPaid })
      .eq('idempotency_key', idempotencyKey);

    return json({ success: true, data: payment }, 200);
  } catch (err: any) {
    console.error(err);
    return json({ error: "Payment processing failed", details: err.message, success: false }, 500);
  }
});
