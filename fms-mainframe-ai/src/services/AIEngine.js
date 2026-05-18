// --- src/services/AIEngine.js ---

const CLOUD_API_KEY = "Bearer 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"; 

// Pointing to your fully merged, custom-trained NooRganics Farm AI
const VET_MODEL_URL = "https://api-inference.huggingface.co/models/moeed101/noorganics-vet-7b-merged";
const CFO_MODEL_URL = "https://api-inference.huggingface.co/models/moeed101/noorganics-vet-7b-merged";

// A public CORS proxy to bypass browser restrictions during local development
const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";

// Helper to determine which URL to use based on the context
const getTargetUrl = (systemContext) => {
    if (systemContext && systemContext.includes("NooRganicCFO")) {
        return `${CORS_PROXY}${CFO_MODEL_URL}`;
    }
    return `${CORS_PROXY}${VET_MODEL_URL}`;
};

export const askGemma = async (prompt, systemContext = "") => {
    // 1. Check if the user is connected to the internet
    if (navigator.onLine) {
        console.log("🌐 Internet detected. Routing to Cloud AI via Proxy...");
        try {
            return await askCloudGemma(prompt, systemContext);
        } catch (error) {
            console.warn("⚠️ Cloud AI failed or timed out. Falling back to Local Edge AI...", error);
            return await askLocalGemma(prompt, systemContext);
        }
    } else {
        console.log("🔌 Offline mode detected. Routing to Local Edge AI...");
        return await askLocalGemma(prompt, systemContext);
    }
};

const askCloudGemma = async (prompt, systemContext) => {
    const targetUrl = getTargetUrl(systemContext);
    
    // FORMATTING: Using exact Gemma syntax so the model knows how to reply
    const fullPrompt = `<start_of_turn>user\n${systemContext}\n\nUser Data:\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;

    // 20-Second Timeout Controller to prevent the UI from freezing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": CLOUD_API_KEY,
                "Content-Type": "application/json",
                // Required by cors-anywhere to identify the requesting app
                "X-Requested-With": "XMLHttpRequest" 
            },
            body: JSON.stringify({
                inputs: fullPrompt,
                parameters: {
                    max_new_tokens: 500,
                    temperature: 0.2,
                    top_p: 0.95,
                    return_full_text: false
                }
            }),
            signal: controller.signal // Attach the kill-switch
        });

        clearTimeout(timeoutId); // Cancel the timeout if we get a response

        if (!response.ok) {
            throw new Error(`Cloud API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return result[0]?.generated_text || "The AI generated an empty response.";
        
    } catch (error) {
        clearTimeout(timeoutId); // Always clean up
        throw error; // Pass the error up so the failover to Local Edge AI triggers
    }
};

const askLocalGemma = async (prompt, systemContext) => {
    const fullPrompt = `<start_of_turn>user\n${systemContext}\n\nUser Data:\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gemma:7b', // Standard local model name
                prompt: fullPrompt,
                stream: false
            })
        });

        if (!response.ok) {
             throw new Error(`Local API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.response || "The local AI generated an empty response.";
    } catch (error) {
        console.error("Critical Failure: Both Cloud and Local AI are unreachable.", error);
        throw new Error("SYSTEM ALERT: AI Engine is completely offline. Please check internet connection or ensure the Local AI service is running.");
    }
};