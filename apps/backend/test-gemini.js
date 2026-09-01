const { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } = require('@langchain/google-genai');

async function test() {
  const apiKey = process.env.GEMINI_API_KEY || "YOUR_API_KEY";
  
  console.log("Testing text-embedding-004...");
  try {
    const embeddings4 = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      apiKey: apiKey,
    });
    const res4 = await embeddings4.embedQuery("Hello world");
    console.log("text-embedding-004 length:", res4.length);
  } catch (e) {
    console.error("text-embedding-004 failed:", e.message);
  }

  console.log("Testing embedding-001...");
  try {
    const embeddings1 = new GoogleGenerativeAIEmbeddings({
      model: "embedding-001",
      apiKey: apiKey,
    });
    const res1 = await embeddings1.embedQuery("Hello world");
    console.log("embedding-001 length:", res1.length);
  } catch (e) {
    console.error("embedding-001 failed:", e.message);
  }

  console.log("Testing gemini-1.5-flash...");
  try {
    const chat = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey: apiKey,
    });
    const resChat = await chat.invoke("Say hi");
    console.log("Chat response:", resChat.content);
  } catch (e) {
    console.error("Chat failed:", e.message);
  }
}

test();
