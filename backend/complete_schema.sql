-- Connect
\c DigiCrm_AI;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users_details (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'executive',
    status VARCHAR(20) DEFAULT 'active',
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    department VARCHAR(100),
    designation VARCHAR(100),
    tenant_id INTEGER,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    last_password_change TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP,
    invited_by INTEGER,
    invite_accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users_details(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100),
    entity_id INTEGER,
    changes JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    tenant_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. USER SESSIONS TABLE
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users_details(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500),
    ip_address VARCHAR(50),
    user_agent TEXT,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TENANTS TABLE
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    branding JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ROLES TABLE
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(100),
    description TEXT,
    level INTEGER DEFAULT 0,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users_details(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users_details(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users_details(status);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users_details(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);

-- Insert default roles
INSERT INTO roles (name, label, level, permissions) VALUES
('super_admin', 'Super Admin', 100, '["*"]'),
('admin', 'Admin', 80, '["users.*", "deals.*"]'),
('manager', 'Manager', 60, '["users.read", "deals.*", "tasks.*"]'),
('executive', 'Executive', 40, '["deals.*", "tasks.*"]'),
('agent', 'Agent', 20, '["deals.read", "tasks.read"]'),
('client', 'Client', 10, '["deals.read"]')
ON CONFLICT (name) DO NOTHING;

-- Verify
\dt