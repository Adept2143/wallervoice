import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function gatewayHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function handleGatewayErrors(response: Response) {
  if (response.ok) return null;
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

// --- Mode: roleplayChat ---
async function handleRoleplayChat(body: Record<string, unknown>, apiKey: string) {
  const messages = body.messages as Array<{ role: string; content: string }>;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages array is required for roleplayMode" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: gatewayHeaders(apiKey),
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
    }),
  });

  const errResp = await handleGatewayErrors(response);
  if (errResp) return errResp;

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content ?? "";

  return new Response(
    JSON.stringify({ reply }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// --- Mode: roleplayEval ---
async function handleRoleplayEval(body: Record<string, unknown>, apiKey: string) {
  const evaluationPrompt = body.evaluationPrompt as string;
  if (!evaluationPrompt || typeof evaluationPrompt !== "string" || evaluationPrompt.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "evaluationPrompt is required for roleplayEval mode" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: gatewayHeaders(apiKey),
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert communication and roleplay coach. Evaluate the conversation using the roleplay_eval tool. Score each metric 0-100.",
        },
        { role: "user", content: evaluationPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "roleplay_eval",
            description: "Return structured roleplay evaluation scores and feedback",
            parameters: {
              type: "object",
              properties: {
                clarity: { type: "number", description: "Clarity of communication 0-100" },
                pacing: { type: "number", description: "Conversational pacing 0-100" },
                confidence: { type: "number", description: "Confidence level 0-100" },
                persuasion: { type: "number", description: "Persuasiveness 0-100" },
                control: { type: "number", description: "Conversational control 0-100" },
                listening: { type: "number", description: "Active listening signals 0-100" },
                openingAuthority: { type: "number", description: "Authority in opening 0-100" },
                outcome: { type: "number", description: "Likelihood of achieving desired outcome 0-100" },
                feedback: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-5 specific actionable feedback items",
                },
                weakestTurn: { type: "string", description: "Quote or paraphrase of the user's weakest turn in the conversation" },
                coachVersion: { type: "string", description: "A rewritten version of the weakest turn showing how a coach would say it" },
                silenceFeedback: { type: "string", description: "Feedback on use of pauses and silence" },
              },
              required: [
                "clarity", "pacing", "confidence", "persuasion", "control",
                "listening", "openingAuthority", "outcome", "feedback",
                "weakestTurn", "coachVersion", "silenceFeedback",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "roleplay_eval" } },
    }),
  });

  const errResp = await handleGatewayErrors(response);
  if (errResp) return errResp;

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall?.function?.arguments) {
    throw new Error("No evaluation returned from AI");
  }

  const evaluation = JSON.parse(toolCall.function.arguments);

  return new Response(
    JSON.stringify(evaluation),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// --- Mode: default voice analysis ---
async function handleVoiceAnalysis(body: Record<string, unknown>, apiKey: string) {
  const { transcript, durationSeconds, acousticWpm } = body as {
    transcript: string;
    durationSeconds: number;
    acousticWpm?: number;
  };

  if (!transcript || transcript.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "No transcript provided. Please speak clearly and try again." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const wpm = acousticWpm ?? (durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0);

  const systemPrompt = `You are an expert voice and speech coach. Analyze the following speech transcript and provide detailed feedback.

You MUST respond using the "analyze_voice" tool.

Context:
- Word count: ${wordCount}
- Duration: ${durationSeconds} seconds
- Real WPM (from audio): ${wpm}
- Note: Pacing score will be overridden by real acoustic measurement. Focus your pacing feedback on this real WPM value.

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
    headers: gatewayHeaders(apiKey),
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

  const errResp = await handleGatewayErrors(response);
  if (errResp) return errResp;

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body = await req.json();
    const mode = body.mode as string | undefined;

    if (mode === "roleplayChat") {
      return await handleRoleplayChat(body, LOVABLE_API_KEY);
    }

    if (mode === "roleplayEval") {
      return await handleRoleplayEval(body, LOVABLE_API_KEY);
    }

    // Default: voice analysis
    return await handleVoiceAnalysis(body, LOVABLE_API_KEY);
  } catch (e) {
    console.error("analyze-voice error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
