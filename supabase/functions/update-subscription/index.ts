import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit } from "../rate-limit-middleware.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Rate Limit check
  const rLimitResponse = await rateLimit(req, { maxRequests: 20, windowMs: 60000, errorMessage: 'Too many requests. Please wait 60 seconds.' });
  if (rLimitResponse) {
    for (const [key, val] of Object.entries(corsHeaders)) {
      rLimitResponse.headers.set(key, val);
    }
    return rLimitResponse;
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")! || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { agent_id, feature, increment } = await req.json();

    if (user.id !== agent_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You can only update your own subscription usage" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔐 OPTIONAL: validate request
    if (!agent_id || !feature) {
      return new Response(
        JSON.stringify({ error: "Missing parameters" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔥 CALL YOUR DATABASE FUNCTION SAFELY
    const { data, error } = await supabase.rpc(
      "increment_subscription_usage",
      {
        p_agent_id: agent_id,
        p_feature: feature,
        p_increment: increment ?? 1,
      }
    );

    if (error) {
      return new Response(JSON.stringify({ error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Server error", details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
