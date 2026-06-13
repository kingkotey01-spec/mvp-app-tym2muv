import { supabase } from '../supabaseClient';

/**
 * AI Service using Supabase Edge Functions proxy to completely secure and isolate 
 * the Gemini API key on the backend. No developer API keys are exposed to the browser.
 */

export const generateAdDescription = async (details: any): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-api', {
      body: {
        action: 'generate-description',
        details
      }
    });

    if (error) {
       console.error("Supabase Edge Function error generating description:", error);
       throw error;
    }

    return data?.text || '';
  } catch (error) {
    console.error("Error calling generate description edge function:", error);
    return '';
  }
};

export const suggestPriceRange = async (details: any): Promise<{ min: number; max: number } | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-api', {
      body: {
        action: 'suggest-price',
        details
      }
    });

    if (error) {
       console.error("Supabase Edge Function error suggesting price:", error);
       throw error;
    }

    if (data?.text) {
      try {
        return JSON.parse(data.text);
      } catch (e) {
        console.error("Error parsing Gemini JSON response:", e);
      }
    }
    return null;
  } catch (error) {
    console.error("Error calling suggest price edge function:", error);
    return null;
  }
};

export const enhanceImage = async (base64Image: string, mimeType: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-api', {
      body: {
        action: 'enhance-image',
        base64Image,
        mimeType
      }
    });

    if (error) {
       console.error("Supabase Edge Function error enhancing image:", error);
       throw error;
    }

    // Returns the enhanced base64 representation
    return data?.enhancedBase64 || base64Image;
  } catch (error) {
    console.error("Error calling enhance image edge function:", error);
    throw error;
  }
};
