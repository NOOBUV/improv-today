# Epic 1: "First Conversation" MVP

**Goal:** To launch the core, end-to-end experience, validating that users will pay to have a conversation with the Clara persona.

---
## **Story 1.1: Content - Backstory Generation**
**As a** creator,
**I want** to follow a structured process to generate and curate Clara's foundational backstory,
**so that** her persona is deep, consistent, and ready for the AI model.

**Acceptance Criteria**
1.  The core "Pillar Memories" (5-7 key life events) are defined.
2.  An LLM is used to generate a larger set of smaller, connecting memories based on the pillars.
3.  The generated memories are reviewed, curated, and finalized into a single "Backstory Corpus" document.

---
## **Story 1.2: Backend - Foundational API & State**
**As a** developer,
**I want** to set up a basic API endpoint and database structure for Clara's state,
**so that** the frontend has a service to communicate with and we can store Clara's core attributes.

**Acceptance Criteria**
1.  A new database table `ava_state` is created to store her static attributes from the Backstory Corpus.
2.  A new, secure API endpoint (e.g., `/api/ava/conversation`) is created in the FastAPI backend.
3.  The endpoint can receive a user message and return a hardcoded, sample response.

---
## **Story 1.3: Frontend - Conversational UI**
**As a** developer,
**I want** to build the main conversational interface for the web app,
**so that** users have a screen to interact with Clara.

**Acceptance Criteria**
1.  A new "Conversation Screen" is built using Next.js and `shadcn/ui`.
2.  The UI includes a display area for chat history and a voice input mechanism (using the existing Chrome Web Speech API).
3.  The UI can successfully call the `/api/ava/conversation` endpoint and **use the frontend text-to-speech service to speak the text response.**
4.  The interface includes the "Dynamic Emotional Backdrop" that can change based on a mood received from the API.

---
## **Story 1.4: Backend - "V0" Conversational Logic**
**As a** system,
**I want** to use Clara's static backstory and an LLM to generate in-character responses,
**so that** the core conversational experience feels authentic.

**Acceptance Criteria**
1.  The `/api/clara/conversation` endpoint is updated to load Clara's "Backstory Corpus" and her "Guiding Principles."
2.  It constructs a prompt that includes the user's message and this foundational context.
3.  It successfully calls a premium LLM and gets a response.
4.  The response includes both the text reply and an "emotion" tag (e.g., 'happy', 'sassy', 'stressed').
5.  The full response is sent back to the frontend.

---
## **Story 1.5: Fullstack - Subscription & Gating**
**As a** business owner,
**I want** to integrate a trial and subscription system,
**so that** we can validate our business model by converting users to paying customers.

**Acceptance Criteria**
1.  A payment provider (e.g., Stripe) is integrated with the backend.
2.  The frontend includes a simple onboarding flow with a free trial sign-up.
3.  Access to the "Conversation Screen" is gated, requiring an active trial or subscription.
4.  Users are prompted to subscribe after their trial period ends.

---