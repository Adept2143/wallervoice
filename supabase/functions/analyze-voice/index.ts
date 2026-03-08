import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, durationSeconds } = await req.json();

    if (!transcript || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No transcript provided. Please speak clearly and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const wpm = durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0;

    const systemPrompt = `You are an expert voice and speech coach. Analyze the following speech transcript and provide detailed feedback.

You MUST respond using the "analyze_voice" tool.

Context:
- Word count: ${wordCount}
- Duration: ${durationSeconds} seconds
- Words per minute: ${wpm}

Scoring guide (0-100):
- tone: How pleasant and appropriate the vocal tone seems from word choices and sentence structure
- pacing: Based on WPM (ideal 130-160). Below 100 or above 180 scores lower
- clarity: How clear and well-articulated the words/sentences are
- confidence: Assertiveness of language, lack of hedging words
- fillerWords: Score INVERSELY — fewer filler words = higher score (100 = no fillers, 0 = excessive)
- vocalVariety: Variety in sentence length, punctuation, expressiveness
- energy: Enthusiasm and dynamism conveyed through word choice

Provide 3-5 specific, actionable feedback items.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this speech transcript:\n\n"${transcript}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_voice",
              description: "Return structured voice analysis results",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Overall voice score 0-100" },
                  tone: { type: "number", description: "Tone score 0-100" },
                  pacing: { type: "number", description: "Pacing score 0-100" },
                  clarity: { type: "number", description: "Clarity score 0-100" },
                  confidence: { type: "number", description: "Confidence score 0-100" },
                  fillerWords: { type: "number", description: "Filler word control score 0-100 (higher = fewer fillers)" },
                  vocalVariety: { type: "number", description: "Vocal variety score 0-100" },
                  energy: { type: "number", description: "Energy score 0-100" },
                  feedback: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 specific actionable feedback items",
                  },
                },
                required: ["score", "tone", "pacing", "clarity", "confidence", "fillerWords", "vocalVariety", "energy", "feedback"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_voice" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No analysis returned from AI");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ ...analysis, transcript, wordCount, wpm }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-voice error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
