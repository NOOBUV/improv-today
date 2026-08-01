# 3\. "Daily Journal" Generator & "Wizard of Oz" Workflow

This is the bridge between the simulation and the public social media presence.

  * **Technical Design:** A scheduled **Celery task** (`Daily Journal Generator`) will run once at the end of each simulated day (e.g., at 11 PM London time). It will query the database for all of that day's `GlobalEvents` and Clara's emotional responses.
  * **Prompt:** It will send this daily log to an LLM with a creative prompt:
    > *"You are Clara. Here is a log of your day. Reflect on it and write a short, witty, Fleabag-inspired journal entry about the most significant moment."*
  * **The "Wizard of Oz" Workflow:**
    1.  The generated journal entry is saved to a `journal_entries` table.
    2.  A simple, secure internal webpage (an admin panel) will be built for a human manager to view these entries.
    3.  The manager reviews the entry, finds a suitable image, and **manually posts it to Clara's Instagram account**. This de-risks the Instagram integration for the MVP.

-----
