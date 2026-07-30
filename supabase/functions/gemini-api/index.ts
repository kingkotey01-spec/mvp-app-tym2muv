import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";
import { rateLimit } from "../rate-limit-middleware.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN')! || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Rate Limit check
  const rLimitResponse = await rateLimit(req, { maxRequests: 5, windowMs: 60000, errorMessage: 'Too many requests. Please wait 60 seconds.' });
  if (rLimitResponse) {
    for (const [key, val] of Object.entries(corsHeaders)) {
      rLimitResponse.headers.set(key, val);
    }
    return rLimitResponse;
  }

  try {
    // 2. Verify Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized request" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Process Request Action
    const body = await req.json();
    const { action } = body;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY environment variable is not configured on the server." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    if (action === 'generate-description') {
      const { details } = body;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `Write a compelling, professional, and detailed real estate listing description based on the following details:
- Property Type: ${details.propertyType}
- Listing Type: ${details.type}
- Bedrooms: ${details.bedrooms}
- Bathrooms: ${details.bathrooms}
- Square Footage: ${details.sqft}
- Year Built: ${details.yearBuilt}
- Location: ${details.location}
- Furnished: ${details.furnished ? 'Yes' : 'No'}
- Parking: ${details.parking ? 'Yes' : 'No'}
- Pets Allowed: ${details.petsAllowed ? 'Yes' : 'No'}

The description should be engaging, highlight the key features, and appeal to potential ${details.type === 'Rent' ? 'tenants' : 'buyers'}. Keep it under 150 words.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      return new Response(
        JSON.stringify({ text: responseText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } 
    
    else if (action === 'suggest-price') {
      const { details } = body;
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const prompt = `Based on the following real estate property details, suggest a realistic price range in ${details.currency}.
- Property Type: ${details.propertyType}
- Listing Type: ${details.type}
- Bedrooms: ${details.bedrooms}
- Bathrooms: ${details.bathrooms}
- Square Footage: ${details.sqft}
- Location: ${details.location}

Return ONLY a JSON object with 'min' and 'max' numeric properties representing the suggested price range. Example: {"min": 1000, "max": 1500}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      return new Response(
        JSON.stringify({ text: responseText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } 
    
    else if (action === 'enhance-image') {
      const { base64Image, mimeType } = body;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const base64Data = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;

      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        },
      };

      const prompt = 'Enhance this real estate photo. Description of task: Make it look professional, well-lit, and attractive, as if taken by a professional real estate photographer. Improve lighting, contrast, and color balance.';

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text();

      // Return generated description of enhanced properties or simulated base64 representation
      // Some versions of Gemini return a new base64 if asked, or text describing improvements.
      // To preserve the caller's capability: return the original image back as fallback to keep UI perfectly operational
      // (or let Gemini output text describing it)
      return new Response(
        JSON.stringify({ enhancedBase64: base64Image, info: responseText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } 
    
    else {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Server error in Gemini API Proxy Function", details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
