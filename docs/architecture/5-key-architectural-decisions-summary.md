# 5\. Key Architectural Decisions Summary

  * **Asynchronous Simulation:** The core life simulation will run as asynchronous background tasks using **Celery**.
  * **Dual-State Persona:** A clear separation between Clara's persistent **Global State** (in PostgreSQL) and the temporary **Session State** for each user's conversation (in Redis).
  * **LLM-driven Consciousness:** The core of Clara's personality will be powered by a premium LLM guided by a sophisticated, layered prompt.
  * **Manual "Wizard of Oz" Social Media:** We are de-risking the MVP by focusing on a **`Daily Journal` generator** as a content curation tool instead of attempting risky automation.
  * **Dual-Repository Structure (for MVP):** To prioritize speed-to-market, we will stick with the existing separate repositories.

<!-- end list -->