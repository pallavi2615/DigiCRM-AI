-- ============================================================
-- DEMO SEED DATA
-- Tenant ID: 6 (Testing)
-- ============================================================

-- ============================================================
-- 1. COMPANIES
-- ============================================================
INSERT INTO companies (tenant_id, name, industry, location, employees, revenue, website, phone, email, status)
VALUES 
    (6, 'Bluewave Logistics', 'Logistics', 'Mumbai, India', 250, 15000000, 'https://bluewave.in', '+91 22 4567 8900', 'info@bluewave.in', 'active'),
    (6, 'Sundaram Textiles', 'Textile', 'Coimbatore, India', 500, 25000000, 'https://sundaramtex.in', '+91 422 1234 5678', 'info@sundaramtex.in', 'active'),
    (6, 'Acme Technologies', 'IT Services', 'Bangalore, India', 100, 8000000, 'https://acmetech.in', '+91 80 2345 6789', 'contact@acmetech.in', 'active'),
    (6, 'Nova Health Clinics', 'Healthcare', 'Hyderabad, India', 150, 12000000, 'https://novahealth.in', '+91 40 3456 7890', 'info@novahealth.in', 'active'),
    (6, 'Greenfield Agro', 'Agriculture', 'Nashik, India', 80, 5000000, NULL, '+91 253 4567 890', NULL, 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. CONTACTS
-- ============================================================
INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, designation, company_id, status)
SELECT 6, 'Ramesh', 'Iyer', 'ramesh@sundaramtex.in', '+91 98400 11223', 'CFO',
    (SELECT id FROM companies WHERE name = 'Sundaram Textiles' AND tenant_id = 6 LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'ramesh@sundaramtex.in');

INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, designation, company_id, status)
SELECT 6, 'Meera', 'Nair', 'meera@sundaramtex.in', '+91 98400 55667', 'Finance Manager',
    (SELECT id FROM companies WHERE name = 'Sundaram Textiles' AND tenant_id = 6 LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'meera@sundaramtex.in');

INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, designation, company_id, status)
SELECT 6, 'Anita', 'Deshpande', 'anita@bluewave.in', '+91 98220 44556', 'Director',
    (SELECT id FROM companies WHERE name = 'Bluewave Logistics' AND tenant_id = 6 LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'anita@bluewave.in');

INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, designation, company_id, status)
SELECT 6, 'Rajesh', 'Kumar', 'rajesh@acmetech.in', '+91 98765 12345', 'CTO',
    (SELECT id FROM companies WHERE name = 'Acme Technologies' AND tenant_id = 6 LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'rajesh@acmetech.in');

INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, designation, company_id, status)
SELECT 6, 'Kiran', 'Rao', 'kiran@novahealth.in', '+91 90000 77889', 'Managing Partner',
    (SELECT id FROM companies WHERE name = 'Nova Health Clinics' AND tenant_id = 6 LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'kiran@novahealth.in');

INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, designation, company_id, status)
SELECT 6, 'Sunil', 'Patil', 'sunil@greenfieldagro.in', '+91 99700 33445', 'Proprietor',
    (SELECT id FROM companies WHERE name = 'Greenfield Agro' AND tenant_id = 6 LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'sunil@greenfieldagro.in');

-- ============================================================
-- 3. LEADS
-- ============================================================
INSERT INTO leads (tenant_id, name, contact_person, email, phone, company_name, company_id, contact_id, designation, website, industry, country, city, message, source, status, priority, estimated_value, expected_close_date, custom_fields)
SELECT 
    6, 'Anita Deshpande', 'Anita Deshpande', 'anita@bluewave.in', '+91 98220 44556',
    'Bluewave Logistics', 
    (SELECT id FROM companies WHERE name = 'Bluewave Logistics' AND tenant_id = 6 LIMIT 1),
    (SELECT id FROM contacts WHERE email = 'anita@bluewave.in' LIMIT 1),
    'Director', 'https://bluewave.in', 'Logistics', 'India', 'Mumbai',
    'Interested in fleet management solution', 'webhook', 'new', 'high', 8500000, '2026-09-30', '{}'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'anita@bluewave.in');

INSERT INTO leads (tenant_id, name, contact_person, email, phone, company_name, company_id, contact_id, designation, industry, country, city, source, status, priority, estimated_value, expected_close_date, custom_fields)
SELECT 
    6, 'Ramesh Iyer', 'Ramesh Iyer', 'ramesh@sundaramtex.in', '+91 98400 11223',
    'Sundaram Textiles',
    (SELECT id FROM companies WHERE name = 'Sundaram Textiles' AND tenant_id = 6 LIMIT 1),
    (SELECT id FROM contacts WHERE email = 'ramesh@sundaramtex.in' LIMIT 1),
    'CFO', 'Textile', 'India', 'Coimbatore',
    'webhook', 'qualified', 'high', 12500000, '2026-10-15', '{}'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'ramesh@sundaramtex.in');

INSERT INTO leads (tenant_id, name, contact_person, email, phone, company_name, company_id, contact_id, designation, industry, country, city, source, status, priority, estimated_value, expected_close_date, custom_fields)
SELECT 
    6, 'Rajesh Kumar', 'Rajesh Kumar', 'rajesh@acmetech.in', '+91 98765 12345',
    'Acme Technologies',
    (SELECT id FROM companies WHERE name = 'Acme Technologies' AND tenant_id = 6 LIMIT 1),
    (SELECT id FROM contacts WHERE email = 'rajesh@acmetech.in' LIMIT 1),
    'CTO', 'IT Services', 'India', 'Bangalore',
    'website', 'contacted', 'medium', 5000000, '2026-10-20', '{}'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'rajesh@acmetech.in');

INSERT INTO leads (tenant_id, name, contact_person, email, phone, company_name, company_id, contact_id, designation, industry, country, city, source, status, priority, estimated_value, expected_close_date, custom_fields)
SELECT 
    6, 'Kiran Rao', 'Kiran Rao', 'kiran@novahealth.in', '+91 90000 77889',
    'Nova Health Clinics',
    (SELECT id FROM companies WHERE name = 'Nova Health Clinics' AND tenant_id = 6 LIMIT 1),
    (SELECT id FROM contacts WHERE email = 'kiran@novahealth.in' LIMIT 1),
    'Managing Partner', 'Healthcare', 'India', 'Hyderabad',
    'referral', 'proposal_sent', 'urgent', 8500000, '2026-09-28', '{}'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'kiran@novahealth.in');

INSERT INTO leads (tenant_id, name, contact_person, email, phone, company_name, company_id, contact_id, designation, industry, country, city, source, status, priority, estimated_value, expected_close_date, custom_fields)
SELECT 
    6, 'Sunil Patil', 'Sunil Patil', 'sunil@greenfieldagro.in', '+91 99700 33445',
    'Greenfield Agro',
    (SELECT id FROM companies WHERE name = 'Greenfield Agro' AND tenant_id = 6 LIMIT 1),
    (SELECT id FROM contacts WHERE email = 'sunil@greenfieldagro.in' LIMIT 1),
    'Proprietor', 'Agriculture', 'India', 'Nashik',
    'webhook', 'new', 'low', 2000000, '2026-11-15', '{}'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'sunil@greenfieldagro.in');

INSERT INTO leads (tenant_id, name, contact_person, email, phone, company_name, industry, country, city, source, status, priority, estimated_value, expected_close_date, custom_fields)
SELECT 6, 'Priya Sharma', 'Priya Sharma', 'priya@fashionhub.in', '+91 98888 12345', 'Fashion Hub',
    'Retail', 'India', 'Delhi', 'facebook', 'new', 'medium', 4500000, '2026-10-25', '{}'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'priya@fashionhub.in');

INSERT INTO leads (tenant_id, name, contact_person, email, phone, company_name, industry, country, city, source, status, priority, estimated_value, expected_close_date, custom_fields)
SELECT 6, 'Vikram Singh', 'Vikram Singh', 'vikram@techworld.in', '+91 97777 54321', 'TechWorld Solutions',
    'IT Services', 'India', 'Pune', 'webhook', 'contacted', 'high', 12000000, '2026-10-10', '{}'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'vikram@techworld.in');

INSERT INTO leads (tenant_id, name, contact_person, email, phone, company_name, industry, country, city, source, status, priority, estimated_value, expected_close_date, custom_fields)
SELECT 6, 'Deepika Menon', 'Deepika Menon', 'deepika@edulearn.in', '+91 96666 11111', 'EduLearn Academy',
    'Education', 'India', 'Kochi', 'google_ads', 'qualified', 'medium', 3500000, '2026-10-18', '{}'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'deepika@edulearn.in');

-- ============================================================
-- 4. PROPOSALS
-- ============================================================
INSERT INTO proposals (tenant_id, lead_id, title, description, amount, currency, status, valid_until, probability, close_date, owner, version, approval_status, pipeline_stage, lead_name, public_token, created_at)
SELECT 
    6, 
    (SELECT id FROM leads WHERE email = 'anita@bluewave.in' LIMIT 1),
    'Bluewave Logistics — Fleet Finance',
    'Term loan for 12 commercial vehicles',
    8500000, 'INR', 'accepted', '2026-10-15', 60, '2026-09-22',
    'Apex Finserv Owner', 'v1', 'approved', 'in_pipeline',
    'Bluewave Logistics', 'tok_' || md5(random()::text), NOW() - INTERVAL '5 days'
WHERE NOT EXISTS (SELECT 1 FROM proposals WHERE title = 'Bluewave Logistics — Fleet Finance');

INSERT INTO proposals (tenant_id, lead_id, title, description, amount, currency, status, valid_until, probability, close_date, owner, version, approval_status, pipeline_stage, lead_name, public_token)
SELECT 
    6, 
    (SELECT id FROM leads WHERE email = 'ramesh@sundaramtex.in' LIMIT 1),
    'Sundaram Textiles — Working Capital',
    'Working capital facility for expansion',
    12500000, 'INR', 'sent', '2026-10-30', 75, '2026-10-15',
    'Apex Finserv Owner', 'v1', 'approved', 'negotiation',
    'Sundaram Textiles', 'tok_' || md5(random()::text)
WHERE NOT EXISTS (SELECT 1 FROM proposals WHERE title = 'Sundaram Textiles — Working Capital');

INSERT INTO proposals (tenant_id, lead_id, title, description, amount, currency, status, valid_until, probability, close_date, owner, version, approval_status, pipeline_stage, lead_name, public_token)
SELECT 
    6, 
    (SELECT id FROM leads WHERE email = 'rajesh@acmetech.in' LIMIT 1),
    'Acme Technologies — Equipment Finance',
    'Asset-backed equipment funding for new servers',
    5000000, 'INR', 'draft', '2026-11-15', 40, '2026-10-20',
    'Apex Finserv Owner', 'v1', 'pending', 'in_pipeline',
    'Acme Technologies', 'tok_' || md5(random()::text)
WHERE NOT EXISTS (SELECT 1 FROM proposals WHERE title = 'Acme Technologies — Equipment Finance');

INSERT INTO proposals (tenant_id, lead_id, title, description, amount, currency, status, valid_until, probability, close_date, owner, version, approval_status, pipeline_stage, lead_name, public_token)
SELECT 
    6, 
    (SELECT id FROM leads WHERE email = 'kiran@novahealth.in' LIMIT 1),
    'Nova Health — Clinic Expansion Loan',
    'Term loan for new clinic setup',
    8500000, 'INR', 'sent', '2026-10-05', 70, '2026-09-28',
    'Apex Finserv Owner', 'v1', 'approved', 'negotiation',
    'Nova Health Clinics', 'tok_' || md5(random()::text)
WHERE NOT EXISTS (SELECT 1 FROM proposals WHERE title = 'Nova Health — Clinic Expansion Loan');

INSERT INTO proposals (tenant_id, lead_id, title, description, amount, currency, status, valid_until, probability, close_date, owner, version, approval_status, pipeline_stage, lead_name, public_token)
SELECT 
    6, 
    (SELECT id FROM leads WHERE email = 'sunil@greenfieldagro.in' LIMIT 1),
    'Greenfield Agro — Seasonal Finance',
    'Seasonal crop financing for Kharif season',
    2000000, 'INR', 'draft', '2026-11-30', 30, '2026-11-15',
    'Apex Finserv Owner', 'v1', 'pending', 'in_pipeline',
    'Greenfield Agro', 'tok_' || md5(random()::text)
WHERE NOT EXISTS (SELECT 1 FROM proposals WHERE title = 'Greenfield Agro — Seasonal Finance');

-- ============================================================
-- 5. TASKS
-- ============================================================
INSERT INTO tasks (tenant_id, title, description, status, priority, due_date, assigned_to, created_by, lead_id, created_at)
SELECT 6, 'Follow up with Bluewave Logistics', 'Call Anita to discuss proposal', 'pending', 'high', 
    CURRENT_DATE + INTERVAL '2 days',
    (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
    (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
    (SELECT id FROM leads WHERE email = 'anita@bluewave.in' LIMIT 1),
    NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Follow up with Bluewave Logistics');

INSERT INTO tasks (tenant_id, title, description, status, priority, due_date, assigned_to, created_by, created_at)
VALUES 
    (6, 'Send proposal to Sundaram Textiles', 'Email WC proposal', 'completed', 'high', CURRENT_DATE - INTERVAL '2 days',
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        NOW() - INTERVAL '5 days'),
    (6, 'Schedule demo for Acme Technologies', 'Product demo call', 'pending', 'medium', CURRENT_DATE + INTERVAL '3 days',
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        NOW() - INTERVAL '2 days'),
    (6, 'Prepare Nova Health proposal', 'Custom proposal for clinic', 'in_progress', 'urgent', CURRENT_DATE + INTERVAL '1 day',
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        NOW() - INTERVAL '3 days'),
    (6, 'Call Greenfield Agro', 'Initial discovery call', 'pending', 'low', CURRENT_DATE + INTERVAL '5 days',
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        NOW() - INTERVAL '1 day'),
    (6, 'Send welcome email to Priya', 'Onboarding email', 'completed', 'medium', CURRENT_DATE - INTERVAL '1 day',
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
        NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. AUDIT LOGS (for Recent Activity)
-- ============================================================
INSERT INTO audit_logs (user_id, action, entity, entity_id, tenant_id, created_at)
VALUES 
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Created lead', 'lead', 1, 6, NOW() - INTERVAL '10 minutes'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Accessed lenders', 'lender', 1, 6, NOW() - INTERVAL '30 minutes'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Updated proposal', 'proposal', 1, 6, NOW() - INTERVAL '1 hour'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Sent proposal', 'proposal', 2, 6, NOW() - INTERVAL '2 hours'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Created task', 'task', 1, 6, NOW() - INTERVAL '3 hours'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Accessed ps_products', 'product', 5, 6, NOW() - INTERVAL '4 hours'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Accepted proposal', 'proposal', 1, 6, NOW() - INTERVAL '5 hours'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Created lead', 'lead', 3, 6, NOW() - INTERVAL '1 day'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Updated deal', 'lead', 2, 6, NOW() - INTERVAL '2 days'),
    ((SELECT id FROM users WHERE tenant_id = 6 LIMIT 1), 'Logged in', 'user', 1, 6, NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. CALENDAR EVENTS
-- ============================================================
INSERT INTO calendar_events (tenant_id, title, description, event_type, start_time, end_time, location, created_by)
VALUES 
    (6, 'Demo with Acme Technologies', 'Product demo for Rajesh', 'meeting', 
        NOW() + INTERVAL '2 days' + INTERVAL '10 hours', 
        NOW() + INTERVAL '2 days' + INTERVAL '11 hours', 
        'Zoom', (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1)),
    (6, 'Nova Health Contract Signing', 'Final contract discussion', 'meeting',
        NOW() + INTERVAL '5 days' + INTERVAL '14 hours',
        NOW() + INTERVAL '5 days' + INTERVAL '15 hours',
        'Hyderabad Office', (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1)),
    (6, 'Weekly Sales Review', 'Team meeting', 'meeting',
        NOW() + INTERVAL '1 day' + INTERVAL '9 hours',
        NOW() + INTERVAL '1 day' + INTERVAL '10 hours',
        'Conference Room A', (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1))
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. MEETINGS
-- ============================================================
INSERT INTO meetings (tenant_id, title, description, agenda, scheduled_at, duration_minutes, status, meeting_type, location, created_by, lead_id)
SELECT 6, 'Bluewave Fleet Demo', 'Show fleet management dashboard', '1. Intro\n2. Dashboard walkthrough\n3. Q&A',
    NOW() + INTERVAL '3 days' + INTERVAL '11 hours', 60, 'scheduled', 'video', 'Zoom',
    (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1),
    (SELECT id FROM leads WHERE email = 'anita@bluewave.in' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM meetings WHERE title = 'Bluewave Fleet Demo');

INSERT INTO meetings (tenant_id, title, description, scheduled_at, duration_minutes, status, meeting_type, created_by)
VALUES 
    (6, 'Sundaram Working Capital Discussion', 'Financial discussion',
        NOW() + INTERVAL '4 days' + INTERVAL '15 hours', 45, 'scheduled', 'video',
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1)),
    (6, 'Nova Health Follow-up Call', 'Follow up on proposal',
        NOW() + INTERVAL '1 day' + INTERVAL '16 hours', 30, 'scheduled', 'call',
        (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1))
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. TICKETS
-- ============================================================
INSERT INTO tickets (tenant_id, subject, description, ticket_number, requester_name, requester_email, priority, urgency, status, sla_due_at, created_by)
SELECT 6, 'Cannot login to portal', 'Getting error when trying to login', 'TKT-0001',
    'Ramesh Iyer', 'ramesh@sundaramtex.in', 'high', 'high', 'open',
    NOW() + INTERVAL '4 hours', (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM tickets WHERE ticket_number = 'TKT-0001');

INSERT INTO tickets (tenant_id, subject, description, ticket_number, requester_name, requester_email, priority, urgency, status, sla_due_at, created_by)
SELECT 6, 'Proposal PDF not downloading', 'Click download nothing happens', 'TKT-0002',
    'Anita Deshpande', 'anita@bluewave.in', 'medium', 'medium', 'pending',
    NOW() + INTERVAL '24 hours', (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM tickets WHERE ticket_number = 'TKT-0002');

INSERT INTO tickets (tenant_id, subject, description, ticket_number, requester_name, requester_email, priority, urgency, status, resolved_at, created_by)
SELECT 6, 'Add new user to team', 'Please add my colleague', 'TKT-0003',
    'Rajesh Kumar', 'rajesh@acmetech.in', 'low', 'low', 'resolved',
    NOW() - INTERVAL '1 day', (SELECT id FROM users WHERE tenant_id = 6 LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM tickets WHERE ticket_number = 'TKT-0003');

-- ============================================================
-- VERIFY — Count check
-- ============================================================
SELECT 'Companies' AS table_name, COUNT(*) FROM companies WHERE tenant_id = 6
UNION ALL
SELECT 'Contacts', COUNT(*) FROM contacts WHERE tenant_id = 6
UNION ALL
SELECT 'Leads', COUNT(*) FROM leads WHERE tenant_id = 6
UNION ALL
SELECT 'Proposals', COUNT(*) FROM proposals WHERE tenant_id = 6
UNION ALL
SELECT 'Tasks', COUNT(*) FROM tasks WHERE tenant_id = 6
UNION ALL
SELECT 'Audit Logs', COUNT(*) FROM audit_logs WHERE tenant_id = 6
UNION ALL
SELECT 'Calendar Events', COUNT(*) FROM calendar_events WHERE tenant_id = 6
UNION ALL
SELECT 'Meetings', COUNT(*) FROM meetings WHERE tenant_id = 6
UNION ALL
SELECT 'Tickets', COUNT(*) FROM tickets WHERE tenant_id = 6;