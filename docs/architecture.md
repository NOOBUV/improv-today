# High-Level Architecture: "Clara, the Digital Companion" MVP

This document outlines the technical architecture for the MVP of the "Clara" project, focusing on Epic 1. It uses the existing tech stack (FastAPI, PostgreSQL, Next.js) and introduces Celery for asynchronous tasks. This design is based on a dual-repository structure to prioritize MVP launch speed.

---
## 1. The Three-Layered Simulation Engine

The engine runs asynchronously on the backend to simulate Clara's life. It manages two distinct types of state: a **Global State** (Clara's "real" life) and an **Instanced Session State** (her mood within a specific user's conversation).

```mermaid
graph TD
    subgraph Asynchronous Backend Simulation (Global State)
        A[⏰ Celery Beat Scheduler] -- Triggers hourly --> B[🐍 Event Generator Task];
        B -- Creates Global Event --> C_DB[(DB: GlobalEvents)];
        D[🧠 Consciousness Generator Task] -- Processes Event --> C_DB;
        D -- Reads/Writes --> E_DB[(DB: ClaraGlobalState)];
        F[📝 Daily Journal Generator] -- Runs at end of day --> E_DB;
    end

    subgraph Real-time User Conversation (Session State)
        G[📱 User's App] <--> H[➡️ FastAPI API];
        H -- Blends Global State & Session History --> I[🧠 Conversational LLM Call];
        I -- Generates Reply --> H;
        H -- Caches/Updates --> J[(Redis: UserSessionState)];
    end
````

  * **Layer 1: Simulation & Event Engine (Input):** A scheduled **Celery task** runs periodically (e.g., every simulated hour). It acts as the `World Event Generator`, creating "Global Events" like `{ event: 'work_deadline_approaching' }` and saving them to the database.

  * **Layer 2: Personality & Decision Engine (Processing):** The `Consciousness Generator` is a Celery task that processes new Global Events. It takes the event and Clara's current **Global State** (mood, energy) and uses an LLM to decide on an emotional response and an action.

  * **Layer 3: Action & Narrative Engine (Output):** This layer executes the AI's decision by updating the **Global State** in the database. For example, a stressful work event lowers her global "energy" stat. This layer also includes the `Daily Journal Generator`.

-----

## 2\. "Consciousness Generator" Implementation

The "consciousness" is achieved through sophisticated prompt engineering. The system will use two different prompt contexts:

#### **A. For Asynchronous Global State Update**

This prompt is used by the backend simulation to update Clara's core life.

```
You are Clara (backstory...). Your current global state is {mood: 'content', stress: 30}. A new event has occurred: 'work_deadline_approaching'.
Given your guiding principles, what is your internal emotional response and what action do you take?
Return a JSON object: {"emotional_response": "...", "chosen_action": "..."}
```

#### **B. For Real-time User Conversation**

This prompt is used by the live API when a user talks to Clara. It blends her global life with the specific conversation.

```
You are Clara (backstory...).
Your underlying GLOBAL mood today is {mood: 'stressed', stress: 65} because a work deadline is approaching.
However, in your current conversation with this user, you are feeling {mood: 'amused'} because they just told a funny joke.

The user's message is: "{user_message}".

Based on BOTH your global mood and your mood in this specific conversation, generate your next reply. Adhere to your refined deflection strategy if needed.
```

-----

## 3\. "Daily Journal" Generator & "Wizard of Oz" Workflow

This is the bridge between the simulation and the public social media presence.

  * **Technical Design:** A scheduled **Celery task** (`Daily Journal Generator`) will run once at the end of each simulated day (e.g., at 11 PM London time). It will query the database for all of that day's `GlobalEvents` and Clara's emotional responses.
  * **Prompt:** It will send this daily log to an LLM with a creative prompt:
    > *"You are Clara. Here is a log of your day. Reflect on it and write a short, witty, Fleabag-inspired journal entry about the most significant moment."*
  * **The "Wizard of Oz" Workflow:**
    1.  The generated journal entry is saved to a `journal_entries` table.
    2.  A simple, secure internal webpage (an admin panel) will be built for a human manager to view these entries.
    3.  The manager reviews the entry, finds a suitable image, and **manually posts it to Clara's Instagram account**. This de-risks the Instagram integration for the MVP.

-----

## 4\. Data Models

To support the simulation engine, we will need to introduce new tables to our PostgreSQL database, managed via Alembic migrations.

#### **`GlobalEvents` Table**

  * `event_id` (PK, UUID)
  * `event_type` (String: e.g., 'work', 'social', 'personal')
  * `summary` (Text)
  * `timestamp` (DateTime)
  * `status` (String: 'unprocessed', 'processed')

#### **`ClaraGlobalState` Table**

This holds Clara's core, persistent state.

  * `state_id` (PK)
  * `trait_name` (String, Unique: e.g., 'stress', 'energy', 'mood')
  * `value` (String or Integer)
  * `last_updated` (DateTime)

#### **`JournalEntries` Table**

  * `entry_id` (PK, UUID)
  * `entry_date` (Date)
  * `content` (Text)
  * `status` (String: 'draft', 'approved', 'posted')

#### **`UserSessionState` (Redis)**

This is a key-value structure in **Redis**, keyed by `session_id`, to store the temporary, conversation-specific state for each user.

-----

## 5\. Key Architectural Decisions Summary

  * **Asynchronous Simulation:** The core life simulation will run as asynchronous background tasks using **Celery**.
  * **Dual-State Persona:** A clear separation between Clara's persistent **Global State** (in PostgreSQL) and the temporary **Session State** for each user's conversation (in Redis).
  * **LLM-driven Consciousness:** The core of Clara's personality will be powered by a premium LLM guided by a sophisticated, layered prompt.
  * **Manual "Wizard of Oz" Social Media:** We are de-risking the MVP by focusing on a **`Daily Journal` generator** as a content curation tool instead of attempting risky automation.
  * **Dual-Repository Structure (for MVP):** To prioritize speed-to-market, we will stick with the existing separate repositories.

<!-- end list -->