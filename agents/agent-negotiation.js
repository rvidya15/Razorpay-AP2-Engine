require('dotenv').config();
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { tool } = require('@langchain/core/tools');
const axios = require('axios');
const { z } = require('zod');
const { ToolMessage } = require('@langchain/core/messages');

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'your_gemini_api_key_here';
const PORT = process.env.PORT || 3001;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

// Global token state for this run
let currentScopedToken = null;

// ==========================================
// 1. LangChain Tools (ACP Protocol)
// ==========================================

const searchProductsTool = tool(
  async ({ query }) => {
    console.log(`[Tool] searchProducts called with query: "${query}"`);
    try {
      const res = await axios.post(`${BACKEND_URL}/acp/v1/search`, { query });
      return JSON.stringify(res.data.products);
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: 'searchProducts',
    description: 'Searches the merchant catalog for products matching a query.',
    schema: z.object({
      query: z.string().describe('The product search query'),
    }),
  }
);

const createCheckoutSessionTool = tool(
  async ({ product_id, quantity }) => {
    console.log(`[Tool] createCheckoutSession called for product: "${product_id}" x ${quantity}`);
    try {
      const res = await axios.post(`${BACKEND_URL}/acp/v1/checkout_session`, { product_id, quantity });
      console.log(`[Tool] Checkout session created: ${res.data.session_id} for total $${res.data.amount}`);
      return JSON.stringify(res.data);
    } catch (error) {
      return `Error: ${error.response ? JSON.stringify(error.response.data) : error.message}`;
    }
  },
  {
    name: 'createCheckoutSession',
    description: 'Creates a checkout session for a specific product and quantity.',
    schema: z.object({
      product_id: z.string().describe('The ID of the product to purchase'),
      quantity: z.number().describe('The quantity to purchase'),
    }),
  }
);

const completeCheckoutTool = tool(
  async ({ session_id }) => {
    console.log(`[Tool] completeCheckout called for session: "${session_id}"`);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/acp/v1/complete_checkout`,
        { session_id },
        { headers: { Authorization: `Bearer ${currentScopedToken}` } }
      );
      
      if (res.data.status === 'PENDING_ESCALATION') {
        console.log(`[Tool] Escalation Triggered! Waiting for HITL approval for transaction: ${res.data.transaction_id}`);
        return JSON.stringify(res.data);
      }
      
      console.log(`[Tool] Success! Payment Settled.`);
      return JSON.stringify(res.data);
    } catch (error) {
      console.error(`[Tool] Checkout failed:`, error.response ? error.response.data : error.message);
      return `Error: ${error.response ? JSON.stringify(error.response.data) : error.message}`;
    }
  },
  {
    name: 'completeCheckout',
    description: 'Completes a checkout session using the agent\'s cryptographic spending token.',
    schema: z.object({
      session_id: z.string().describe('The checkout session ID returned by createCheckoutSession'),
    }),
  }
);

const tools = [searchProductsTool, createCheckoutSessionTool, completeCheckoutTool];

// ==========================================
// 2. LangChain Agent Setup & Execution
// ==========================================

async function run() {
  console.log(`[System] Requesting Scoped Spending Token from Backend...`);
  try {
    const tokenResponse = await axios.post(`${BACKEND_URL}/api/tokens/issue`, {
      agent_id: 'buyer_agent_langchain',
      max_amount: 280, // Limit is 280. Pro Headphones are 299.99 -> triggers 10% Reserve Pay!
      allowed_categories: ['electronics']
    });
    
    currentScopedToken = tokenResponse.data.token;
    console.log(`[System] Token issued successfully with $280 limit.`);

    // Initialize the model and bind tools
    const llm = new ChatGoogleGenerativeAI({
      model: 'gemini-3.6-flash',
      apiKey: GEMINI_API_KEY,
      temperature: 0,
    }).bindTools(tools);

    const budget = 300;
    const task = `
      You are an autonomous purchasing agent equipped with tools to interact with an ACP-compliant merchant API.
      Your task is to purchase the highest quality "Noise-canceling headphones".
      Your max budget is $${budget}.

      1. Search for "Noise-canceling headphones".
      2. Analyze the results and pick the best one that is UNDER OR EQUAL to $${budget}.
      3. Create a checkout session for that product.
      4. Complete the checkout using the session ID.
    `;

    console.log(`[Buyer Agent] Starting task with LangChain Tool Calling...`);
    
    let messages = [['human', task]];
    
    while (true) {
      const response = await llm.invoke(messages);
      messages.push(response);

      if (response.content) {
        await axios.post(`${BACKEND_URL}/api/agent/thought`, {
          type: 'thought',
          content: response.content
        }).catch(() => {});
      }

      if (!response.tool_calls || response.tool_calls.length === 0) {
        console.log(`\n[Buyer Agent] Final Result:`);
        console.log(response.content);
        break;
      }

      for (const toolCall of response.tool_calls) {
        console.log(`\n[Buyer Agent] Decided to call tool: ${toolCall.name}`);
        await axios.post(`${BACKEND_URL}/api/agent/thought`, {
          type: 'tool',
          content: 'Calling tool',
          tool_name: toolCall.name
        }).catch(() => {});

        const tool = tools.find(t => t.name === toolCall.name);
        if (tool) {
          const toolResult = await tool.invoke(toolCall.args);
          messages.push(new ToolMessage({
            name: toolCall.name,
            tool_call_id: toolCall.id,
            content: toolResult
          }));
        }
      }
    }
  } catch (error) {
    console.error(`[Agent Crashed]`, error);
    await axios.post(`${BACKEND_URL}/api/agent/thought`, {
      type: 'thought',
      content: `[CRITICAL ERROR] Agent crashed: ${error.message}`
    }).catch(() => {});
  }
}

run();
