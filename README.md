# 🚀 Razorpay AP2 Engine (Autonomous Agent Payment Protocol)

> An experimental Machine-to-Machine (M2M) payment architecture designed to allow autonomous AI agents to negotiate, purchase, and settle payments securely with deterministic cryptographic guardrails.

![RazorSense Dashboard](https://via.placeholder.com/1000x500.png?text=RazorSense+Visualizer+Screenshot)

## 📖 Overview

As AI agents move from "reading" the web to "taking actions" on our behalf, traditional payment gateways (which rely on human OTPs and CAPTCHAs) become a massive bottleneck. 

The **Razorpay AP2 Engine** is a proof-of-concept infrastructure that solves this by introducing **Agentic Tokens**. Instead of giving an AI a credit card, the user issues a cryptographically signed, scope-limited JWT token (e.g., "Max $300, Electronics Only, Valid for 1 Hour"). 

The AI agent then negotiates with an ACP-compliant merchant API and executes the transaction autonomously. If the agent exceeds its budget by a small margin (e.g., 10%), the AP2 Engine triggers a **Human-in-the-Loop (HITL) Reserve Pay Escalation**, allowing the human to approve the difference via SMS/Push.

## ✨ Key Features

- **🤖 Fully Autonomous Agent Loop:** Built with LangChain and Google Gemini 1.5 Flash, the agent can search catalogs, select products, and execute checkouts dynamically.
- **🛡️ Deterministic Guardrails:** The backend strictly enforces spending limits and category restrictions cryptographically using ECDSA JWT verification—preventing AI hallucinations from draining funds.
- **🚨 HITL Reserve Pay:** If the agent finds a slightly better product just outside its budget (within a 10% buffer), it pauses and escalates to the user for manual approval.
- **⚡ RazorSense Visualizer:** A real-time, WebSocket-powered React dashboard that visualizes the AI's internal "Chain of Thought" alongside a step-by-step cryptographic unpacking of the payment settlement.

## 🛠️ Tech Stack

### Frontend (Deployed on Vercel)
- **Framework:** Next.js 14, React, TypeScript
- **Styling:** Tailwind CSS, Framer Motion
- **State Management:** Zustand
- **Real-time:** Socket.io-client

### Backend (Deployed on Render)
- **Server:** Node.js, Express, TypeScript
- **AI/LLM:** LangChain, Google Gemini API (`gemini-1.5-flash`)
- **Database:** MongoDB Atlas (Mongoose)
- **Real-time:** Socket.io

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas URI
- Google Gemini API Key

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/razorpay-ap2-engine.git
cd razorpay-ap2-engine
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create a .env file with your credentials
echo "MONGO_URI=your_mongo_uri" > .env
echo "JWT_SECRET=super_secret_jwt_key" >> .env
echo "GEMINI_API_KEY=your_gemini_key" >> .env

# Start the backend server (runs on port 3001)
npm run dev
```

### 3. Agent Setup (Dependencies)
```bash
cd agents
npm install
```

### 4. Frontend Setup
```bash
cd frontend
npm install

# Create a .env file for the frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local

# Start the Next.js development server
npm run dev
```

### 5. Run the Engine
Open [http://localhost:3000](http://localhost:3000) in your browser and click **Initialize Agent Task** to watch the autonomous negotiation in real-time!

## 🧠 Why I Built This
This project was built to demonstrate a deep understanding of full-stack system design, real-time WebSockets, AI agent orchestration (LangChain), and secure payment architectures for modern fintech applications.

## 📄 License
MIT License
