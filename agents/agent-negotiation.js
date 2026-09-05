require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 3001;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log(`[System] Starting Deterministic Mock Agent (No API Key Required)`);
  
  try {
    // 1. Issue Token
    console.log(`[System] Requesting Scoped Spending Token from Backend...`);
    const tokenResponse = await axios.post(`${BACKEND_URL}/api/tokens/issue`, {
      agent_id: 'buyer_agent_langchain',
      max_amount: 280, // Limit is 280. Pro Headphones are 299.99 -> triggers 10% Reserve Pay!
      allowed_categories: ['electronics']
    });
    const currentScopedToken = tokenResponse.data.token;
    console.log(`[System] Token issued successfully with $280 limit.`);
    await sleep(1500);

    // 2. Initial Thought
    await axios.post(`${BACKEND_URL}/api/agent/thought`, {
      type: 'thought',
      content: 'I need to purchase the best Noise-canceling headphones available. My maximum budget is $300. I will search the merchant catalog first.'
    }).catch(() => {});
    await sleep(2000);

    // 3. Search Tool Call
    await axios.post(`${BACKEND_URL}/api/agent/thought`, {
      type: 'tool',
      content: 'Calling tool: searchProducts',
      tool_name: 'searchProducts'
    }).catch(() => {});
    const searchRes = await axios.post(`${BACKEND_URL}/acp/v1/search`, { query: 'Noise-canceling headphones' });
    await sleep(2000);

    // 4. Decision Thought
    await axios.post(`${BACKEND_URL}/api/agent/thought`, {
      type: 'thought',
      content: `I found "Pro Noise-Canceling Headphones" (ID: prod_2) for $299.99. This is within my $300 task budget, but my cryptographic token is strictly limited to $280. Since $299.99 is within the 10% threshold, I will initiate checkout and rely on the Human-in-the-Loop Reserve Pay guardrail to authorize the difference.`
    }).catch(() => {});
    await sleep(2500);

    // 5. Checkout Session Tool Call
    await axios.post(`${BACKEND_URL}/api/agent/thought`, {
      type: 'tool',
      content: 'Calling tool: createCheckoutSession',
      tool_name: 'createCheckoutSession'
    }).catch(() => {});
    const sessionRes = await axios.post(`${BACKEND_URL}/acp/v1/checkout_session`, { product_id: 'prod_2', quantity: 1 });
    const sessionId = sessionRes.data.session_id;
    await sleep(2000);

    // 6. Complete Checkout Tool Call
    await axios.post(`${BACKEND_URL}/api/agent/thought`, {
      type: 'tool',
      content: 'Calling tool: completeCheckout',
      tool_name: 'completeCheckout'
    }).catch(() => {});
    
    const checkoutRes = await axios.post(
      `${BACKEND_URL}/acp/v1/complete_checkout`,
      { session_id: sessionId },
      { headers: { Authorization: `Bearer ${currentScopedToken}` } }
    );
    await sleep(1500);

    // 7. Finish
    await axios.post(`${BACKEND_URL}/api/agent/thought`, {
      type: 'thought',
      content: `[AGENT FINISHED] Payment executed. The server responded with: ${checkoutRes.data.status}.`
    }).catch(() => {});
    
    console.log(`[System] Mock Agent Finished Successfully.`);

  } catch (error) {
    console.error(`[Mock Agent Crashed]`, error);
    await axios.post(`${BACKEND_URL}/api/agent/thought`, {
      type: 'thought',
      content: `[CRITICAL ERROR] Agent crashed: ${error.message}`
    }).catch(() => {});
  }
}

run();
