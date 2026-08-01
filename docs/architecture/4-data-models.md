# 4\. Data Models

To support the simulation engine, we will need to introduce new tables to our PostgreSQL database, managed via Alembic migrations.

### **`GlobalEvents` Table**

  * `event_id` (PK, UUID)
  * `event_type` (String: e.g., 'work', 'social', 'personal')
  * `summary` (Text)
  * `timestamp` (DateTime)
  * `status` (String: 'unprocessed', 'processed')

### **`ClaraGlobalState` Table**

This holds Clara's core, persistent state.

  * `state_id` (PK)
  * `trait_name` (String, Unique: e.g., 'stress', 'energy', 'mood')
  * `value` (String or Integer)
  * `last_updated` (DateTime)

### **`JournalEntries` Table**

  * `entry_id` (PK, UUID)
  * `entry_date` (Date)
  * `content` (Text)
  * `status` (String: 'draft', 'approved', 'posted')

### **`UserSessionState` (Redis)**

This is a key-value structure in **Redis**, keyed by `session_id`, to store the temporary, conversation-specific state for each user.

-----
