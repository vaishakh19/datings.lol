import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Helper to initialize Gemini SDK safely
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API endpoint for AI Dating Coach & Chat Roaster
app.post("/api/coach", async (req, res) => {
  try {
    const { message, vibe = "roasty", history = [], imageBase64 } = req.body;

    const ai = getGeminiClient();

    let vibeInstruction = "";
    if (vibe === "roasty") {
      vibeInstruction = "You are 'lol coach' on datings.lol - a brutally honest, hilarious, Gen-Z savvy dating coach. Call out double texts, dry replies, 'wyd' openers, and desperation with funny roasts, but ALWAYS provide 2-3 specific, high-value alternative messages or fixes that actually work.";
    } else if (vibe === "gentle") {
      vibeInstruction = "You are 'lol coach' on datings.lol - a warm, supportive, encouraging dating coach. Hype the user up, validate their feelings, reduce anxiety, and give clear, confident, actionable advice and reply suggestions.";
    } else {
      vibeInstruction = "You are 'lol coach' on datings.lol - a direct, no-BS dating coach. Concise, tactical, no fluff, straight to the point with actionable steps and exact text templates.";
    }

    const systemInstruction = `${vibeInstruction} Keep your tone modern, punchy, conversational, and scannable. Use occasional lower-case, bold text, or bullet points for readability. Avoid corporate jargon or generic advice. Keep answers under 150 words unless doing a detailed roast report.`;

    if (ai) {
      const contents: any[] = [];

      // Add recent history if provided
      if (Array.isArray(history) && history.length > 0) {
        history.slice(-6).forEach((h: any) => {
          if (h.text) {
            contents.push({
              role: h.role === "user" ? "user" : "model",
              parts: [{ text: h.text }],
            });
          }
        });
      }

      // Add current message / image
      const currentParts: any[] = [];
      if (imageBase64) {
        // Strip data header if present
        const cleanedBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        currentParts.push({
          inlineData: {
            mimeType,
            data: cleanedBase64,
          },
        });
      }

      const userPrompt = message || (imageBase64 ? "Roast this chat / profile screenshot and give me actionable fixes." : "Give me dating advice.");
      currentParts.push({ text: userPrompt });

      contents.push({
        role: "user",
        parts: currentParts,
      });

      // Try multiple models / retries in case of temporary 503 high demand
      const candidateModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"];
      let responseText: string | null = null;

      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              temperature: 0.9,
            },
          });
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (modelError: any) {
          console.warn(`Model ${model} failed, trying next candidate:`, modelError?.message || modelError);
          // Small delay before trying next fallback model
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (responseText) {
        return res.json({ text: responseText, isAi: true });
      }
    }

    // Fallback if no Gemini key or empty response
    const fallbackText = getFallbackResponse(message, vibe, !!imageBase64);
    return res.json({ text: fallbackText, isAi: false });
  } catch (error) {
    console.error("Error in /api/coach:", error);
    const fallbackText = getFallbackResponse(req.body?.message, req.body?.vibe, !!req.body?.imageBase64);
    return res.json({ text: fallbackText, isAi: false });
  }
});

// Fallback heuristic engine
function getFallbackResponse(message: string = "", vibe: string = "roasty", hasImage: boolean = false): string {
  const msg = (message || "").toLowerCase();

  if (hasImage) {
    return "bro this screenshot... you opened with 'wyd' or sent 3 unanswered texts? that's not flirting, that's a cry for help! \uD83D\uDC40\n\nHere is what you should say instead:\n• 'ok you left me on read, my ego is in shambles but i'll survive. down for coffee this week?'\n• 'fair enough - felt a vibe, but if not, all good!'";
  }

  if (msg.includes("ghosted") || msg.includes("read")) {
    return "ghosted 101: they didn't die, they just chose silence. stop checking their story! 48hr rule: no checking their stuff for 2 days. if you still care, send ONE casual close-out or delete the chat. your time > their indecision.";
  }

  if (msg.includes("profile") || msg.includes("bio")) {
    return "profile audit: 1 clear face photo in natural light + 1 full body doing something + 1 social proof + 1 chaos hobby. delete 'fluent in sarcasm' immediately. make your bio 70% weird specific humor, 30% hot!";
  }

  if (vibe === "gentle") {
    return "it's totally normal to feel nervous! focus on micro-reps today: make eye contact and smile at 2 people. confidence is built from tiny wins, not giant leaps. you've got this! ✨";
  }

  return "rule of thumb: match their energy, add ONE playful tease, and end with a concrete question or plan. no paragraphs, no double texting!";
}

async function startServer() {
  // Vite middleware for dev
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Datings.lol server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
