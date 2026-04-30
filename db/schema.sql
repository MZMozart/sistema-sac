// Database schema for attendances (conversations)
// Example for PostgreSQL

-- Table: conversations
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  protocol VARCHAR(20) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES users(id),
  agent_id INTEGER REFERENCES users(id),
  company_id INTEGER REFERENCES companies(id),
  channel VARCHAR(10) NOT NULL, -- chat, call, bot
  status VARCHAR(20) NOT NULL, -- active, waiting, closed, bot
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: messages
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id),
  sender_type VARCHAR(10) NOT NULL, -- customer, bot, agent
  sender_id INTEGER REFERENCES users(id),
  message TEXT,
  attachments TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: call_events
CREATE TABLE call_events (
  id SERIAL PRIMARY KEY,
  call_id INTEGER REFERENCES conversations(id),
  event_type VARCHAR(20),
  actor VARCHAR(10),
  timestamp TIMESTAMP DEFAULT NOW(),
  duration INTEGER
);

-- Table: users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  role VARCHAR(20), -- customer, agent, manager, company_owner
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: companies
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
