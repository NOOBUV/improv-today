# Technical Assumptions

## Repository Structure
* **Repository Structure: Dual-repo** - For the MVP, we will continue with the existing dual-repository structure (separate frontend and backend) to prioritize development speed. This will require manual synchronization of data types between the Python backend and the TypeScript frontend.

## Service Architecture
* **Service Architecture:** The core of the product will be the three-layered **"Guided Simulation Engine"** running on the backend. This will operate largely as an asynchronous, event-driven system. The conversational component will be served via a real-time API that blends the simulation's output with session-specific context.

## Testing Requirements
* **Testing Requirements: Unit + Integration** - The project will require a combination of unit tests for individual components (like the event generators) and integration tests to ensure the entire simulation loop and the API work correctly end-to-end.

## Additional Technical Assumptions and Requests
* **Long-Term Memory:** A **Vector Database** (or a Postgres extension like pgvector) will be required to implement the long-term semantic memory search feature. The Architect will need to evaluate the best implementation.
* **Asynchronous Processing:** An asynchronous task queue, such as **Celery with Redis**, is required to run the background simulation engine without blocking the main API.
* **AI Model:** The `Consciousness Generator` and `Daily Journal Generator` require a **premium, high-quality Large Language Model** (e.g., from OpenAI, Anthropic, or Google) to achieve the required level of persona authenticity.

---