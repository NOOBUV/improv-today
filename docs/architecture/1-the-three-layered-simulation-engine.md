# 1. The Three-Layered Simulation Engine

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
