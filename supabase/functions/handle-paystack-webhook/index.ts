// supabase/functions/handle-paystack-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.170.0/crypto/mod.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// BUSINESS LOGIC: keep in sync with PaymentPage.tsx and process-payment edge function
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecretKey) {
    console.error("Missing PAYSTACK_SECRET_KEY");
    return new Response('Server configuration error', { status: 500, headers: corsHeaders });
  }

  const signature = req.headers.get('x-paystack-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 401, headers: corsHeaders });
  }

  const bodyText = await req.text();
  
  // Verify HMAC signature
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(paystackSecretKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['verify', 'sign']
  );
  
  const signatureBuf = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(bodyText)
  );

  const hashArray = Array.from(new Uint8Array(signatureBuf));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (!timingSafeEqual(hashHex, signature)) {
    console.error("Invalid Paystack webhook signature detected!");
    return new Response('Invalid signature', { status: 401, headers: corsHeaders });
  }

  // Safe JSON Parsing of Payload
  let event: any;
  try {
    event = JSON.parse(bodyText);
  } catch {
    console.error("Failed to parse Paystack webhook body JSON");
    return new Response('Invalid payload', { status: 400, headers: corsHeaders });
  }

  const reference = event?.data?.reference;
  if (!reference) {
    return new Response('Missing reference parameter in event data', { status: 400, headers: corsHeaders });
  }

  if (event.event === 'charge.success') {
    console.log(`Processing successful Paystack webhook for reference: ${reference}`);

    // Extract metadata forwarded by our frontend Paystack checkout widget
    const listingId = event.data?.metadata?.listingId || event.data?.metadata?.listing_id;
    const userId = event.data?.metadata?.userId || event.data?.metadata?.user_id;
    const purpose = event.data?.metadata?.purpose;
    const idempotencyKey = event.data?.metadata?.idempotencyKey || event.data?.metadata?.idempotency_key;

    const amountPaid = event.data?.amount ? event.data.amount / 100 : 0;

    // 1. Double-fulfillment replay protection check (both at DB unique constraint level and here)
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('reference_id', reference)
      .maybeSingle();

    if (existingPayment) {
      console.log(`Payment reference ${reference} has already been fulfilled.`);
      return new Response('Webhook processed (already fulfilled)', { status: 200, headers: corsHeaders });
    }

    if (idempotencyKey) {
      // Find the attempt corresponding to the checkout flow and set it to succeeded
      const { data: attempt } = await supabaseAdmin
        .from('payment_attempts')
        .select('id, status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (attempt && attempt.status !== 'succeeded') {
        await supabaseAdmin.from('payment_attempts')
          .update({ status: 'succeeded', response: event, amount: amountPaid })
          .eq('id', attempt.id);
      }
    } else {
      // Attempt search based on reference
      const { data: attempts } = await supabaseAdmin
        .from('payment_attempts')
        .select('id, status')
        .eq('reference_id', reference);
        
      if (attempts && attempts.length > 0) {
        for (const attempt of attempts) {
          if (attempt.status !== 'succeeded') {
            await supabaseAdmin.from('payment_attempts')
              .update({ status: 'succeeded', response: event, amount: amountPaid })
              .eq('id', attempt.id);
          }
        }
      }
    }

    // 2. Validate metadata values exist before proceeding to database fulfillment
    if (!listingId || !userId || !purpose) {
      console.warn(`Webhook received for reference: ${reference} has incomplete or missing metadata. Cannot proceed with automated database fulfillment fallback.`);
      return new Response('Incomplete transaction metadata in webhook event', { status: 200, headers: corsHeaders });
    }

    // 3. Load property listing fresh from the DB to double check price, currency, and ownership
    const { data: listing, error: listingFetchError } = await supabaseAdmin
      .from('properties')
      .select('id, agent_id, price, currency')
      .eq('id', listingId)
      .maybeSingle();

    if (listingFetchError || !listing) {
      console.error(`Listing ${listingId} not found during webhook processing`);
      return new Response('Listing not found', { status: 200, headers: corsHeaders });
    }

    // 4. Validate what was actually charged matches the calculated expectations to prevent tampering
    const expectedAmount = purpose === 'promotion'
      ? getExpectedPremiumPrice(listing.currency || 'USD')
      : Number(listing.price || 0);

    if (Math.abs(amountPaid - expectedAmount) > AMOUNT_TOLERANCE) {
      console.error(`Paid amount mismatch in webhook: expected ${expectedAmount} but got ${amountPaid}`);
      if (idempotencyKey) {
        await supabaseAdmin.from('payment_attempts')
          .update({ status: 'failed', response: { ...event, reason: 'amount_mismatch', expectedAmount } })
          .eq('idempotency_key', idempotencyKey);
      }
      return new Response('Charged amount does not match expected listing price', { status: 200, headers: corsHeaders });
    }

    // 5. Ensure that if it is a promotion, only the listing owner earns the upgrade
    if (purpose === 'promotion' && listing.agent_id !== userId) {
      console.error(`Webhook authorization failure: User ${userId} is not the owner of ${listingId}`);
      return new Response('Unauthorized promotion attempt detected in webhook', { status: 200, headers: corsHeaders });
    }

    // 6. Insert new payments row (DB table uniqueness checks will protect duplicates as well)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: userId,
        amount: amountPaid,
        currency: event.data.currency || 'GHS',
        status: 'completed',
        purpose: purpose === 'promotion' ? 'listing_fee' : 'rent_deposit',
        reference_id: reference,
        gateway: 'Paystack',
      })
      .select()
      .single();

    if (paymentError) {
      if (paymentError.code === '23505') { // Unique constraint violation
        console.log(`Payment insert ignored - unique reference_id collision for ${reference}`);
        return new Response('Webhook received (duplicate record)', { status: 200, headers: corsHeaders });
      }
      console.error("Database insert failed for payments row during webhook fallback:", paymentError);
      return new Response('Database error inserting payment', { status: 500, headers: corsHeaders });
    }

    // 7. Update Listing boost/is_premium state inside properties if upgrading
    if (purpose === 'promotion') {
      const { error: listingError } = await supabaseAdmin
        .from('properties')
        .update({ is_premium: true, premium_upgraded_at: new Date().toISOString() })
        .eq('id', listingId);
      if (listingError) {
        console.error(`Failed to promote property ${listingId} in webhook:`, listingError);
      } else {
        console.log(`Property ${listingId} successfully boosted to premium status via webhook webhook integration!`);
      }
    }

    // 8. Invoke Stored Procedure to notify other parts of the system if needed (or simple logging)
    await supabaseAdmin.rpc('process_successful_payment', { 
       payment_reference: reference 
    }).catch(err => {
       // Non-blocking/informational log as some setups don't have the RPC
       console.log("No custom payment RPC trigger registered or required; local schema updates are sufficient.");
    });

  } else if (event.event === 'charge.failed') {
    console.error(`Paystack reported failed payment for reference ${reference}`);
    await supabaseAdmin.from('payment_attempts')
      .update({ status: 'failed', response: event })
      .eq('reference_id', reference);
  }

  return new Response('Webhook processed successfully', { status: 200, headers: corsHeaders });
});
